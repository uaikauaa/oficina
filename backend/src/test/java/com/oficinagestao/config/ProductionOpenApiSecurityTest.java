package com.oficinagestao.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "springdoc.swagger-ui.enabled=false",
        "springdoc.api-docs.enabled=false"
})
class ProductionOpenApiSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("PROD001-09: Quando Swagger estiver desabilitado, /swagger-ui/index.html não deve ser público (401 Unauthorized)")
    void shouldBlockSwaggerUiWhenDisabled() throws Exception {
        mockMvc.perform(get("/swagger-ui/index.html"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("PROD001-09: Quando OpenAPI estiver desabilitado, /v3/api-docs não deve ser público (401 Unauthorized)")
    void shouldBlockOpenApiDocsWhenDisabled() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isUnauthorized());
    }
}
