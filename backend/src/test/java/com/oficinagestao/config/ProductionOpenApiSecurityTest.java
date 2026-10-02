package com.oficinagestao.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class ProductionOpenApiSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("ADC-02 (SEM PROFILE): Quando nenhum profile for informado, /swagger-ui/index.html é bloqueado (401)")
    void shouldBlockSwaggerUiWhenDisabled() throws Exception {
        mockMvc.perform(get("/swagger-ui/index.html"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("ADC-02 (SEM PROFILE): Quando nenhum profile for informado, /v3/api-docs é bloqueado (401)")
    void shouldBlockOpenApiDocsWhenDisabled() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isUnauthorized());
    }

    @Nested
    @SpringBootTest(properties = {
            "CORS_ALLOWED_ORIGINS=https://app.oficinagestao.com.br",
            "JWT_SECRET=chave-secreta-sintetica-de-testes-com-mais-de-32-caracteres-para-ci",
            "MAIL_HOST=localhost",
            "MAIL_PORT=587",
            "MAIL_USERNAME=ci-test@oficinagestao.local",
            "MAIL_PASSWORD=ci-test-fake-password",
            "MAIL_SMTP_AUTH=true",
            "MAIL_SMTP_STARTTLS=true"
    })
    @AutoConfigureMockMvc
    @ActiveProfiles("prod")
    @DisplayName("ADC-02 (PROFILE PROD): Validação com application-prod.properties ativo")
    class ProdProfileTest {

        @Autowired
        private MockMvc mockMvcProd;

        @Test
        @DisplayName("PROD: /swagger-ui/index.html bloqueado com 401 Unauthorized")
        void shouldBlockSwaggerUiInProdProfile() throws Exception {
            mockMvcProd.perform(get("/swagger-ui/index.html"))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("PROD: /v3/api-docs bloqueado com 401 Unauthorized")
        void shouldBlockOpenApiDocsInProdProfile() throws Exception {
            mockMvcProd.perform(get("/v3/api-docs"))
                    .andExpect(status().isUnauthorized());
        }
    }
}
