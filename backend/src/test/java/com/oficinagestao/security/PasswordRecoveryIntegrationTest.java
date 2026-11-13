package com.oficinagestao.security;

import com.oficinagestao.dto.CompletePasswordRecoveryRequest;
import com.oficinagestao.dto.PasswordRecoveryRequest;
import com.oficinagestao.controller.PasswordRecoveryController;
import com.oficinagestao.entity.RefreshToken;
import com.oficinagestao.entity.Usuario;
import com.oficinagestao.repository.RefreshTokenRepository;
import com.oficinagestao.repository.UsuarioRepository;
import com.oficinagestao.service.EmailService;
import com.oficinagestao.service.InviteOutbox;
import com.oficinagestao.service.PasswordRecoveryService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.MailSendException;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.support.TransactionTemplate;

import java.net.URI;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@SpringBootTest
@ActiveProfiles("test")
class PasswordRecoveryIntegrationTest {
    @Autowired PasswordRecoveryService recovery;
    @Autowired PasswordRecoveryController controller;
    @Autowired InviteOutbox outbox;
    @Autowired UsuarioRepository users;
    @Autowired RefreshTokenRepository refreshTokens;
    @Autowired PasswordEncoder passwords;
    @Autowired JdbcTemplate jdbc;
    @Autowired TransactionTemplate tx;
    @MockitoBean EmailService mail;
    Usuario user;
    MockHttpServletRequest http;

    @BeforeEach void setup() {
        user = users.saveAndFlush(new Usuario("Synthetic recovery", "recover-" + UUID.randomUUID()
                + "@example.invalid", passwords.encode("OriginalPassword1!"), true));
        http = new MockHttpServletRequest("POST", "/api/auth/recuperacao/solicitar");
        http.setRemoteAddr("192.0.2." + (10 + Math.floorMod(user.getId().intValue(), 200)));
    }

    @AfterEach void cleanup() {
        jdbc.update("DELETE FROM password_recovery_request_jobs");
        jdbc.update("DELETE FROM security_rate_limits");
        users.deleteById(user.getId());
    }

    private String requestAndDeliver() {
        recovery.request(user.getEmail(), http);
        verifyNoInteractions(mail);
        assertTrue(recovery.dispatchRequestOne());
        assertTrue(outbox.dispatchRecoveryOne());
        var url = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(mail).sendPasswordRecovery(eq(user.getEmail()), url.capture());
        return URI.create(url.getValue()).getRawFragment().substring("token=".length());
    }

    @Test void genericResponseAndNoPrecommitMail() {
        recovery.request("unknown-" + UUID.randomUUID() + "@example.invalid", http);
        assertTrue(recovery.dispatchRequestOne());
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM password_reset_requests WHERE usuario_id=?",
                Integer.class, user.getId()));
        recovery.request(user.getEmail(), http);
        assertTrue(recovery.dispatchRequestOne());
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM password_reset_outbox o JOIN "
                + "password_reset_requests r ON r.id=o.reset_id WHERE r.usuario_id=? AND o.status='PENDING'",
                Integer.class, user.getId()));
        verifyNoInteractions(mail);
    }

    @Test void inactiveAndUnknownAccountsAreScrubbedWithoutDelivery() {
        user.setAtivo(false);
        users.saveAndFlush(user);
        recovery.request(user.getEmail(), http);
        recovery.request("unknown-" + UUID.randomUUID() + "@example.invalid", http);
        assertTrue(recovery.dispatchRequestOne());
        assertTrue(recovery.dispatchRequestOne());
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM password_reset_requests WHERE usuario_id=?",
                Integer.class, user.getId()));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM password_recovery_request_jobs "
                + "WHERE status='PENDING' OR nonce IS NOT NULL OR ciphertext IS NOT NULL", Integer.class));
        assertFalse(outbox.dispatchRecoveryOne());
        verifyNoInteractions(mail);
    }

    @Test void duplicateRequestsIssueOnlyLatestUsableTokenAcrossConcurrentWorkers() throws Exception {
        recovery.request(user.getEmail(), http);
        recovery.request(user.getEmail(), http);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var start = new CountDownLatch(1);
            var first = executor.submit(() -> { start.await(); return recovery.dispatchRequestOne(); });
            var second = executor.submit(() -> { start.await(); return recovery.dispatchRequestOne(); });
            start.countDown();
            assertTrue(first.get(10, TimeUnit.SECONDS));
            assertTrue(second.get(10, TimeUnit.SECONDS));
        }
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM password_reset_requests "
                + "WHERE usuario_id=? AND revogado_em IS NULL", Integer.class, user.getId()));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM password_reset_outbox o JOIN "
                + "password_reset_requests r ON r.id=o.reset_id WHERE r.usuario_id=? AND o.status='PENDING'",
                Integer.class, user.getId()));
        assertEquals(2, jdbc.queryForObject("SELECT count(*) FROM password_recovery_request_jobs "
                + "WHERE status='PROCESSED' AND nonce IS NULL AND ciphertext IS NULL", Integer.class));
    }

    @Test void expiredQueueJobNeverIssuesToken() {
        recovery.request(user.getEmail(), http);
        jdbc.update("UPDATE password_recovery_request_jobs SET created_at=now()-interval '2 hours',"
                + "expires_at=now()-interval '1 hour' WHERE status='PENDING'");
        assertTrue(recovery.dispatchRequestOne());
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM password_reset_requests WHERE usuario_id=?",
                Integer.class, user.getId()));
        assertEquals("EXPIRED", jdbc.queryForObject("SELECT status FROM password_recovery_request_jobs",
                String.class));
    }

    @Test void perIdentityLimitBoundsQueuedRequests() {
        for (int i=0; i<4; i++) recovery.request(user.getEmail().toUpperCase(java.util.Locale.ROOT), http);
        assertEquals(3, jdbc.queryForObject("SELECT count(*) FROM password_recovery_request_jobs "
                + "WHERE status='PENDING'", Integer.class));
        verifyNoInteractions(mail);
    }

    @Test void saturatedQueueDoesNotClaimAcceptanceOrSpendIdentityBudget() {
        jdbc.update("DELETE FROM security_rate_limits");
        jdbc.update("INSERT INTO password_recovery_request_jobs(id,key_version,nonce,ciphertext) "
                + "SELECT gen_random_uuid(),1,decode(lpad(to_hex(g),24,'0'),'hex'),"
                + "decode('00000000000000000000000000000000','hex') "
                + "FROM generate_series(1,10000) AS g");
        assertEquals(503, controller.request(new PasswordRecoveryRequest(user.getEmail()), http)
                .getStatusCode().value());
        assertEquals(503, controller.request(new PasswordRecoveryRequest("unknown-" + UUID.randomUUID()
                + "@example.invalid"), http).getStatusCode().value());
        user.setAtivo(false);
        users.saveAndFlush(user);
        assertEquals(503, controller.request(new PasswordRecoveryRequest(user.getEmail()), http)
                .getStatusCode().value());
        assertEquals(10000, jdbc.queryForObject("SELECT count(*) FROM password_recovery_request_jobs",
                Integer.class));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM security_rate_limits", Integer.class));

        jdbc.update("DELETE FROM password_recovery_request_jobs WHERE id="
                + "(SELECT id FROM password_recovery_request_jobs LIMIT 1)");
        user.setAtivo(true);
        users.saveAndFlush(user);
        assertEquals(202, controller.request(new PasswordRecoveryRequest(user.getEmail()), http)
                .getStatusCode().value());
        assertEquals(10000, jdbc.queryForObject("SELECT count(*) FROM password_recovery_request_jobs",
                Integer.class));
        assertEquals(2, jdbc.queryForObject("SELECT count(*) FROM security_rate_limits", Integer.class));
    }

    @Test void advisoryCapacityLockAllowsOnlyOneOfTwoConcurrentFinalSlots() throws Exception {
        jdbc.update("DELETE FROM security_rate_limits");
        jdbc.update("INSERT INTO password_recovery_request_jobs(id,key_version,nonce,ciphertext) "
                + "SELECT gen_random_uuid(),1,decode(lpad(to_hex(g),24,'0'),'hex'),"
                + "decode('00000000000000000000000000000000','hex') "
                + "FROM generate_series(1,9999) AS g");
        try (var executor = Executors.newFixedThreadPool(2)) {
            var start = new CountDownLatch(1);
            var first = executor.submit(() -> {
                start.await();
                return controller.request(new PasswordRecoveryRequest("capacity-a@example.invalid"), http)
                        .getStatusCode().value();
            });
            var second = executor.submit(() -> {
                start.await();
                return controller.request(new PasswordRecoveryRequest("capacity-b@example.invalid"), http)
                        .getStatusCode().value();
            });
            start.countDown();
            assertEquals(java.util.Set.of(202,503), java.util.Set.of(first.get(10, TimeUnit.SECONDS),
                    second.get(10, TimeUnit.SECONDS)));
        }
        assertEquals(10000, jdbc.queryForObject("SELECT count(*) FROM password_recovery_request_jobs",
                Integer.class));
        assertEquals(2, jdbc.queryForObject("SELECT count(*) FROM security_rate_limits", Integer.class));
    }

    @Test void concurrentRequestsAbovePoolSizeDoNotRequireNestedConnections() throws Exception {
        jdbc.update("DELETE FROM security_rate_limits");
        int requests = 12; // Hikari test pool has ten connections.
        try (var executor = Executors.newFixedThreadPool(requests)) {
            var start = new CountDownLatch(1);
            var futures = new java.util.ArrayList<java.util.concurrent.Future<Integer>>();
            for (int i = 0; i < requests; i++) {
                int index = i;
                futures.add(executor.submit(() -> {
                    var request = new MockHttpServletRequest("POST", "/api/auth/recuperacao/solicitar");
                    request.setRemoteAddr("192.0.2." + (20 + index));
                    start.await();
                    return controller.request(new PasswordRecoveryRequest("pool-" + index
                            + "@example.invalid"), request).getStatusCode().value();
                }));
            }
            start.countDown();
            for (var future : futures) assertEquals(202, future.get(20, TimeUnit.SECONDS));
        }
        assertEquals(requests, jdbc.queryForObject("SELECT count(*) FROM password_recovery_request_jobs "
                + "WHERE status='PENDING'", Integer.class));
        assertEquals(requests * 2, jdbc.queryForObject("SELECT count(*) FROM security_rate_limits", Integer.class));
    }

    @Test void workerRollbackRetainsEncryptedJobForRetry() {
        recovery.request(user.getEmail(), http);
        assertThrows(IllegalStateException.class, () -> tx.execute(status -> {
            assertTrue(recovery.dispatchRequestOne());
            throw new IllegalStateException("synthetic worker commit failure");
        }));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM password_recovery_request_jobs "
                + "WHERE status='PENDING' AND nonce IS NOT NULL AND ciphertext IS NOT NULL", Integer.class));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM password_reset_requests WHERE usuario_id=?",
                Integer.class, user.getId()));
        assertTrue(recovery.dispatchRequestOne());
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM password_reset_requests WHERE usuario_id=?",
                Integer.class, user.getId()));
    }

    @Test void corruptedQueuedCiphertextFailsClosedAndIsScrubbed() {
        recovery.request(user.getEmail(), http);
        jdbc.update("UPDATE password_recovery_request_jobs SET ciphertext=decode('00000000000000000000000000000000','hex') "
                + "WHERE status='PENDING'");
        assertTrue(recovery.dispatchRequestOne());
        assertEquals("EXHAUSTED", jdbc.queryForObject("SELECT status FROM password_recovery_request_jobs",
                String.class));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM password_reset_requests WHERE usuario_id=?",
                Integer.class, user.getId()));
        assertTrue(jdbc.queryForObject("SELECT nonce IS NULL AND ciphertext IS NULL "
                + "FROM password_recovery_request_jobs", Boolean.class));
    }

    @Test void recoveryRevokesSessionsAndRejectsReplay() {
        RefreshToken existing = refreshTokens.saveAndFlush(new RefreshToken(user,
                TokenHashUtil.hashStatic("synthetic-old-refresh"), OffsetDateTime.now().plusDays(1)));
        int version = user.getTokenVersion();
        String token = requestAndDeliver();
        String hash = jdbc.queryForObject("SELECT token_hash FROM password_reset_requests WHERE usuario_id=?",
                String.class, user.getId());
        assertNotEquals(token, hash);
        assertEquals(TokenHashUtil.hashStatic(token), hash);
        recovery.complete(new CompletePasswordRecoveryRequest(token, "UpdatedPassword1!", "UpdatedPassword1!"), http);
        Usuario changed = users.findById(user.getId()).orElseThrow();
        assertTrue(passwords.matches("UpdatedPassword1!", changed.getSenha()));
        assertEquals(version + 1, changed.getTokenVersion());
        assertTrue(refreshTokens.findById(existing.getId()).orElseThrow().getRevogado());
        assertThrows(com.oficinagestao.exception.BusinessException.class,
                () -> recovery.complete(new CompletePasswordRecoveryRequest(token,
                        "AnotherPassword1!", "AnotherPassword1!"), http));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM eventos_administrativos WHERE detalhes LIKE ?",
                Integer.class, "%" + token + "%"));
    }

    @Test void rollbackLeavesNeitherVerifierNorDelivery() {
        assertThrows(IllegalStateException.class, () -> tx.execute(status -> {
            recovery.request(user.getEmail(), http);
            throw new IllegalStateException("synthetic rollback");
        }));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM password_reset_requests WHERE usuario_id=?",
                Integer.class, user.getId()));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM password_recovery_request_jobs", Integer.class));
        assertFalse(outbox.dispatchRecoveryOne());
        verifyNoInteractions(mail);
    }

    @Test void reissueRevokesOldLinkAndExpiryRejectsNewLink() {
        String old = requestAndDeliver();
        clearInvocations(mail);
        recovery.request(user.getEmail(), http);
        assertTrue(recovery.dispatchRequestOne());
        assertTrue(outbox.dispatchRecoveryOne());
        var url = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(mail).sendPasswordRecovery(eq(user.getEmail()), url.capture());
        String current = URI.create(url.getValue()).getRawFragment().substring("token=".length());
        assertThrows(com.oficinagestao.exception.BusinessException.class,
                () -> recovery.complete(new CompletePasswordRecoveryRequest(old, "UpdatedPassword1!", "UpdatedPassword1!"), http));
        jdbc.update("UPDATE password_reset_requests SET created_at=now()-interval '2 seconds',"
                + "expira_em=now()-interval '1 second' WHERE token_hash=?", TokenHashUtil.hashStatic(current));
        assertThrows(com.oficinagestao.exception.BusinessException.class,
                () -> recovery.complete(new CompletePasswordRecoveryRequest(current,
                        "UpdatedPassword1!", "UpdatedPassword1!"), http));
    }

    @Test void smtpFailureBacksOffAndCiphertextNeverAppearsInAudit() {
        recovery.request(user.getEmail(), http);
        assertTrue(recovery.dispatchRequestOne());
        doThrow(new MailSendException("synthetic SMTP outage")).when(mail).sendPasswordRecovery(anyString(), anyString());
        assertTrue(outbox.dispatchRecoveryOne());
        assertEquals("PENDING", jdbc.queryForObject("SELECT o.status FROM password_reset_outbox o JOIN "
                + "password_reset_requests r ON r.id=o.reset_id WHERE r.usuario_id=?", String.class, user.getId()));
        assertFalse(outbox.dispatchRecoveryOne());
        Long resetId = jdbc.queryForObject("SELECT id FROM password_reset_requests WHERE usuario_id=?",
                Long.class, user.getId());
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM eventos_administrativos "
                + "WHERE acao='RECUPERACAO_ENTREGA_FALHOU' AND detalhes LIKE ?", Integer.class,
                "% " + resetId + ": SMTP_FAILURE"));
    }

    @Test void realSmtp550TerminatesCommittedRecoveryWithoutRetry() throws Exception {
        recovery.request(user.getEmail(), http);
        assertTrue(recovery.dispatchRequestOne());
        Long resetId = jdbc.queryForObject("SELECT id FROM password_reset_requests WHERE usuario_id=?",
                Long.class, user.getId());
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM password_reset_outbox "
                + "WHERE reset_id=? AND status='PENDING'", Integer.class, resetId));
        verifyNoInteractions(mail);

        try (ServerSocket server = new ServerSocket(0, 1, InetAddress.getLoopbackAddress());
             var executor = Executors.newSingleThreadExecutor()) {
            server.setSoTimeout(5000);
            var exchange = executor.submit(() -> {
                try (var socket = server.accept();
                     var in = new BufferedReader(new InputStreamReader(socket.getInputStream(), StandardCharsets.US_ASCII));
                     var out = new PrintWriter(socket.getOutputStream(), true, StandardCharsets.US_ASCII)) {
                    socket.setSoTimeout(5000);
                    out.print("220 localhost synthetic SMTP\r\n"); out.flush();
                    int recipients = 0;
                    for (String line; (line = in.readLine()) != null;) {
                        String command = line.toUpperCase(java.util.Locale.ROOT);
                        if (command.startsWith("EHLO") || command.startsWith("HELO")) out.print("250 localhost\r\n");
                        else if (command.startsWith("MAIL FROM")) out.print("250 sender accepted\r\n");
                        else if (command.startsWith("RCPT TO")) {
                            out.print("550 5.1.1 synthetic recipient rejection\r\n"); recipients++;
                        } else if (command.startsWith("QUIT")) {
                            out.print("221 bye\r\n"); out.flush(); break;
                        } else out.print("250 ok\r\n");
                        out.flush();
                    }
                    return recipients;
                }
            });
            var sender = new org.springframework.mail.javamail.JavaMailSenderImpl();
            sender.setHost("127.0.0.1"); sender.setPort(server.getLocalPort());
            sender.getJavaMailProperties().put("mail.smtp.connectiontimeout", "3000");
            sender.getJavaMailProperties().put("mail.smtp.timeout", "3000");
            var realMail = new com.oficinagestao.service.EmailServiceImpl(sender, "sender@example.invalid");
            var realWorker = new InviteOutbox(jdbc, tx, realMail,
                    "1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=", 1, "http://localhost:3000");
            assertTrue(realWorker.dispatchRecoveryOne());
            assertEquals(1, exchange.get(5, TimeUnit.SECONDS));
            assertFalse(realWorker.dispatchRecoveryOne());
            assertEquals("EXHAUSTED", jdbc.queryForObject("SELECT status FROM password_reset_outbox "
                    + "WHERE reset_id=?", String.class, resetId));
            assertEquals("SMTP_PERMANENT", jdbc.queryForObject("SELECT last_failure FROM password_reset_outbox "
                    + "WHERE reset_id=?", String.class, resetId));
            assertTrue(jdbc.queryForObject("SELECT nonce IS NULL AND ciphertext IS NULL "
                    + "FROM password_reset_outbox WHERE reset_id=?", Boolean.class, resetId));
            assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM eventos_administrativos "
                    + "WHERE acao='RECUPERACAO_ENTREGA_ESGOTADA' AND detalhes=?",
                    Integer.class, "Recuperação " + resetId + ": SMTP_PERMANENT"));
        }
    }

    @Test void concurrentCompletionAllowsExactlyOneUse() throws Exception {
        String token = requestAndDeliver();
        var request = new CompletePasswordRecoveryRequest(token, "UpdatedPassword1!", "UpdatedPassword1!");
        try (var executor = Executors.newFixedThreadPool(2)) {
            var start = new CountDownLatch(1);
            var first = executor.submit(() -> { start.await(); return finish(request); });
            var second = executor.submit(() -> { start.await(); return finish(request); });
            start.countDown();
            assertEquals(1, (first.get(10, TimeUnit.SECONDS) ? 1 : 0)
                    + (second.get(10, TimeUnit.SECONDS) ? 1 : 0));
        }
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM password_reset_requests "
                + "WHERE usuario_id=? AND usado_em IS NOT NULL", Integer.class, user.getId()));
    }

    private boolean finish(CompletePasswordRecoveryRequest request) {
        try { recovery.complete(request, http); return true; }
        catch (com.oficinagestao.exception.BusinessException expected) { return false; }
    }
}
