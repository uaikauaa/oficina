package com.oficinagestao.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.oficinagestao.security.JwtService;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Set;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private AuthService authService;

    @Autowired
    private JwtService jwtService;

    @Test
    @DisplayName("POST /api/auth/login com credenciais válidas deve retornar 200, definir ambos os cookies e não expor JWT no body")
    void shouldReturn200AndSetBothCookiesWithoutAccessTokenInBodyOnSuccessfulLogin() throws Exception {
        CurrentUserResponse user = new CurrentUserResponse(1L, "Proprietária", "admin@oficina.com", Set.of("ROLE_ADMIN"));
        LoginResult loginResult = new LoginResult("mock.jwt.token", "mock.refresh.token", 900L, 604800L, user);

        when(authService.login(any(LoginRequest.class), any())).thenReturn(loginResult);

        LoginRequest request = new LoginRequest("admin@oficina.com", "SenhaForte123");

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(header().exists("Set-Cookie"))
                .andExpect(cookie().value("access_token", "mock.jwt.token"))
                .andExpect(cookie().httpOnly("access_token", true))
                .andExpect(cookie().value("refresh_token", "mock.refresh.token"))
                .andExpect(cookie().httpOnly("refresh_token", true))
                .andExpect(cookie().path("refresh_token", "/api/auth"))
                .andExpect(jsonPath("$.accessToken").doesNotExist())
                .andExpect(jsonPath("$.token").doesNotExist())
                .andExpect(jsonPath("$.user.id").value(1))
                .andExpect(jsonPath("$.user.email").value("admin@oficina.com"))
                .andExpect(jsonPath("$.user.nome").value("Proprietária"));
    }

    @Test
    @DisplayName("POST /api/auth/login com credenciais inválidas deve retornar 401 com ApiErrorResponse")
    void shouldReturn401OnInvalidLogin() throws Exception {
        when(authService.login(any(LoginRequest.class), any()))
                .thenThrow(new BadCredentialsException("Credenciais inválidas."));

        LoginRequest request = new LoginRequest("admin@oficina.com", "SenhaErrada");

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.error").value("UNAUTHORIZED"))
                .andExpect(jsonPath("$.message").value("Credenciais inválidas."));
    }

    @Test
    @DisplayName("POST /api/auth/refresh com refresh token válido deve rotacionar cookies e retornar 200")
    void shouldReturn200AndRotateCookiesOnSuccessfulRefresh() throws Exception {
        CurrentUserResponse user = new CurrentUserResponse(1L, "Proprietária", "admin@oficina.com", Set.of("ROLE_ADMIN"));
        LoginResult refreshResult = new LoginResult("new.jwt.token", "new.refresh.token", 900L, 604800L, user);

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
}
