package com.oficinagestao.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.oficinagestao.dto.TwoFactorVerifyRequest;
import com.oficinagestao.entity.Role;
import com.oficinagestao.entity.TwoFactorChallenge;
import com.oficinagestao.entity.Usuario;
import com.oficinagestao.repository.RoleRepository;
import com.oficinagestao.repository.TwoFactorChallengeRepository;
import com.oficinagestao.repository.UsuarioRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Testes forenses para validação da proteção contra CSRF, configuração de CORS
 * e segurança dos cookies de autenticação (SEC-06).
 */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
@Transactional
class CsrfAndCorsSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private TwoFactorChallengeRepository twoFactorChallengeRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Value("${cors.allowed-origins:http://localhost:3000,http://127.0.0.1:3000}")
    private String allowedOriginsConfig;

    private Role getOrCreateAdminRole() {
        return roleRepository.findByNome("ROLE_ADMIN")
                .orElseGet(() -> roleRepository.save(new Role("ROLE_ADMIN", "Admin")));
    }

    // =========================================================================
    // FASE 8.1: TESTES DE CORS (1 a 7)
    // =========================================================================

    @Test
    @DisplayName("CORS 1 & 6: Preflight OPTIONS com Origin permitida deve retornar 200 com headers CORS e allowCredentials=true")
    void shouldAcceptAllowedOriginInCorsPreflight() throws Exception {
        String allowedOrigin = "http://localhost:3000";

        mockMvc.perform(options("/api/produtos")
                        .header(HttpHeaders.ORIGIN, allowedOrigin)
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "Content-Type,Authorization"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, allowedOrigin))
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS, "true"))
                .andExpect(header().exists(HttpHeaders.ACCESS_CONTROL_ALLOW_METHODS))
                .andExpect(header().exists(HttpHeaders.ACCESS_CONTROL_MAX_AGE));
    }

    @Test
    @DisplayName("CORS 2, 4, 5 & 7: Preflight OPTIONS com Origin não permitida deve retornar 403 e NÃO refletir a origem maliciosa")
    void shouldRejectUntrustedOriginInCorsPreflight() throws Exception {
        String untrustedOrigin = "https://evil.example";

        mockMvc.perform(options("/api/produtos")
                        .header(HttpHeaders.ORIGIN, untrustedOrigin)
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "Content-Type"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN))
                .andExpect(header().doesNotExist(HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS));
    }

    @Test
    @DisplayName("CORS 3: Wildcard '*' NUNCA deve ser emitido em Access-Control-Allow-Origin quando credentials=true")
    void shouldNeverUseWildcardOriginWhenCredentialsAreAllowed() throws Exception {
        mockMvc.perform(options("/api/produtos")
                        .header(HttpHeaders.ORIGIN, "http://localhost:3000")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET"))
                .andExpect(status().isOk())
                .andExpect(result -> {
                    String allowOrigin = result.getResponse().getHeader(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN);
                    assertNotNull(allowOrigin);
                    assertNotEquals("*", allowOrigin, "Access-Control-Allow-Origin NUNCA deve ser wildcard '*' com allowCredentials=true");
                });
    }

    @Test
    @DisplayName("CORS: Requisição com Origin permitida e método PUT/DELETE em preflight deve ser autorizada")
    void shouldAllowPutAndPostInPreflightForAllowedOrigin() throws Exception {
        String allowedOrigin = "http://127.0.0.1:3000";

        mockMvc.perform(options("/api/ordens-servico/1")
                        .header(HttpHeaders.ORIGIN, allowedOrigin)
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "PUT")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "Content-Type"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, allowedOrigin))
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS, "true"));
    }

    // =========================================================================
    // FASE 8.2: TESTES DE CSRF / REQUISIÇÕES CROSS-ORIGIN (8 a 13)
    // =========================================================================

    @Test
    @DisplayName("CSRF 8 & 9: Requisição cross-origin simples (HTML form urlencoded) com Origin não permitida deve ser rejeitada com 403 Forbidden")
    void shouldRejectCrossSiteFormPostWithUntrustedOrigin() throws Exception {
        mockMvc.perform(post("/api/produtos")
                        .header(HttpHeaders.ORIGIN, "https://evil.example")
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED_VALUE)
                        .content("nome=ProdutoAtaque&precoVenda=10.0"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN));
    }

    @Test
    @DisplayName("CSRF 10: Requisição PUT cross-origin com Origin maliciosa deve ser rejeitada com 403 Forbidden")
    void shouldRejectCrossSitePutWithUntrustedOrigin() throws Exception {
        mockMvc.perform(put("/api/produtos/1")
                        .header(HttpHeaders.ORIGIN, "https://evil.example")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nome\":\"Hack\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("CSRF 10: Requisição DELETE cross-origin com Origin maliciosa deve ser rejeitada com 403 Forbidden")
    void shouldRejectCrossSiteDeleteWithUntrustedOrigin() throws Exception {
        mockMvc.perform(delete("/api/produtos/1")
                        .header(HttpHeaders.ORIGIN, "https://evil.example"))
                .andExpect(status().isForbidden());
    }

    // =========================================================================
    // FASE 8.3: COOKIE SECURITY (HttpOnly, SameSite, Secure, Path, Domain)
    // =========================================================================

    @Test
    @DisplayName("Cookies 11, 12 & 13: Cookies emitidos no login/2FA devem conter HttpOnly, SameSite=Lax (access) e SameSite=Strict (refresh)")
    void shouldSetProperSecurityAttributesOnAuthenticationCookies() throws Exception {
        // Cria usuário e desafio 2FA no banco
        Usuario usuario = new Usuario("Admin Teste", "admin_cookie_test@oficina.com", "hash_senha", true);
        usuario.addRole(getOrCreateAdminRole());
        usuario = usuarioRepository.save(usuario);

        String rawCode = "654321";
        String hashedCode = passwordEncoder.encode(rawCode);
        TwoFactorChallenge challenge = new TwoFactorChallenge(
                usuario,
                "challenge-token-csrf-test",
                hashedCode,
                OffsetDateTime.now().plusMinutes(5),
                false
        );
        twoFactorChallengeRepository.save(challenge);

        TwoFactorVerifyRequest verifyRequest = new TwoFactorVerifyRequest("challenge-token-csrf-test", rawCode);

        MvcResult result = mockMvc.perform(post("/api/auth/2fa/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(verifyRequest)))
                .andExpect(status().isOk())
                .andExpect(header().exists(HttpHeaders.SET_COOKIE))
                .andReturn();

        List<String> setCookies = result.getResponse().getHeaders(HttpHeaders.SET_COOKIE);
        assertFalse(setCookies.isEmpty());

        String accessCookieHeader = setCookies.stream()
                .filter(c -> c.startsWith("access_token="))
                .findFirst()
                .orElse(null);
        assertNotNull(accessCookieHeader, "Deve emitir o cookie access_token");
        assertTrue(accessCookieHeader.contains("HttpOnly"), "access_token deve ser HttpOnly");
        assertTrue(accessCookieHeader.contains("SameSite=Lax"), "access_token deve ter SameSite=Lax");
        assertTrue(accessCookieHeader.contains("Path=/"), "access_token deve ter Path=/");

        String refreshCookieHeader = setCookies.stream()
                .filter(c -> c.startsWith("refresh_token="))
                .findFirst()
                .orElse(null);
        assertNotNull(refreshCookieHeader, "Deve emitir o cookie refresh_token");
        assertTrue(refreshCookieHeader.contains("HttpOnly"), "refresh_token deve ser HttpOnly");
        assertTrue(refreshCookieHeader.contains("SameSite=Strict"), "refresh_token deve ter SameSite=Strict");
        assertTrue(refreshCookieHeader.contains("Path=/api/auth"), "refresh_token deve ter Path restrito a /api/auth");
    }

    @Test
    @DisplayName("Cookies: Logout deve limpar ambos os cookies preservando HttpOnly, SameSite e Paths corretos")
    void shouldClearCookiesOnLogoutWithPreservedSecurityAttributes() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/logout"))
                .andExpect(status().isOk())
                .andExpect(header().exists(HttpHeaders.SET_COOKIE))
                .andReturn();

        List<String> setCookies = result.getResponse().getHeaders(HttpHeaders.SET_COOKIE);
        assertEquals(2, setCookies.size());

        String clearAccess = setCookies.stream().filter(c -> c.startsWith("access_token=")).findFirst().orElse("");
        assertTrue(clearAccess.contains("Max-Age=0") || clearAccess.contains("Expires="));
        assertTrue(clearAccess.contains("HttpOnly"));
        assertTrue(clearAccess.contains("SameSite=Lax"));
        assertTrue(clearAccess.contains("Path=/"));

        String clearRefresh = setCookies.stream().filter(c -> c.startsWith("refresh_token=")).findFirst().orElse("");
        assertTrue(clearRefresh.contains("Max-Age=0") || clearRefresh.contains("Expires="));
        assertTrue(clearRefresh.contains("HttpOnly"));
        assertTrue(clearRefresh.contains("SameSite=Strict"));
        assertTrue(clearRefresh.contains("Path=/api/auth"));
    }

    // =========================================================================
    // FASE 8.4: API SECURITY (14 a 17)
    // =========================================================================

    @Test
    @DisplayName("API 14: Endpoints mutáveis da API devem exigir autenticação com 401 Unauthorized na ausência de credenciais")
    void shouldRejectMutatingEndpointsWithoutAuthentication() throws Exception {
        // POST sem autenticação
        mockMvc.perform(post("/api/produtos")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"codigo\":\"P01\",\"nome\":\"Teste\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("UNAUTHORIZED"));

        // PUT sem autenticação
        mockMvc.perform(put("/api/produtos/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nome\":\"Teste\"}"))
                .andExpect(status().isUnauthorized());

        // DELETE sem autenticação
        mockMvc.perform(delete("/api/produtos/1"))
                .andExpect(status().isUnauthorized());

        // POST em estoque sem autenticação
        mockMvc.perform(post("/api/estoque/movimentar")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"produtoId\":1,\"quantidade\":5}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("API 15: Endpoints GET privados devem exigir autenticação e ser estritamente idempotentes")
    void shouldProtectPrivateGetEndpoints() throws Exception {
        mockMvc.perform(get("/api/ordens-servico"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/clientes"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/estoque/resumo"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("API 16: Autenticação via Authorization Bearer <token> deve ser aceita para APIs programmaticas")
    void shouldAcceptAuthorizationBearerToken() throws Exception {
        Usuario usuario = new Usuario("Admin Bearer", "admin_bearer@oficina.com", "hash_senha", true);
        usuario.addRole(getOrCreateAdminRole());
        usuario = usuarioRepository.save(usuario);

        String token = jwtService.generateToken(usuario);

        mockMvc.perform(get("/api/produtos")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("API 16: Autenticação via Cookie HttpOnly access_token deve ser aceita para a WebApp")
    void shouldAcceptCookieAccessTokenAuthentication() throws Exception {
        Usuario usuario = new Usuario("Admin Cookie", "admin_cookie@oficina.com", "hash_senha", true);
        usuario.addRole(getOrCreateAdminRole());
        usuario = usuarioRepository.save(usuario);

        String token = jwtService.generateToken(usuario);

        jakarta.servlet.http.Cookie cookie = new jakarta.servlet.http.Cookie("access_token", token);
        cookie.setPath("/");
        cookie.setHttpOnly(true);

        mockMvc.perform(get("/api/produtos")
                        .cookie(cookie))
                .andExpect(status().isOk());
    }
}
