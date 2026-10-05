package com.oficinagestao.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Testes forenses para validação da restrição de endpoints do Spring Boot Actuator (ADC-04).
 * Garante que somente /actuator/health esteja exposto via HTTP e que nenhum endpoint
 * sensível ou administrativo esteja acessível.
 */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
class ActuatorSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @Value("${management.endpoints.web.exposure.include:}")
    private String exposureInclude;

    @Test
    @DisplayName("ADC-04 (1): /actuator/health deve estar exposto e retornar status UP")
    void testActuatorHealthIsAvailable() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    @DisplayName("ADC-04 (2): /actuator/env NÃO deve estar exposto via HTTP")
    void testActuatorEnvNotExposed() throws Exception {
        mockMvc.perform(get("/actuator/env"))
                .andExpect(result -> {
                    int status = result.getResponse().getStatus();
                    org.junit.jupiter.api.Assertions.assertTrue(status == 401 || status == 404,
                            "Endpoint /actuator/env deveria estar bloqueado ou não mapeado, mas retornou " + status);
                });
    }

    @Test
    @DisplayName("ADC-04 (3): /actuator/beans NÃO deve estar exposto via HTTP")
    void testActuatorBeansNotExposed() throws Exception {
        mockMvc.perform(get("/actuator/beans"))
                .andExpect(result -> {
                    int status = result.getResponse().getStatus();
                    org.junit.jupiter.api.Assertions.assertTrue(status == 401 || status == 404,
                            "Endpoint /actuator/beans deveria estar bloqueado ou não mapeado, mas retornou " + status);
                });
    }

    @Test
    @DisplayName("ADC-04 (4): /actuator/mappings NÃO deve estar exposto via HTTP")
    void testActuatorMappingsNotExposed() throws Exception {
        mockMvc.perform(get("/actuator/mappings"))
                .andExpect(result -> {
                    int status = result.getResponse().getStatus();
                    org.junit.jupiter.api.Assertions.assertTrue(status == 401 || status == 404,
                            "Endpoint /actuator/mappings deveria estar bloqueado ou não mapeado, mas retornou " + status);
                });
    }

    @Test
    @DisplayName("ADC-04 (5): /actuator/metrics NÃO deve estar exposto via HTTP")
    void testActuatorMetricsNotExposed() throws Exception {
        mockMvc.perform(get("/actuator/metrics"))
                .andExpect(result -> {
                    int status = result.getResponse().getStatus();
                    org.junit.jupiter.api.Assertions.assertTrue(status == 401 || status == 404,
                            "Endpoint /actuator/metrics deveria estar bloqueado ou não mapeado, mas retornou " + status);
                });
    }

    @Test
    @DisplayName("ADC-04 (6): /actuator/loggers NÃO deve estar exposto via HTTP")
    void testActuatorLoggersNotExposed() throws Exception {
        mockMvc.perform(get("/actuator/loggers"))
                .andExpect(result -> {
                    int status = result.getResponse().getStatus();
                    org.junit.jupiter.api.Assertions.assertTrue(status == 401 || status == 404,
                            "Endpoint /actuator/loggers deveria estar bloqueado ou não mapeado, mas retornou " + status);
                });
    }

    @Test
    @DisplayName("ADC-04 (7): /actuator/heapdump NÃO deve estar exposto via HTTP")
    void testActuatorHeapdumpNotExposed() throws Exception {
        mockMvc.perform(get("/actuator/heapdump"))
                .andExpect(result -> {
                    int status = result.getResponse().getStatus();
                    org.junit.jupiter.api.Assertions.assertTrue(status == 401 || status == 404,
                            "Endpoint /actuator/heapdump deveria estar bloqueado ou não mapeado, mas retornou " + status);
                });
    }

    @Test
    @DisplayName("ADC-04 (8): /actuator/threaddump NÃO deve estar exposto via HTTP")
    void testActuatorThreaddumpNotExposed() throws Exception {
        mockMvc.perform(get("/actuator/threaddump"))
                .andExpect(result -> {
                    int status = result.getResponse().getStatus();
                    org.junit.jupiter.api.Assertions.assertTrue(status == 401 || status == 404,
                            "Endpoint /actuator/threaddump deveria estar bloqueado ou não mapeado, mas retornou " + status);
                });
    }

    @Test
    @DisplayName("ADC-04 (9): /actuator/shutdown NÃO deve estar exposto via HTTP")
    void testActuatorShutdownNotExposed() throws Exception {
        mockMvc.perform(post("/actuator/shutdown"))
                .andExpect(result -> {
                    int status = result.getResponse().getStatus();
                    org.junit.jupiter.api.Assertions.assertTrue(status == 401 || status == 404,
                            "Endpoint /actuator/shutdown deveria estar bloqueado ou não mapeado, mas retornou " + status);
                });
    }

    @Test
    @DisplayName("ADC-04 (10): /actuator/info NÃO deve estar exposto via HTTP")
    void testActuatorInfoNotExposed() throws Exception {
        mockMvc.perform(get("/actuator/info"))
                .andExpect(result -> {
                    int status = result.getResponse().getStatus();
                    org.junit.jupiter.api.Assertions.assertTrue(status == 401 || status == 404,
                            "Endpoint /actuator/info deveria estar bloqueado ou não mapeado, mas retornou " + status);
                });
    }

    @Test
    @DisplayName("ADC-04: management.endpoints.web.exposure.include deve ser estritamente 'health' e nunca '*'")
    void testActuatorConfigurationIsStrictlyHealth() {
        assertEquals("health", exposureInclude.trim(),
                "A configuração de exposição web do Actuator deve ser exatamente 'health'");
        assertNotEquals("*", exposureInclude.trim(),
                "A configuração de exposição web do Actuator NUNCA deve ser wildcard '*'");
    }
}
