package com.oficinagestao.security;

import com.oficinagestao.dto.CreateInviteRequest;
import com.oficinagestao.dto.AcceptInviteRequest;
import com.oficinagestao.entity.Usuario;
import com.oficinagestao.repository.RoleRepository;
import com.oficinagestao.repository.UsuarioRepository;
import com.oficinagestao.service.EmailService;
import com.oficinagestao.service.InviteOutbox;
import com.oficinagestao.service.InviteService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.MailAuthenticationException;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
import java.util.Base64;
import java.util.UUID;
import java.net.URI;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@SpringBootTest
@ActiveProfiles("test")
class InviteOutboxIntegrationTest {
    private static final String PASSWORD = "SyntheticActorPassword1!";
    @Autowired InviteService invites;
    @Autowired InviteOutbox outbox;
    @Autowired UsuarioRepository users;
    @Autowired RoleRepository roles;
    @Autowired PasswordEncoder passwords;
    @Autowired JdbcTemplate jdbc;
    @Autowired TransactionTemplate tx;
    @MockitoBean EmailService mail;
    String actorEmail;
    String email;

    @BeforeEach void actor() {
        Usuario actor = new Usuario("Synthetic owner", "outbox-owner-" + UUID.randomUUID() + "@example.invalid",
                passwords.encode(PASSWORD), true);
        actor.addRole(roles.findByNome("ROLE_SUPER_ADMIN").orElseThrow());
        actor = users.saveAndFlush(actor);
        actorEmail = actor.getEmail();
        email = "outbox-invite-" + UUID.randomUUID() + "@example.invalid";
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new AuthenticatedUser(actor.getId(), actorEmail), null,
                List.of(new SimpleGrantedAuthority("ROLE_SUPER_ADMIN"))));
    }

    @AfterEach void clean() {
        SecurityContextHolder.clearContext();
        jdbc.update("DELETE FROM convites_usuarios WHERE email=?", email);
        jdbc.update("DELETE FROM usuarios WHERE email=?", email);
        jdbc.update("DELETE FROM usuarios WHERE email=?", actorEmail);
    }

    private void issue() {
        invites.create(new CreateInviteRequest(email, "ROLE_CONSULTA", "Synthetic outbox test",
                PASSWORD, "CRIAR_CONVITE"));
    }

    private String state() {
        return jdbc.queryForObject("SELECT o.status FROM invite_delivery_outbox o "
                + "JOIN convites_usuarios c ON c.id=o.invite_id WHERE c.email=? ORDER BY o.id DESC LIMIT 1",
                String.class, email);
    }

    @Test void rollbackNeverSendsOrPersistsDelivery() {
        assertThrows(IllegalStateException.class, () -> tx.execute(status -> {
            issue();
            assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM invite_delivery_outbox o "
                    + "JOIN convites_usuarios c ON c.id=o.invite_id WHERE c.email=?", Integer.class, email));
            throw new IllegalStateException("synthetic rollback");
        }));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM convites_usuarios WHERE email=?", Integer.class, email));
        assertFalse(outbox.dispatchOne());
        verifyNoInteractions(mail);
    }

    @Test void temporaryFailureBacksOffThenSucceeds() {
        issue();
        doThrow(new org.springframework.mail.MailSendException("synthetic outage"))
                .doNothing().when(mail).sendInvitation(anyString(), anyString());
        assertTrue(outbox.dispatchOne());
        assertEquals("PENDING", state());
        assertEquals("SMTP_FAILURE", jdbc.queryForObject("SELECT o.last_failure FROM invite_delivery_outbox o "
                + "JOIN convites_usuarios c ON c.id=o.invite_id WHERE c.email=?", String.class, email));
        assertFalse(outbox.dispatchOne());
        jdbc.update("UPDATE invite_delivery_outbox SET next_attempt_at=now() WHERE status='PENDING'");
        assertTrue(outbox.dispatchOne());
        assertEquals("SENT", state());
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM invite_delivery_outbox WHERE ciphertext IS NOT NULL", Integer.class));
        verify(mail, times(2)).sendInvitation(anyString(), anyString());
    }

    @Test void authenticationFailureIsTerminal() {
        issue();
        doThrow(new MailAuthenticationException("synthetic rejection"))
                .when(mail).sendInvitation(anyString(), anyString());
        assertTrue(outbox.dispatchOne());
        assertEquals("EXHAUSTED", state());
        assertFalse(outbox.dispatchOne());
    }

    @Test void smtpRecipient5xxIsTerminalWithoutRetry() throws Exception {
        issue();
        var rejected = new org.eclipse.angus.mail.smtp.SMTPAddressFailedException(
                new jakarta.mail.internet.InternetAddress(email), "RCPT TO", 550, "synthetic rejection");
        doThrow(new org.springframework.mail.MailSendException("synthetic 5xx", rejected))
                .when(mail).sendInvitation(anyString(), anyString());
        assertTrue(outbox.dispatchOne());
        assertEquals("EXHAUSTED", state());
        assertEquals("SMTP_PERMANENT", jdbc.queryForObject("SELECT o.last_failure FROM invite_delivery_outbox o "
                + "JOIN convites_usuarios c ON c.id=o.invite_id WHERE c.email=?", String.class, email));
        assertFalse(outbox.dispatchOne());
        verify(mail, times(1)).sendInvitation(anyString(), anyString());
    }

    @Test void reissueCancelsOldPayloadAndExpiryPreventsSend() {
        issue();
        issue();
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM invite_delivery_outbox o "
                + "JOIN convites_usuarios c ON c.id=o.invite_id WHERE c.email=? AND o.status='CANCELLED'", Integer.class, email));
        jdbc.update("UPDATE convites_usuarios SET created_at=now()-interval '2 seconds',"
                + "expira_em=now()-interval '1 second' WHERE email=? AND revogado_em IS NULL", email);
        assertTrue(outbox.dispatchOne());
        assertEquals("CANCELLED", state());
        verifyNoInteractions(mail);
    }

    @Test void corruptedCiphertextIsTerminalWithoutLeakingToken() {
        issue();
        jdbc.update("UPDATE invite_delivery_outbox SET ciphertext=decode('000102','hex') WHERE status='PENDING'");
        assertTrue(outbox.dispatchOne());
        assertEquals("EXHAUSTED", state());
        assertEquals("DECRYPTION_FAILED", jdbc.queryForObject("SELECT o.last_failure FROM invite_delivery_outbox o "
                + "JOIN convites_usuarios c ON c.id=o.invite_id WHERE c.email=?", String.class, email));
        verifyNoInteractions(mail);
    }

    @Test void twoWorkersCannotClaimTheSameRow() throws Exception {
        issue();
        var started = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        doAnswer(invocation -> { started.countDown(); assertTrue(release.await(5, TimeUnit.SECONDS)); return null; })
                .when(mail).sendInvitation(anyString(), anyString());
        try (var pool = Executors.newVirtualThreadPerTaskExecutor()) {
            var first = pool.submit(outbox::dispatchOne);
            assertTrue(started.await(5, TimeUnit.SECONDS));
            assertFalse(pool.submit(outbox::dispatchOne).get(5, TimeUnit.SECONDS));
            release.countDown();
            assertTrue(first.get(5, TimeUnit.SECONDS));
        }
        assertEquals("SENT", state());
        verify(mail, times(1)).sendInvitation(anyString(), anyString());
    }

    @Test void oldKeyRemainsReadableAfterActiveVersionRotates() {
        issue();
        String oldKey = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
        byte[] distinct = new byte[32];
        java.util.Arrays.fill(distinct, (byte) 7);
        String newKey = Base64.getEncoder().encodeToString(distinct);
        InviteOutbox rotated = new InviteOutbox(jdbc, tx, mail, "1:" + oldKey + ",2:" + newKey,
                2, "http://localhost:3000");
        assertTrue(rotated.dispatchOne());
        assertEquals("SENT", state());
        verify(mail).sendInvitation(anyString(), anyString());
    }

    @Test void wrongKeyFailsAuthenticationAndErasesPayload() {
        issue();
        byte[] wrong = new byte[32];
        java.util.Arrays.fill(wrong, (byte) 9);
        InviteOutbox wrongKey = new InviteOutbox(jdbc, tx, mail,
                "1:" + Base64.getEncoder().encodeToString(wrong), 1, "http://localhost:3000");
        assertTrue(wrongKey.dispatchOne());
        assertEquals("EXHAUSTED", state());
        verifyNoInteractions(mail);
    }

    @Test void smtpAcceptedBeforeAckFailureCanCauseDocumentedDuplicate() {
        issue();
        jdbc.execute("CREATE FUNCTION stage32_reject_ack() RETURNS trigger LANGUAGE plpgsql AS $$ "
                + "BEGIN IF NEW.status='SENT' THEN RAISE EXCEPTION 'synthetic ack failure'; END IF; RETURN NEW; END $$");
        jdbc.execute("CREATE TRIGGER stage32_reject_ack BEFORE UPDATE ON invite_delivery_outbox "
                + "FOR EACH ROW EXECUTE FUNCTION stage32_reject_ack()");
        try {
            assertThrows(org.springframework.dao.DataAccessException.class, outbox::dispatchOne);
            assertEquals("PENDING", state());
        } finally {
            jdbc.execute("DROP TRIGGER stage32_reject_ack ON invite_delivery_outbox");
            jdbc.execute("DROP FUNCTION stage32_reject_ack()");
        }
        assertTrue(outbox.dispatchOne());
        assertEquals("SENT", state());
        verify(mail, times(2)).sendInvitation(anyString(), anyString());
    }

    @Test void databaseFailureRollsBackInviteAndOutboxTogether() {
        jdbc.execute("CREATE FUNCTION stage32_reject_insert() RETURNS trigger LANGUAGE plpgsql AS $$ "
                + "BEGIN RAISE EXCEPTION 'synthetic database failure'; END $$");
        jdbc.execute("CREATE TRIGGER stage32_reject_insert BEFORE INSERT ON invite_delivery_outbox "
                + "FOR EACH ROW EXECUTE FUNCTION stage32_reject_insert()");
        try {
            assertThrows(org.springframework.dao.DataAccessException.class, this::issue);
            assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM convites_usuarios WHERE email=?", Integer.class, email));
            verifyNoInteractions(mail);
        } finally {
            jdbc.execute("DROP TRIGGER stage32_reject_insert ON invite_delivery_outbox");
            jdbc.execute("DROP FUNCTION stage32_reject_insert()");
        }
    }

    @Test void deliveredButExpiredInviteCannotBeAccepted() {
        issue();
        assertTrue(outbox.dispatchOne());
        var url = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(mail).sendInvitation(anyString(), url.capture());
        String token = URI.create(url.getValue()).getRawQuery().substring("token=".length());
        jdbc.update("UPDATE convites_usuarios SET created_at=now()-interval '2 seconds',"
                + "expira_em=now()-interval '1 second' WHERE email=?", email);
        var request = new MockHttpServletRequest("POST", "/api/auth/convites/aceitar");
        request.setRemoteAddr("127.0.0.1");
        assertThrows(com.oficinagestao.exception.BusinessException.class,
                () -> invites.accept(new AcceptInviteRequest(token, "Expired", "SyntheticInvitePassword1!"), request));
    }

    @Test void reissuedTokenCannotCreateAccount() {
        issue();
        assertTrue(outbox.dispatchOne());
        var url = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(mail).sendInvitation(anyString(), url.capture());
        String oldToken = URI.create(url.getValue()).getRawQuery().substring("token=".length());
        issue();
        var request = new MockHttpServletRequest("POST", "/api/auth/convites/aceitar");
        request.setRemoteAddr("127.0.0.1");
        assertThrows(com.oficinagestao.exception.BusinessException.class,
                () -> invites.accept(new AcceptInviteRequest(oldToken, "Revoked", "SyntheticInvitePassword1!"), request));
        assertTrue(users.findByEmail(email).isEmpty());
    }
}
