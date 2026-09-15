package com.oficinagestao.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.oficinagestao.dto.AuthResponse;
import com.oficinagestao.dto.CurrentUserResponse;
import com.oficinagestao.dto.LoginRequest;
import com.oficinagestao.security.JwtService;
import com.oficinagestao.service.AuthService;
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
    @DisplayName("POST /api/auth/login com credenciais válidas deve retornar 200 e definir cookie HttpOnly")
    void shouldReturn200AndSetCookieOnSuccessfulLogin() throws Exception {
        CurrentUserResponse user = new CurrentUserResponse(1L, "Proprietária", "admin@oficina.com", Set.of("ROLE_ADMIN"));
        AuthResponse authResponse = new AuthResponse("mock.jwt.token", "Bearer", 900L, user);

        when(authService.login(any(LoginRequest.class), any())).thenReturn(authResponse);

        LoginRequest request = new LoginRequest("admin@oficina.com", "SenhaForte123");

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(header().exists("Set-Cookie"))
                .andExpect(cookie().value("access_token", "mock.jwt.token"))
                .andExpect(cookie().httpOnly("access_token", true))
                .andExpect(jsonPath("$.accessToken").value("mock.jwt.token"))
                .andExpect(jsonPath("$.user.email").value("admin@oficina.com"));
    }

    @Test
    @DisplayName("POST /api/auth/login com credenciais inválidas deve retornar 401")
    void shouldReturn401OnInvalidLogin() throws Exception {
        when(authService.login(any(LoginRequest.class), any()))
                .thenThrow(new BadCredentialsException("Credenciais inválidas."));

        LoginRequest request = new LoginRequest("admin@oficina.com", "SenhaErrada");

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.message").value("Credenciais inválidas."));
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
    @DisplayName("POST /api/auth/logout deve retornar 200 e expirar o cookie")
    void shouldReturn200AndClearCookieOnLogout() throws Exception {
        mockMvc.perform(post("/api/auth/logout"))
                .andExpect(status().isOk())
                .andExpect(header().exists("Set-Cookie"))
                .andExpect(cookie().maxAge("access_token", 0));
    }
}
