package com.oficinagestao.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.oficinagestao.dto.AlterarSenhaRequest;
import com.oficinagestao.dto.TwoFactorVerifyRequest;
import com.oficinagestao.entity.RefreshToken;
import com.oficinagestao.entity.Role;
import com.oficinagestao.entity.TwoFactorChallenge;
import com.oficinagestao.entity.Usuario;
import com.oficinagestao.repository.RefreshTokenRepository;
import com.oficinagestao.repository.RoleRepository;
import com.oficinagestao.repository.TwoFactorChallengeRepository;
import com.oficinagestao.repository.UsuarioRepository;
import com.oficinagestao.service.AuthService;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Testes forenses obrigatórios para SEC-07:
 * Invalidação imediata de access_token após logout e alteração de senha
 * via mecanismo seguro de versionamento de tokens (tokenVersion).
 */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
@Transactional
class TokenVersionSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private AuthService authService;

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private TwoFactorChallengeRepository twoFactorChallengeRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private Role getOrCreateAdminRole() {
        return roleRepository.findByNome("ROLE_ADMIN")
                .orElseGet(() -> roleRepository.save(new Role("ROLE_ADMIN", "Administrador")));
    }

    private Usuario criarUsuarioTeste(String email, String senhaPlana) {
        Usuario usuario = new Usuario("Usuario Teste SEC07", email, passwordEncoder.encode(senhaPlana), true);
        usuario.setTokenVersion(0);
        usuario.addRole(getOrCreateAdminRole());
        return usuarioRepository.save(usuario);
    }

    // =========================================================================
    // TESTE 1 & 2: JWT RECÉM-EMITIDO E COM VERSÃO ATUAL É ACEITO
    // =========================================================================

    @Test
    @DisplayName("SEC-07 [1 & 2]: JWT recém-emitido com tokenVersion atual deve autenticar com sucesso")
    void shouldAcceptNewlyIssuedJwtTokenWithCurrentTokenVersion() throws Exception {
        Usuario usuario = criarUsuarioTeste("usuario_recem_emitido@oficina.com", "SenhaForte#2026");

        String token = jwtService.generateToken(usuario);
        assertNotNull(token);
        assertEquals(0, jwtService.extractTokenVersion(token));

        mockMvc.perform(get("/api/produtos")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk());

        // Também deve funcionar via Cookie HttpOnly
        Cookie cookie = new Cookie("access_token", token);
        cookie.setPath("/");
        cookie.setHttpOnly(true);

        mockMvc.perform(get("/api/produtos")
                        .cookie(cookie))
                .andExpect(status().isOk());
    }

    // =========================================================================
    // TESTE 3: JWT COM TOKEN_VERSION ANTIGA É REJEITADO
    // =========================================================================

    @Test
    @DisplayName("SEC-07 [3]: JWT com tokenVersion antiga deve ser rejeitado com 401 Unauthorized")
    void shouldRejectJwtWithOldTokenVersion() throws Exception {
        Usuario usuario = criarUsuarioTeste("usuario_versao_antiga@oficina.com", "SenhaForte#2026");

        // Gera token com versão 0
        String tokenAntigo = jwtService.generateToken(usuario, 0);

        // Simula incremento de versão no banco para 1
        usuario.setTokenVersion(1);
        usuarioRepository.save(usuario);

        // Requisição com token antigo deve falhar com 401
        mockMvc.perform(get("/api/produtos")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenAntigo))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("UNAUTHORIZED"));
    }

    // =========================================================================
    // TESTE 4 & 5: ALTERAÇÃO DE SENHA INVALIDA TOKENS ANTERIORES E NOVO FUNCIONA
    // =========================================================================

    @Test
    @DisplayName("SEC-07 [4 & 5]: Após alteração de senha, token antigo é rejeitado e novo token emitido é aceito")
    void shouldRejectOldTokenAndAcceptNewTokenAfterPasswordChange() throws Exception {
        Usuario usuario = criarUsuarioTeste("usuario_altera_senha@oficina.com", "SenhaInicial#2026");

        // Emite token ANTES da troca de senha
        String tokenAntesDaTroca = jwtService.generateToken(usuario);

        // Valida que o token inicial funciona
        mockMvc.perform(get("/api/produtos")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenAntesDaTroca))
                .andExpect(status().isOk());

        // Altera a senha
        AlterarSenhaRequest request = new AlterarSenhaRequest("SenhaInicial#2026", "NovaSenhaSuperForte#2026", "NovaSenhaSuperForte#2026");
        MockHttpServletRequest httpRequest = new MockHttpServletRequest();
        authService.alterarSenha(usuario.getEmail(), request, httpRequest);

        // 4. Token antigo DEVE ser rejeitado imediatamente após a alteração de senha
        mockMvc.perform(get("/api/produtos")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenAntesDaTroca))
                .andExpect(status().isUnauthorized());

        // Recarrega usuário do banco para obter a nova versão
        Usuario usuarioAtualizado = usuarioRepository.findById(usuario.getId()).orElseThrow();
        assertEquals(1, usuarioAtualizado.getTokenVersion(), "tokenVersion deve ter sido incrementada de 0 para 1");

        // 5. Novo token emitido após a troca de senha DEVE funcionar
        String novoToken = jwtService.generateToken(usuarioAtualizado);
        assertEquals(1, jwtService.extractTokenVersion(novoToken));

        mockMvc.perform(get("/api/produtos")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + novoToken))
                .andExpect(status().isOk());
    }

    // =========================================================================
    // TESTE 6: TOKEN EXPIRADO CONTINUA SENDO REJEITADO
    // =========================================================================

    @Test
    @DisplayName("SEC-07 [6]: Token expirado deve ser rejeitado mesmo com tokenVersion correta")
    void shouldRejectExpiredTokenEvenWithCorrectTokenVersion() throws Exception {
        Usuario usuario = criarUsuarioTeste("usuario_expirado@oficina.com", "SenhaForte#2026");

        // Cria serviço JWT com expiração negativa (já expirado)
        JwtService expiredJwtService = new JwtService("chave-secreta-de-testes-unificados-2026-com-tamanho-seguro", -1000L);
        String expiredToken = expiredJwtService.generateToken(usuario, 0);

        mockMvc.perform(get("/api/produtos")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + expiredToken))
                .andExpect(status().isUnauthorized());
    }

    // =========================================================================
    // TESTE 7: TOKEN COM ASSINATURA INVÁLIDA É REJEITADO
    // =========================================================================

    @Test
    @DisplayName("SEC-07 [7]: Token com assinatura inválida/adulterada deve ser rejeitado")
    void shouldRejectTokenWithInvalidSignature() throws Exception {
        Usuario usuario = criarUsuarioTeste("usuario_assinatura_invalida@oficina.com", "SenhaForte#2026");

        // Token assinado com chave diferente
        JwtService outroJwtService = new JwtService("outra-chave-secreta-diferente-para-testes-de-seguranca-2026", 900000L);
        String forgedToken = outroJwtService.generateToken(usuario, 0);

        mockMvc.perform(get("/api/produtos")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + forgedToken))
                .andExpect(status().isUnauthorized());
    }

    // =========================================================================
    // TESTE 8: REFRESH TOKEN RESPEITA REVOGAÇÃO
    // =========================================================================

    @Test
    @DisplayName("SEC-07 [8]: Refresh token revogado deve ser rejeitado pelo endpoint de refresh")
    void shouldRespectRefreshTokenRevocation() throws Exception {
        Usuario usuario = criarUsuarioTeste("usuario_refresh_revogado@oficina.com", "SenhaForte#2026");

        String tokenValue = UUID.randomUUID().toString();
        RefreshToken refreshToken = new RefreshToken(usuario, tokenValue, OffsetDateTime.now().plusDays(1), false);
        refreshToken.revoke();
        refreshTokenRepository.save(refreshToken);

        Cookie refreshCookie = new Cookie("refresh_token", tokenValue);
        refreshCookie.setPath("/api/auth");
        refreshCookie.setHttpOnly(true);

        mockMvc.perform(post("/api/auth/refresh")
                        .cookie(refreshCookie))
                .andExpect(status().isUnauthorized());
    }

    // =========================================================================
    // TESTE 9: LOGOUT INVALIDA ACCESS TOKEN ATUAL (VIA INCREMENTO DE VERSÃO)
    // =========================================================================

    @Test
    @DisplayName("SEC-07 [9]: Logout invalida imediatamente o access token emitido anteriormente")
    void shouldInvalidateAccessTokenOnLogout() throws Exception {
        Usuario usuario = criarUsuarioTeste("usuario_logout_invalida@oficina.com", "SenhaForte#2026");

        String tokenAntesDoLogout = jwtService.generateToken(usuario);

        // Valida que o token funciona antes do logout
        mockMvc.perform(get("/api/produtos")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenAntesDoLogout))
                .andExpect(status().isOk());

        // Executa logout autenticado
        Cookie accessCookie = new Cookie("access_token", tokenAntesDoLogout);
        accessCookie.setPath("/");

        mockMvc.perform(post("/api/auth/logout")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenAntesDoLogout)
                        .cookie(accessCookie))
                .andExpect(status().isOk());

        // Token anterior agora DEVE ser rejeitado com 401
        mockMvc.perform(get("/api/produtos")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenAntesDoLogout))
                .andExpect(status().isUnauthorized());

        // Confirma que a versão do usuário no banco foi incrementada
        Usuario usuarioAposLogout = usuarioRepository.findById(usuario.getId()).orElseThrow();
        assertEquals(1, usuarioAposLogout.getTokenVersion());
    }

    // =========================================================================
    // TESTE 10 & 11: 2FA E REMEMBER-ME NÃO SOFREM REGRESSÃO
    // =========================================================================

    @Test
    @DisplayName("SEC-07 [10 & 11]: Fluxo 2FA emite token com versão correta e respeita remember-me")
    void shouldMaintain2FaFlowAndIssueTokenWithProperVersionAndRememberMe() throws Exception {
        Usuario usuario = criarUsuarioTeste("usuario_2fa_versao@oficina.com", "SenhaForte#2026");
        usuario.setTokenVersion(3);
        usuario = usuarioRepository.save(usuario);

        String rawCode = "123456";
        TwoFactorChallenge challenge = new TwoFactorChallenge(
                usuario,
                "challenge-token-sec07-test",
                passwordEncoder.encode(rawCode),
                OffsetDateTime.now().plusMinutes(5),
                true // remember-me true
        );
        twoFactorChallengeRepository.save(challenge);

        TwoFactorVerifyRequest verifyRequest = new TwoFactorVerifyRequest("challenge-token-sec07-test", rawCode);

        MvcResult result = mockMvc.perform(post("/api/auth/2fa/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(verifyRequest)))
                .andExpect(status().isOk())
                .andReturn();

        List<String> setCookies = result.getResponse().getHeaders(HttpHeaders.SET_COOKIE);
        String accessCookie = setCookies.stream().filter(c -> c.startsWith("access_token=")).findFirst().orElseThrow();

        // Extrai valor do token do cookie
        String tokenValue = accessCookie.substring("access_token=".length(), accessCookie.indexOf(";"));
        assertEquals(3, jwtService.extractTokenVersion(tokenValue), "O token emitido após 2FA deve conter a tokenVersion atual do usuário (3)");

        // O token emitido funciona nos endpoints protegidos
        mockMvc.perform(get("/api/produtos")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenValue))
                .andExpect(status().isOk());
    }

    // =========================================================================
    // TESTE 12: USUÁRIO AUTENTICADO ACESSA ENDPOINTS NORMALMENTE
    // =========================================================================

    @Test
    @DisplayName("SEC-07 [12]: Usuário autenticado com versão atual acessa endpoints protegidos normalmente")
    void shouldAllowAuthenticatedUserToAccessProtectedEndpoints() throws Exception {
        Usuario usuario = criarUsuarioTeste("usuario_autorizado@oficina.com", "SenhaForte#2026");
        String token = jwtService.generateToken(usuario);

        mockMvc.perform(get("/api/produtos")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/ordens-servico")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/clientes")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk());
    }
}
