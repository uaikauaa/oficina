package com.oficinagestao.security;

import com.oficinagestao.entity.Usuario;
import com.oficinagestao.repository.UsuarioRepository;
import com.oficinagestao.repository.RoleRepository;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import java.io.ByteArrayInputStream;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class ResourceLimitsIntegrationTest {
    @Value("${local.server.port}") int port;
    @Autowired SharedRateLimitService store;
    @Autowired JdbcTemplate jdbc;
    @Autowired UsuarioRepository users;
    @Autowired RoleRepository roles;
    @Autowired JwtService jwt;
    Usuario user;
    String token;
    final HttpClient client = HttpClient.newHttpClient();

    @BeforeEach void setup() {
        jdbc.update("DELETE FROM security_rate_limits");
        user = new Usuario("Synthetic rate audit", "limits-" + UUID.randomUUID() + "@oficina.invalid", "synthetic-unused-hash", true);
        user.addRole(roles.findByNome("ROLE_ADMIN").orElseThrow());
        user = users.save(user);
        token = jwt.generateToken(user);
    }
    @AfterEach void cleanup() { users.deleteById(user.getId()); jdbc.update("DELETE FROM security_rate_limits"); }
    HttpRequest.Builder request(String path) {
        return HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path)).header("Authorization", "Bearer " + token);
    }
    HttpResponse<String> send(HttpRequest.Builder request) throws Exception { return client.send(request.build(), HttpResponse.BodyHandlers.ofString()); }

    @Test void capsBothContentLengthAndChunkedPayloadBeforeDeserialization() throws Exception {
        byte[] large = new byte[65537];
        var fixed = send(request("/api/clientes").POST(HttpRequest.BodyPublishers.ofByteArray(large)));
        assertEquals(413, fixed.statusCode());
        var chunked = send(request("/api/clientes").POST(HttpRequest.BodyPublishers.ofInputStream(() -> new ByteArrayInputStream(large))));
        assertEquals(413, chunked.statusCode());
        assertFalse(chunked.body().contains("Exception"));
        assertEquals(415, send(request("/api/clientes").header("Content-Encoding", "gzip")
                .POST(HttpRequest.BodyPublishers.ofString("synthetic"))).statusCode());
    }

    @Test void boundsPagesAndRejectsParameterPollution() throws Exception {
        assertEquals(200, send(request("/api/clientes?size=200").GET()).statusCode());
        for (String query : new String[]{"size=201", "size=2000", "page=10001", "page=-1", "size=1&size=200"})
            assertEquals(400, send(request("/api/clientes?" + query).GET()).statusCode(), query);
        assertEquals(413, send(request("/api/clientes?termo=" + "a".repeat(4100)).GET()).statusCode());
        assertEquals(400, send(request("/api/clientes?" + java.util.stream.IntStream.range(0, 31)
                .mapToObj(i -> "p" + i + "=a").collect(java.util.stream.Collectors.joining("&"))).GET()).statusCode());
    }

    @Test void costlyRoutesAndMutationsSharePersistentBudgetsBeforeBusinessLogic() throws Exception {
        String subject = "user:" + user.getEmail();
        for (int i = 0; i < 10; i++) store.consume("pdf-request", subject, 10, Duration.ofMinutes(1));
        for (String path : new String[]{"/pdf", "/recibo", "/documento-servico"}) {
            var response = send(request("/api/ordens-servico/999999999" + path).GET());
            assertEquals(429, response.statusCode());
            assertTrue(Long.parseLong(response.headers().firstValue("retry-after").orElseThrow()) > 0);
            assertEquals("no-store", response.headers().firstValue("cache-control").orElseThrow());
        }
        for (int i = 0; i < 60; i++) store.consume("mutation-request", subject, 60, Duration.ofMinutes(1));
        assertEquals(429, send(request("/api/produtos").header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString("{}"))).statusCode());
    }

    @Test void searchAndReportQuotasCannotBeBypassedWithSpoofedForwardedHeaders() throws Exception {
        for (int i = 0; i < 60; i++) store.consume("search-request", "user:" + user.getEmail(), 60, Duration.ofMinutes(1));
        for (int i = 0; i < 3; i++) assertEquals(429, send(request("/api/busca/rapida?termo=test")
                .header("X-Forwarded-For", "192.0.2." + i).GET()).statusCode());
        for (int i = 0; i < 120; i++) store.consume("report-request", "user:" + user.getEmail(), 120, Duration.ofMinutes(1));
        assertEquals(429, send(request("/api/relatorios/clientes").GET()).statusCode());
    }

    @Test void preAuthenticationBudgetCountsRejectedCsrfAndIgnoresForgedClientIps() throws Exception {
        for (int i = 0; i < 10; i++) {
            assertEquals(403, send(request("/api/auth/login").header("X-Forwarded-For", "192.0.2." + i)
                    .header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString("{}"))).statusCode());
        }
        assertEquals(429, send(request("/api/auth/login").header("X-Forwarded-For", "198.51.100.10")
                .POST(HttpRequest.BodyPublishers.ofString("{}"))).statusCode());
    }
}
