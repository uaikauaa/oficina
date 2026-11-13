package com.oficinagestao.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.oficinagestao.entity.Usuario;
import com.oficinagestao.repository.UsuarioRepository;
import com.oficinagestao.service.EmailService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

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
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/** Actual loopback HTTP endpoint, including CSRF, validation, rate limiter and transaction commit. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {"security.password-recovery.queue-poll-ms=3600000",
                "security.invite-outbox.poll-ms=3600000", "logging.level.org.springframework.jdbc=OFF"})
@ActiveProfiles("test")
class PasswordRecoveryTimingIntegrationTest {
    @Value("${local.server.port}") int port;
    @Autowired UsuarioRepository users;
    @Autowired JdbcTemplate jdbc;
    @Autowired SharedRateLimitService limits;
    @Autowired ObjectMapper json;
    @MockitoBean EmailService mail;

    @Test void randomizedPairedHttpRecoveryTimingExperiment() throws Exception {
        final int warmup = 20, pairs = 240;
        String run = UUID.randomUUID().toString();
        String existing = "timing-" + run + "@example.invalid";
        String unknown = "absent-" + run + "@example.invalid";
        Usuario user = users.saveAndFlush(new Usuario("Synthetic timing", existing, "unused", true));
        CookieManager cookies = new CookieManager();
        HttpClient client = HttpClient.newBuilder().cookieHandler(cookies).build();
        URI csrfUri = URI.create("http://127.0.0.1:" + port + "/api/auth/csrf");
        var csrf = client.send(HttpRequest.newBuilder(csrfUri).GET().build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(200, csrf.statusCode());
        String csrfToken = json.readTree(csrf.body()).get("token").asText();
        HttpResponse<String> malformed = client.send(HttpRequest.newBuilder(URI.create(
                "http://127.0.0.1:" + port + "/api/auth/recuperacao/solicitar"))
                .header("Content-Type", "application/json").header("X-XSRF-TOKEN", csrfToken)
                .POST(HttpRequest.BodyPublishers.ofString("{\"email\":\"invalid\"}")).build(),
                HttpResponse.BodyHandlers.ofString());
        assertEquals(400, malformed.statusCode());
        Random order = new Random(42026);
        List<String> csv = new ArrayList<>(List.of("pair,existing_first,existing_ns,unknown_ns"));
        try {
            for (int i = -warmup; i < pairs; i++) {
                // Reset only test budgets outside the measured region.
                jdbc.update("DELETE FROM security_rate_limits");
                boolean first = order.nextBoolean();
                long presentNs, absentNs;
                if (first) {
                    presentNs = measure(client, csrfToken, existing);
                    absentNs = measure(client, csrfToken, unknown);
                } else {
                    absentNs = measure(client, csrfToken, unknown);
                    presentNs = measure(client, csrfToken, existing);
                }
                if (i >= 0) csv.add(i + "," + first + "," + presentNs + "," + absentNs);
            }
            assertEquals(2 * (warmup + pairs), jdbc.queryForObject(
                    "SELECT count(*) FROM password_recovery_request_jobs WHERE status='PENDING'", Integer.class));
            assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM password_reset_requests WHERE usuario_id=?",
                    Integer.class, user.getId()));
            Files.createDirectories(Path.of("target"));
            Files.write(Path.of("target/recovery-http-timing.csv"), csv);
            System.out.println("RECOVERY_HTTP_TIMING: 240 randomized pairs after 20 warmup pairs; target/recovery-http-timing.csv");
        } finally {
            jdbc.update("DELETE FROM password_recovery_request_jobs");
            jdbc.update("DELETE FROM security_rate_limits");
            users.deleteById(user.getId());
        }
    }

    @Test void saturatedHttpIsUniformAndDoesNotConsumeBudgets() throws Exception {
        jdbc.update("DELETE FROM security_rate_limits");
        Usuario active = users.saveAndFlush(new Usuario("Synthetic active", "cap-active-" + UUID.randomUUID()
                + "@example.invalid", "unused", true));
        Usuario inactive = users.saveAndFlush(new Usuario("Synthetic inactive", "cap-inactive-" + UUID.randomUUID()
                + "@example.invalid", "unused", false));
        CookieManager cookies = new CookieManager();
        HttpClient client = HttpClient.newBuilder().cookieHandler(cookies).build();
        var csrf = client.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port
                + "/api/auth/csrf")).GET().build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(200, csrf.statusCode());
        String token = json.readTree(csrf.body()).get("token").asText();
        String unknown = "cap-unknown-" + UUID.randomUUID() + "@example.invalid";
        try {
            jdbc.update("INSERT INTO password_recovery_request_jobs(id,key_version,nonce,ciphertext) "
                    + "SELECT gen_random_uuid(),1,decode(lpad(to_hex(g),24,'0'),'hex'),"
                    + "decode('00000000000000000000000000000000','hex') "
                    + "FROM generate_series(1,10000) AS g");
            for (String email : List.of(active.getEmail(), inactive.getEmail(), unknown)) {
                String body = json.writeValueAsString(java.util.Map.of("email", email));
                var response = client.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port
                        + "/api/auth/recuperacao/solicitar"))
                        .header("Content-Type", "application/json").header("X-XSRF-TOKEN", token)
                        .POST(HttpRequest.BodyPublishers.ofString(body)).build(),
                        HttpResponse.BodyHandlers.ofString());
                assertEquals(503, response.statusCode());
                assertEquals("", response.body());
            }
            assertEquals(10000, jdbc.queryForObject(
                    "SELECT count(*) FROM password_recovery_request_jobs", Integer.class));
            for (String email : List.of(active.getEmail(), inactive.getEmail(), unknown))
                assertEquals(0, limits.inspect("password-recovery-email", email, 3).used());
        } finally {
            jdbc.update("DELETE FROM password_recovery_request_jobs");
            jdbc.update("DELETE FROM security_rate_limits");
            users.deleteById(active.getId());
            users.deleteById(inactive.getId());
        }
    }

    private long measure(HttpClient client, String csrfToken, String email) throws Exception {
        String body = json.writeValueAsString(java.util.Map.of("email", email));
        HttpRequest request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port
                + "/api/auth/recuperacao/solicitar"))
                .header("Content-Type", "application/json")
                .header("X-XSRF-TOKEN", csrfToken)
                .POST(HttpRequest.BodyPublishers.ofString(body)).build();
        long start = System.nanoTime();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        long elapsed = System.nanoTime() - start;
        assertEquals(202, response.statusCode());
        assertEquals("", response.body());
        return elapsed;
    }
}
