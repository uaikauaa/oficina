package com.oficinagestao.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.oficinagestao.entity.*;
import com.oficinagestao.repository.*;
import com.oficinagestao.testsupport.CsrfMockMvc;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.*;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpMethod;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;
import java.nio.file.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;

/** Fresh route enumeration, real JWTs/users and rolled-back ADMIN probes; no role mocking. */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc(print = org.springframework.boot.webmvc.test.autoconfigure.MockMvcPrint.NONE)
class IndependentRouteAuditTest {
    @Autowired MockMvc mvc;
    @Autowired @Qualifier("requestMappingHandlerMapping") RequestMappingHandlerMapping mappings;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    @Autowired UsuarioRepository users;
    @Autowired RoleRepository roles;
    @Autowired JwtService jwt;
    @Autowired PlatformTransactionManager manager;
    Usuario admin, ordinary;
    Role ordinaryRole;
    boolean createdRole;

    @BeforeEach void setup() {
        jdbc.update("DELETE FROM security_rate_limits");
        ordinaryRole = roles.findByNome("ROLE_USER").orElseGet(() -> { createdRole = true; return roles.save(new Role("ROLE_USER", "Synthetic audit only")); });
        admin = create("admin", roles.findByNome("ROLE_ADMIN").orElseThrow());
        ordinary = create("user", ordinaryRole);
    }
    Usuario create(String prefix, Role role) {
        var value = new Usuario("Independent audit", prefix + UUID.randomUUID() + "@oficina.invalid", "unused-synthetic", true);
        value.addRole(role); return users.save(value);
    }
    @AfterEach void cleanup() {
        for (Usuario user : List.of(admin, ordinary)) {
            jdbc.update("DELETE FROM auditoria WHERE usuario_id = ?", user.getId());
            users.deleteById(user.getId());
        }
        if (createdRole) roles.deleteById(ordinaryRole.getId());
        jdbc.update("DELETE FROM security_rate_limits");
    }
    MockHttpServletRequestBuilder probe(RequestMethod method, String path) {
        var request = request(HttpMethod.valueOf(method.name()), path.replaceAll("\\{[^}]+}", "999999999"));
        if (!Set.of(RequestMethod.GET, RequestMethod.HEAD, RequestMethod.OPTIONS).contains(method)) request.contentType("application/json").content("{}");
        return request;
    }
    int rolledBack(MockHttpServletRequestBuilder request) {
        return new TransactionTemplate(manager).execute(status -> {
            try { return mvc.perform(request).andReturn().getResponse().getStatus(); }
            catch (Exception e) { throw new IllegalStateException("Independent route probe failed", e); }
            finally { status.setRollbackOnly(); }
        });
    }
    @Test void enumerateAndExerciseEveryDocumentedRouteWithRealJwtIdentities() throws Exception {
        var documented = new TreeSet<String>();
        for (var row : json.readTree(Files.readString(Path.of("../docs/security-hardening/rotas-api.json"))))
            documented.add(row.path("method").asText() + " " + row.path("route").asText());
        documented.addAll(Set.of("GET /api/admin/usuarios", "PATCH /api/admin/usuarios/{id}/status",
                "PUT /api/admin/usuarios/{id}/papeis", "POST /api/admin/usuarios/{id}/revogar-sessoes",
                "POST /api/admin/convites", "POST /api/auth/convites/aceitar",
                "GET /api/admin/papeis", "GET /api/admin/permissoes", "POST /api/admin/papeis",
                "PUT /api/admin/papeis/{id}", "GET /api/admin/auditoria",
                "GET /api/admin/infraestrutura", "POST /api/admin/provisionamento/super-admin",
                "GET /api/admin/resumo"));
        var actual = new TreeSet<String>();
        var evidence = new ArrayList<Map<String, Object>>();
        var csrf = CsrfMockMvc.obtain(mvc);
        for (var entry : mappings.getHandlerMethods().entrySet()) for (String path : entry.getKey().getPatternValues()) {
            if (!path.startsWith("/api/")) continue;
            for (var method : entry.getKey().getMethodsCondition().getMethods()) {
                String key = method + " " + path;
                actual.add(key);
                boolean publicRoute = path.equals("/api/health") || key.equals("GET /api/auth/csrf")
                        || (method == RequestMethod.POST && Set.of("/api/auth/login", "/api/auth/refresh", "/api/auth/logout", "/api/auth/2fa/verify", "/api/auth/2fa/resend", "/api/auth/convites/aceitar").contains(path));
                String adminToken = jwt.generateToken(users.findById(admin.getId()).orElseThrow());
                String userToken = jwt.generateToken(ordinary);
                int anonymous = rolledBack(csrf.apply(probe(method, path)));
                int lowRole = rolledBack(csrf.apply(probe(method, path).header("Authorization", "Bearer " + userToken)));
                boolean selfRoute = Set.of("GET /api/auth/me", "PUT /api/auth/alterar-senha").contains(key);
                if (!publicRoute) {
                    assertEquals(401, anonymous, key);
                    if (!selfRoute) assertEquals(403, lowRole, key);
                }
                int authorized = rolledBack(csrf.apply(probe(method, path).header("Authorization", "Bearer " + adminToken)
                                .cookie(new Cookie("access_token", adminToken))));
                assertTrue(authorized < 500, key + " returned " + authorized);
                if (path.equals("/api/admin/provisionamento/super-admin"))
                    assertEquals(400, authorized, key + " fixture has no bootstrap request body");
                else if (path.startsWith("/api/admin/")) assertEquals(403, authorized, key + " legacy ADMIN must not administer users");
                else if (!publicRoute) assertTrue(authorized != 401 && authorized != 403 && authorized != 429, key + " did not reach the ADMIN handler: " + authorized);
                boolean mutation = !Set.of(RequestMethod.GET, RequestMethod.HEAD, RequestMethod.OPTIONS).contains(method);
                if (mutation) {
                    int noCsrf = mvc.perform(probe(method, path).cookie(new Cookie("access_token", adminToken))).andReturn().getResponse().getStatus();
                    assertEquals(403, noCsrf, key + " missing CSRF");
                }
                evidence.add(Map.of("method", method.name(), "route", path, "handler", entry.getValue().getBeanType().getSimpleName() + "#" + entry.getValue().getMethod().getName(),
                        "anonymousStatus", anonymous, "userJwtStatus", lowRole, "adminJwtStatus", authorized,
                        "cookieMutationCsrfTested", mutation, "probe", "missing IDs and empty JSON; business state rolled back"));
            }
        }
        Files.writeString(Path.of("target/independent-route-coverage.json"), json.writerWithDefaultPrettyPrinter().writeValueAsString(evidence));
        assertEquals(documented, actual, "Unreviewed new or removed API mappings");
        assertEquals(97, actual.size());
    }

    @Test void shadowEndpointsDangerousMethodsHostAndCrLfDoNotOpenAnotherSurface() throws Exception {
        String token = jwt.generateToken(admin);
        var rows = new ArrayList<Map<String, Object>>();
        for (String path : List.of("/api/graphql", "/graphql", "/api/upload", "/ws", "/api/unknown-shadow-api")) {
            int result = rolledBack(get(path).header("Authorization", "Bearer " + token));
            assertEquals(path.startsWith("/api/") ? 403 : 404, result, path);
            rows.add(Map.of("probe", path, "status", result));
        }
        for (String method : List.of("TRACE", "CONNECT", "PROPFIND")) {
            int result = mvc.perform(request(HttpMethod.valueOf(method), "/api/clientes").header("Authorization", "Bearer " + token)).andReturn().getResponse().getStatus();
            assertTrue(Set.of(400, 403, 405, 501).contains(result), method + ": " + result);
            rows.add(Map.of("probe", method, "status", result));
        }
        var response = mvc.perform(get("/api/clientes").param("termo", "canary\r\nX-Audit-Injected: yes")
                .header("Authorization", "Bearer " + token).header("Host", "untrusted.example.invalid")
                .header("X-Forwarded-Host", "untrusted.example.invalid")).andReturn().getResponse();
        assertEquals(200, response.getStatus());
        assertNull(response.getHeader("X-Audit-Injected"));
        assertFalse(response.getContentAsString().contains("untrusted.example.invalid"));
        rows.add(Map.of("probe", "Host/forwarded host/CRLF query", "status", response.getStatus()));
        Files.writeString(Path.of("target/independent-negative-vectors.json"), json.writerWithDefaultPrettyPrinter().writeValueAsString(rows));
    }
}
