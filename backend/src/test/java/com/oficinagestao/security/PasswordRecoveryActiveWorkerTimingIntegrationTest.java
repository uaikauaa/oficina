package com.oficinagestao.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.oficinagestao.service.EmailService;
import com.oficinagestao.service.InviteOutbox;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.MethodOrderer;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.support.TransactionTemplate;

import java.net.CookieManager;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

import static org.junit.jupiter.api.Assertions.*;

/** Independent HTTP timing samples while the durable PostgreSQL worker is enabled. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {"security.password-recovery.queue-poll-ms=100",
                "security.invite-outbox.poll-ms=3600000",
                "logging.level.org.springframework.jdbc=OFF"})
@ActiveProfiles("test")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class PasswordRecoveryActiveWorkerTimingIntegrationTest {
    @Value("${local.server.port}") int port;
    @Autowired JdbcTemplate jdbc;
    @Autowired TransactionTemplate transactions;
    @Autowired InviteOutbox outbox;
    @Autowired ObjectMapper json;
    @MockitoBean EmailService mail;

    @Test @Order(1)
    void measuresWithActiveWorkerAtNormalLoad() throws Exception {
        measure("idle", 0);
    }

    @Test @Order(2)
    void measuresWithActiveWorkerAndMixedQueueBacklog() throws Exception {
        measure("loaded", 2000);
    }

    private void measure(String mode, int backlog) throws Exception {
        final int warmup = 20, pairs = 200;
        String prefix = "stage43-" + mode + "-";
        jdbc.update("DELETE FROM security_rate_limits");
        jdbc.update("INSERT INTO usuarios(nome,email,senha,ativo) SELECT "
                + "'Synthetic worker timing',? || 'e-' || g || '@example.invalid','unused',true "
                + "FROM generate_series(0,?) AS g", prefix, warmup + pairs - 1);
        if (backlog > 0) {
            jdbc.update("INSERT INTO usuarios(nome,email,senha,ativo) SELECT "
                    + "'Synthetic worker load',? || 'b-' || g || '@example.invalid','unused',true "
                    + "FROM generate_series(0,?) AS g", prefix, backlog / 2 - 1);
            transactions.executeWithoutResult(status -> {
                for (int i = 0; i < backlog; i++)
                    outbox.enqueueRecoveryRequest(prefix + (i % 2 == 0 ? "b-" + (i / 2) : "x-" + (i / 2))
                            + "@example.invalid");
            });
        }
        CookieManager cookies = new CookieManager();
        HttpClient client = HttpClient.newBuilder().cookieHandler(cookies).build();
        var csrf = client.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port
                + "/api/auth/csrf")).GET().build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(200, csrf.statusCode());
        String csrfToken = json.readTree(csrf.body()).get("token").asText();
        Random order = new Random(43001 + backlog);
        List<String> csv = new ArrayList<>(List.of("pair,existing_first,existing_ns,unknown_ns,pending_before"));
        int pairsWithBacklog = 0;
        int processedBefore = jdbc.queryForObject("SELECT count(*) FROM password_recovery_request_jobs "
                + "WHERE status='PROCESSED'", Integer.class);
        try {
            for (int i = 0; i < warmup + pairs; i++) {
                jdbc.update("DELETE FROM security_rate_limits");
                int pendingBefore = jdbc.queryForObject("SELECT count(*) FROM password_recovery_request_jobs "
                        + "WHERE status='PENDING'", Integer.class);
                String existing = prefix + "e-" + i + "@example.invalid";
                String unknown = prefix + "n-" + i + "@example.invalid";
                boolean existingFirst = order.nextBoolean();
                long presentNs, absentNs;
                if (existingFirst) {
                    presentNs = request(client, csrfToken, existing);
                    absentNs = request(client, csrfToken, unknown);
                } else {
                    absentNs = request(client, csrfToken, unknown);
                    presentNs = request(client, csrfToken, existing);
                }
                if (i >= warmup) {
                    if (pendingBefore > 0) pairsWithBacklog++;
                    csv.add((i - warmup) + "," + existingFirst + ","
                            + presentNs + "," + absentNs + "," + pendingBefore);
                }
            }
            if (backlog > 0) assertTrue(pairsWithBacklog >= pairs / 2,
                    "worker backlog must remain present during most measured pairs");
            assertTrue(jdbc.queryForObject("SELECT count(*) FROM password_recovery_request_jobs "
                    + "WHERE status='PROCESSED'", Integer.class) > processedBefore,
                    "worker must process committed jobs during measured HTTP traffic");
            Files.createDirectories(Path.of("target"));
            Files.write(Path.of("target/recovery-active-worker-" + mode + ".csv"), csv);
            System.out.println("RECOVERY_ACTIVE_WORKER_TIMING: " + mode + ", 200 pairs after 20 warmup pairs");
        } finally {
            for (int i = 0; i < 900 && jdbc.queryForObject(
                    "SELECT count(*) FROM password_recovery_request_jobs WHERE status='PENDING'",
                    Integer.class) > 0; i++) Thread.sleep(100);
            assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM password_recovery_request_jobs "
                    + "WHERE status='PENDING'", Integer.class));
            jdbc.update("DELETE FROM password_recovery_request_jobs");
            jdbc.update("DELETE FROM usuarios WHERE email LIKE ?", prefix + "%@example.invalid");
            jdbc.update("DELETE FROM security_rate_limits");
        }
    }

    private long request(HttpClient client, String csrfToken, String email) throws Exception {
        String body = json.writeValueAsString(java.util.Map.of("email", email));
        HttpRequest request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port
                + "/api/auth/recuperacao/solicitar"))
                .header("Content-Type", "application/json").header("X-XSRF-TOKEN", csrfToken)
                .POST(HttpRequest.BodyPublishers.ofString(body)).build();
        long start = System.nanoTime();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        long elapsed = System.nanoTime() - start;
        assertEquals(202, response.statusCode());
        assertEquals("", response.body());
        return elapsed;
    }
}
