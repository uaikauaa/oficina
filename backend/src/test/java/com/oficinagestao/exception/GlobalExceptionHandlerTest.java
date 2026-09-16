package com.oficinagestao.exception;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class GlobalExceptionHandlerTest {

    @Autowired
    private MockMvc mockMvc;

    @TestConfiguration
    static class ExceptionTestEndpointsConfig {
        @RestController
        @RequestMapping("/api/test-exceptions")
        static class TestExceptionController {
            @GetMapping("/not-found")
            public void throwNotFound() {
                throw new ResourceNotFoundException("Cliente com ID 42 não localizado.");
            }

            @GetMapping("/conflict")
            public void throwConflict() {
                throw new ConflictException("Já existe um cliente cadastrado com o CPF informado.");
            }

            @GetMapping("/business")
            public void throwBusiness() {
                throw new BusinessException("Não é possível aprovar orçamento com valor zerado.");
            }

            @GetMapping("/internal")
            public void throwInternal() {
                throw new RuntimeException("Falha inesperada de I/O de teste");
            }

            @GetMapping("/data-integrity")
            public void throwDataIntegrity() {
                throw new org.springframework.dao.DataIntegrityViolationException("violacao de chave única de teste");
            }
        }
    }

    @Test
    @DisplayName("Deve retornar 400 com detalhes de validação ao enviar corpo inválido no login")
    void shouldReturn400ValidationDetails() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"email-invalido\",\"senha\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.message").isNotEmpty())
                .andExpect(jsonPath("$.details").isArray())
                .andExpect(jsonPath("$.timestamp").isNotEmpty())
                .andExpect(jsonPath("$.path").value("/api/auth/login"));
    }

    @Test
    @DisplayName("Deve retornar 400 BAD_REQUEST ao enviar JSON malformado")
    void shouldReturn400OnMalformedJson() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{malformed-json"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.error").value("BAD_REQUEST"));
    }

    @Test
    @DisplayName("Deve retornar 404 NOT_FOUND para ResourceNotFoundException")
    @WithMockUser(authorities = {"ROLE_ADMIN"})
    void shouldReturn404OnResourceNotFound() throws Exception {
        mockMvc.perform(get("/api/test-exceptions/not-found"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.error").value("NOT_FOUND"))
                .andExpect(jsonPath("$.message").value("Cliente com ID 42 não localizado."))
                .andExpect(jsonPath("$.path").value("/api/test-exceptions/not-found"));
    }

    @Test
    @DisplayName("Deve retornar 409 CONFLICT para ConflictException")
    @WithMockUser(authorities = {"ROLE_ADMIN"})
    void shouldReturn409OnConflict() throws Exception {
        mockMvc.perform(get("/api/test-exceptions/conflict"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.error").value("CONFLICT"))
                .andExpect(jsonPath("$.message").value("Já existe um cliente cadastrado com o CPF informado."));
    }

    @Test
    @DisplayName("Deve retornar 400 BUSINESS_ERROR para BusinessException")
    @WithMockUser(authorities = {"ROLE_ADMIN"})
    void shouldReturn400OnBusinessException() throws Exception {
        mockMvc.perform(get("/api/test-exceptions/business"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.error").value("BUSINESS_ERROR"))
                .andExpect(jsonPath("$.message").value("Não é possível aprovar orçamento com valor zerado."));
    }

    @Test
    @DisplayName("Deve retornar 500 INTERNAL_ERROR genérico sem expor stack trace em erros inesperados")
    @WithMockUser(authorities = {"ROLE_ADMIN"})
    void shouldReturn500WithoutStackTrace() throws Exception {
        mockMvc.perform(get("/api/test-exceptions/internal"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.status").value(500))
                .andExpect(jsonPath("$.error").value("INTERNAL_ERROR"))
                .andExpect(jsonPath("$.message").value("Ocorreu um erro interno no servidor."))
                .andExpect(jsonPath("$.stackTrace").doesNotExist())
                .andExpect(jsonPath("$.trace").doesNotExist());
    }

    @Test
    @DisplayName("RISK-002: Deve retornar 409 CONFLICT para DataIntegrityViolationException")
    @WithMockUser(authorities = {"ROLE_ADMIN"})
    void shouldReturn409OnDataIntegrityViolation() throws Exception {
        mockMvc.perform(get("/api/test-exceptions/data-integrity"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.error").value("CONFLICT"))
                .andExpect(jsonPath("$.message").value("Conflito de integridade de dados ou registro duplicado."));
    }
}
