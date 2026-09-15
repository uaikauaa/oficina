package com.oficinagestao.common;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class SystemControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("GET /api/system/status autenticado com ROLE_ADMIN deve retornar 200 com informações operacionais seguras")
    @WithMockUser(username = "admin@oficina.com", authorities = {"ROLE_ADMIN"})
    void shouldReturnSystemStatusWhenAuthenticatedAsAdmin() throws Exception {
        mockMvc.perform(get("/api/system/status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("OPERATIONAL"))
                .andExpect(jsonPath("$.environment").value("development"))
                .andExpect(jsonPath("$.authenticatedUser").value("admin@oficina.com"))
                .andExpect(jsonPath("$.timestamp").isNotEmpty());
    }

    @Test
    @DisplayName("GET /api/system/status sem autenticação deve retornar 401 Unauthorized")
    void shouldReturn401WhenUnauthenticated() throws Exception {
        mockMvc.perform(get("/api/system/status"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.error").value("UNAUTHORIZED"))
                .andExpect(jsonPath("$.message").value("Acesso não autorizado. Autenticação necessária."))
                .andExpect(jsonPath("$.path").value("/api/system/status"));
    }

    @Test
    @DisplayName("GET /api/system/status com autoridade insuficiente deve retornar 403 Forbidden")
    @WithMockUser(username = "user@oficina.com", authorities = {"ROLE_MECANICO"})
    void shouldReturn403WhenInsufficientPermissions() throws Exception {
        mockMvc.perform(get("/api/system/status"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.error").value("FORBIDDEN"))
                .andExpect(jsonPath("$.message").value("Acesso negado. Permissão insuficiente."))
                .andExpect(jsonPath("$.path").value("/api/system/status"));
    }
}
