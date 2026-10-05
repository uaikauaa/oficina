package com.oficinagestao.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.oficinagestao.dto.*;
import com.oficinagestao.service.AuthService;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private AuthService authService;

    @Test
    @DisplayName("POST /api/auth/login com credenciais válidas deve retornar 200 com desafio 2FA e NÃO DEVE emitir cookies ou tokens")
    void shouldReturn200AndChallengeWithoutAnyCookiesOrTokensOnLogin() throws Exception {
        LoginChallengeResponse challengeResponse = new LoginChallengeResponse(true, "mock-challenge-token", "Se as credenciais forem válidas, um código de verificação foi enviado.");

        when(authService.login(any(LoginRequest.class), any())).thenReturn(challengeResponse);

        LoginRequest request = new LoginRequest("admin@oficina.com", "SenhaForte123", true);

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(header().doesNotExist("Set-Cookie"))
                .andExpect(cookie().doesNotExist("access_token"))
                .andExpect(cookie().doesNotExist("refresh_token"))
                .andExpect(jsonPath("$.twoFactorRequired").value(true))
                .andExpect(jsonPath("$.challengeToken").value("mock-challenge-token"))
                .andExpect(jsonPath("$.mensagem").value("Se as credenciais forem válidas, um código de verificação foi enviado."))
                .andExpect(jsonPath("$.accessToken").doesNotExist())
                .andExpect(jsonPath("$.refreshToken").doesNotExist())
                .andExpect(jsonPath("$.token").doesNotExist())
                .andExpect(jsonPath("$.user").doesNotExist());
    }

    @Test
    @DisplayName("POST /api/auth/login omitindo rememberMe deve interpretar como falso no LoginRequest")
    void shouldDefaultRememberMeToFalseWhenFieldIsOmitted() throws Exception {
        LoginChallengeResponse challengeResponse = new LoginChallengeResponse(true, "mock-challenge-token", "Se as credenciais forem válidas, um código de verificação foi enviado.");

        org.mockito.ArgumentCaptor<LoginRequest> captor = org.mockito.ArgumentCaptor.forClass(LoginRequest.class);
        when(authService.login(captor.capture(), any())).thenReturn(challengeResponse);

        String jsonSemRememberMe = "{\"email\":\"admin@oficina.com\",\"senha\":\"SenhaForte123\"}";

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonSemRememberMe))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.twoFactorRequired").value(true));

        org.junit.jupiter.api.Assertions.assertFalse(captor.getValue().isRememberMe());
    }

    @Test
    @DisplayName("POST /api/auth/login com credenciais inválidas deve retornar 401 com ApiErrorResponse")
    void shouldReturn401OnInvalidLogin() throws Exception {
        when(authService.login(any(LoginRequest.class), any()))
                .thenThrow(new BadCredentialsException("Credenciais inválidas."));

        LoginRequest request = new LoginRequest("admin@oficina.com", "SenhaErrada", false);

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.error").value("UNAUTHORIZED"))
                .andExpect(jsonPath("$.message").value("Credenciais inválidas."));
    }

    @Test
    @DisplayName("POST /api/auth/2fa/verify com código válido e rememberMe=true deve emitir cookies persistentes e retornar 200")
    void shouldSetPersistentCookiesOnSuccessfulTwoFactorVerification() throws Exception {
        CurrentUserResponse user = new CurrentUserResponse(1L, "Proprietária", "admin@oficina.com", Set.of("ROLE_ADMIN"));
        LoginResult loginResult = new LoginResult("mock.jwt.token", "mock.refresh.token", 900L, 604800L, user, true);

        when(authService.verificarTwoFactor(any(TwoFactorVerifyRequest.class), any())).thenReturn(loginResult);

        TwoFactorVerifyRequest request = new TwoFactorVerifyRequest("mock-challenge-token", "123456");

        mockMvc.perform(post("/api/auth/2fa/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(header().exists("Set-Cookie"))
                .andExpect(cookie().value("access_token", "mock.jwt.token"))
                .andExpect(cookie().httpOnly("access_token", true))
                .andExpect(cookie().maxAge("access_token", 900))
                .andExpect(cookie().value("refresh_token", "mock.refresh.token"))
                .andExpect(cookie().httpOnly("refresh_token", true))
                .andExpect(cookie().maxAge("refresh_token", 604800))
                .andExpect(cookie().path("refresh_token", "/api/auth"))
                .andExpect(jsonPath("$.accessToken").doesNotExist())
                .andExpect(jsonPath("$.refreshToken").doesNotExist())
                .andExpect(jsonPath("$.token").doesNotExist())
                .andExpect(jsonPath("$.user.id").value(1))
                .andExpect(jsonPath("$.user.email").value("admin@oficina.com"))
                .andExpect(jsonPath("$.user.nome").value("Proprietária"));
    }

    @Test
    @DisplayName("HARD-01: Configuração de produção aplica Secure aos cookies access e refresh")
    void shouldSetSecureAuthenticationCookiesWhenProductionConfigurationIsEnabled() {
        CurrentUserResponse user = new CurrentUserResponse(1L, "Proprietária", "admin@oficina.com", Set.of("ROLE_ADMIN"));
        LoginResult loginResult = new LoginResult("mock.jwt.token", "mock.refresh.token", 900L, 604800L, user, true);
        when(authService.verificarTwoFactor(any(TwoFactorVerifyRequest.class), any())).thenReturn(loginResult);

        AuthController productionController = new AuthController(authService, true);
        ResponseEntity<LoginResponse> response = productionController.verifyTwoFactor(
                new TwoFactorVerifyRequest("mock-challenge-token", "123456"),
                new org.springframework.mock.web.MockHttpServletRequest()
        );

        List<String> cookies = response.getHeaders().get(HttpHeaders.SET_COOKIE);
        assertTrue(cookies != null && cookies.size() == 2);
        assertTrue(cookies.stream().anyMatch(cookie -> cookie.startsWith("access_token=")
                && cookie.contains("HttpOnly") && cookie.contains("Secure")
                && cookie.contains("SameSite=Lax") && cookie.contains("Path=/")));
        assertTrue(cookies.stream().anyMatch(cookie -> cookie.startsWith("refresh_token=")
                && cookie.contains("HttpOnly") && cookie.contains("Secure")
                && cookie.contains("SameSite=Strict") && cookie.contains("Path=/api/auth")));
    }

    @Test
    @DisplayName("POST /api/auth/2fa/verify com código válido e rememberMe=false deve emitir cookies de sessão (maxAge -1)")
    void shouldSetSessionCookiesOnTwoFactorVerificationWhenRememberMeIsFalse() throws Exception {
        CurrentUserResponse user = new CurrentUserResponse(1L, "Proprietária", "admin@oficina.com", Set.of("ROLE_ADMIN"));
        LoginResult loginResult = new LoginResult("mock.jwt.token", "mock.refresh.token", 900L, 86400L, user, false);

        when(authService.verificarTwoFactor(any(TwoFactorVerifyRequest.class), any())).thenReturn(loginResult);

        TwoFactorVerifyRequest request = new TwoFactorVerifyRequest("mock-challenge-token", "654321");

        mockMvc.perform(post("/api/auth/2fa/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(cookie().value("refresh_token", "mock.refresh.token"))
                .andExpect(cookie().maxAge("refresh_token", -1))
                .andExpect(cookie().maxAge("access_token", -1));
    }

    @Test
    @DisplayName("POST /api/auth/2fa/verify com código incorreto ou expirado deve retornar 401")
    void shouldReturn401OnInvalidTwoFactorCode() throws Exception {
        when(authService.verificarTwoFactor(any(TwoFactorVerifyRequest.class), any()))
                .thenThrow(new BadCredentialsException("Código de verificação incorreto. Você tem mais 4 tentativa(s)."));

        TwoFactorVerifyRequest request = new TwoFactorVerifyRequest("mock-challenge-token", "000000");

        mockMvc.perform(post("/api/auth/2fa/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.message").value("Código de verificação incorreto. Você tem mais 4 tentativa(s)."));
    }

    @Test
    @DisplayName("POST /api/auth/2fa/resend deve reenviar código com sucesso e retornar 200")
    void shouldResendTwoFactorCodeSuccessfully() throws Exception {
        LoginChallengeResponse challengeResponse = new LoginChallengeResponse(true, "new-challenge-token", "Novo código de verificação enviado para o seu e-mail.");

        when(authService.reenviarTwoFactor(any(TwoFactorResendRequest.class), any())).thenReturn(challengeResponse);

        TwoFactorResendRequest request = new TwoFactorResendRequest("mock-challenge-token");

        mockMvc.perform(post("/api/auth/2fa/resend")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.twoFactorRequired").value(true))
                .andExpect(jsonPath("$.challengeToken").value("new-challenge-token"))
                .andExpect(header().doesNotExist("Set-Cookie"));
    }

    @Test
    @DisplayName("POST /api/auth/2fa/resend durante cooldown deve retornar 400")
    void shouldReturn400WhenResendingDuringCooldown() throws Exception {
        when(authService.reenviarTwoFactor(any(TwoFactorResendRequest.class), any()))
                .thenThrow(new com.oficinagestao.exception.BusinessException("Aguarde alguns instantes antes de solicitar um novo código."));

        TwoFactorResendRequest request = new TwoFactorResendRequest("mock-challenge-token");

        mockMvc.perform(post("/api/auth/2fa/resend")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.message").value("Aguarde alguns instantes antes de solicitar um novo código."));
    }

    @Test
    @DisplayName("VULN-02: POST /api/auth/2fa/resend com desafio revogado ou expirado deve retornar 401")
    void shouldReturn401WhenResendingWithRevokedOrExpiredChallenge() throws Exception {
        when(authService.reenviarTwoFactor(any(TwoFactorResendRequest.class), any()))
                .thenThrow(new BadCredentialsException("Desafio inválido ou expirado."));

        TwoFactorResendRequest request = new TwoFactorResendRequest("revoked-or-expired-token");

        mockMvc.perform(post("/api/auth/2fa/resend")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.message").value("Desafio inválido ou expirado."));
    }

    @Test
    @DisplayName("POST /api/auth/refresh com refresh token persistente deve manter cookies persistentes")
    void shouldRotateWithPersistentCookiesWhenRefreshSessionIsPersistent() throws Exception {
        CurrentUserResponse user = new CurrentUserResponse(1L, "Proprietária", "admin@oficina.com", Set.of("ROLE_ADMIN"));
        LoginResult refreshResult = new LoginResult("new.jwt.token", "new.refresh.token", 900L, 604800L, user, true);

        when(authService.refresh(eq("valid-persistent-token"), any())).thenReturn(refreshResult);

        mockMvc.perform(post("/api/auth/refresh")
                        .cookie(new Cookie("refresh_token", "valid-persistent-token")))
                .andExpect(status().isOk())
                .andExpect(header().exists("Set-Cookie"))
                .andExpect(cookie().value("access_token", "new.jwt.token"))
                .andExpect(cookie().value("refresh_token", "new.refresh.token"))
                .andExpect(cookie().maxAge("refresh_token", 604800))
                .andExpect(cookie().maxAge("access_token", 900));
    }

    @Test
    @DisplayName("POST /api/auth/refresh com refresh token temporário deve manter cookies de sessão (maxAge -1)")
    void shouldRotateWithSessionCookiesWhenRefreshSessionIsTemporary() throws Exception {
        CurrentUserResponse user = new CurrentUserResponse(1L, "Proprietária", "admin@oficina.com", Set.of("ROLE_ADMIN"));
        LoginResult refreshResult = new LoginResult("new.jwt.token", "new.refresh.token", 900L, 86400L, user, false);

        when(authService.refresh(eq("valid-temp-token"), any())).thenReturn(refreshResult);

        mockMvc.perform(post("/api/auth/refresh")
                        .cookie(new Cookie("refresh_token", "valid-temp-token")))
                .andExpect(status().isOk())
                .andExpect(header().exists("Set-Cookie"))
                .andExpect(cookie().value("access_token", "new.jwt.token"))
                .andExpect(cookie().value("refresh_token", "new.refresh.token"))
                .andExpect(cookie().maxAge("refresh_token", -1))
                .andExpect(cookie().maxAge("access_token", -1));
    }

    @Test
    @DisplayName("POST /api/auth/refresh com refresh token válido deve rotacionar cookies e retornar 200")
    void shouldReturn200AndRotateCookiesOnSuccessfulRefresh() throws Exception {
        CurrentUserResponse user = new CurrentUserResponse(1L, "Proprietária", "admin@oficina.com", Set.of("ROLE_ADMIN"));
        LoginResult refreshResult = new LoginResult("new.jwt.token", "new.refresh.token", 900L, 604800L, user, true);

        when(authService.refresh(eq("valid-refresh-token"), any())).thenReturn(refreshResult);

        mockMvc.perform(post("/api/auth/refresh")
                        .cookie(new Cookie("refresh_token", "valid-refresh-token")))
                .andExpect(status().isOk())
                .andExpect(header().exists("Set-Cookie"))
                .andExpect(cookie().value("access_token", "new.jwt.token"))
                .andExpect(cookie().value("refresh_token", "new.refresh.token"))
                .andExpect(cookie().httpOnly("refresh_token", true))
                .andExpect(jsonPath("$.accessToken").doesNotExist())
                .andExpect(jsonPath("$.user.email").value("admin@oficina.com"));
    }

    @Test
    @DisplayName("POST /api/auth/refresh com token inválido deve retornar 401")
    void shouldReturn401WhenRefreshTokenIsInvalid() throws Exception {
        when(authService.refresh(eq("invalid-token"), any()))
                .thenThrow(new BadCredentialsException("Refresh token não encontrado."));

        mockMvc.perform(post("/api/auth/refresh")
                        .cookie(new Cookie("refresh_token", "invalid-token")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401));
    }

    @Test
    @DisplayName("POST /api/auth/refresh sem cookie deve retornar 401")
    void shouldReturn401WhenRefreshTokenMissing() throws Exception {
        when(authService.refresh(isNull(), any()))
                .thenThrow(new BadCredentialsException("Refresh token ausente ou inválido."));

        mockMvc.perform(post("/api/auth/refresh"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401));
    }

    @Test
    @DisplayName("GET /api/auth/me sem autenticação deve retornar 401")
    void shouldReturn401WhenNotAuthenticated() throws Exception {
        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("GET /api/auth/me autenticado com ROLE_ADMIN deve retornar 200 com dados da usuária")
    @WithMockUser(username = "admin@oficina.com", authorities = {"ROLE_ADMIN"})
    void shouldReturn200WhenAuthenticated() throws Exception {
        CurrentUserResponse user = new CurrentUserResponse(1L, "Proprietária", "admin@oficina.com", Set.of("ROLE_ADMIN"));
        when(authService.getCurrentUser("admin@oficina.com")).thenReturn(user);

        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nome").value("Proprietária"))
                .andExpect(jsonPath("$.email").value("admin@oficina.com"))
                .andExpect(jsonPath("$.roles[0]").value("ROLE_ADMIN"));
    }

    @Test
    @DisplayName("POST /api/auth/logout deve retornar 200 e expirar ambos os cookies")
    void shouldReturn200AndClearBothCookiesOnLogout() throws Exception {
        mockMvc.perform(post("/api/auth/logout")
                        .cookie(new Cookie("refresh_token", "active-refresh-token")))
                .andExpect(status().isOk())
                .andExpect(header().exists("Set-Cookie"))
                .andExpect(cookie().maxAge("access_token", 0))
                .andExpect(cookie().maxAge("refresh_token", 0));

        verify(authService).logout(isNull(), eq("active-refresh-token"), any());
    }

    @Test
    @DisplayName("PUT /api/auth/alterar-senha sem autenticação deve retornar 401")
    void shouldReturn401WhenNotAuthenticatedOnAlterarSenha() throws Exception {
        AlterarSenhaRequest request = new AlterarSenhaRequest("SenhaAtual@123", "NovaSenha@1234", "NovaSenha@1234");

        mockMvc.perform(put("/api/auth/alterar-senha")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("PUT /api/auth/alterar-senha autenticado com dados válidos deve retornar 200 e mensagem de sucesso")
    @WithMockUser(username = "admin@oficina.com", authorities = {"ROLE_ADMIN"})
    void shouldReturn200OnSuccessfulAlterarSenha() throws Exception {
        AlterarSenhaRequest request = new AlterarSenhaRequest("SenhaAtual@123", "NovaSenha@1234", "NovaSenha@1234");

        mockMvc.perform(put("/api/auth/alterar-senha")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Senha alterada com sucesso."));

        verify(authService).alterarSenha(eq("admin@oficina.com"), any(AlterarSenhaRequest.class), any());
    }

    @Test
    @DisplayName("PUT /api/auth/alterar-senha com senha atual incorreta deve retornar 400")
    @WithMockUser(username = "admin@oficina.com", authorities = {"ROLE_ADMIN"})
    void shouldReturn400WhenCurrentPasswordIsIncorrect() throws Exception {
        org.mockito.Mockito.doThrow(new com.oficinagestao.exception.BusinessException("Senha atual incorreta."))
                .when(authService).alterarSenha(eq("admin@oficina.com"), any(AlterarSenhaRequest.class), any());

        AlterarSenhaRequest request = new AlterarSenhaRequest("SenhaErrada@123", "NovaSenha@1234", "NovaSenha@1234");

        mockMvc.perform(put("/api/auth/alterar-senha")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Senha atual incorreta."));
    }
}
