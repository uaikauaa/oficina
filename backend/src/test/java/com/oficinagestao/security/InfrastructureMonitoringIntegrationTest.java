package com.oficinagestao.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
class InfrastructureMonitoringIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;

    @Test void onlyDelegatedPermissionCanReadTruthfulBoundedSnapshot() throws Exception {
        String path = "/api/admin/infraestrutura";
        assertEquals(401, mvc.perform(get(path)).andReturn().getResponse().getStatus());
        assertEquals(403, mvc.perform(get(path).with(user("operator").roles("ADMIN")))
                .andReturn().getResponse().getStatus());
        var authorized = user("admin").authorities(new SimpleGrantedAuthority("PERM_infraestrutura.visualizar"));
        var first = mvc.perform(get(path).with(authorized).accept(MediaType.APPLICATION_JSON)).andReturn().getResponse();
        assertEquals(200, first.getStatus());
        JsonNode body = mapper.readTree(first.getContentAsString());
        assertEquals("local", body.path("databaseProvider").asText());
        assertEquals("conectado", body.path("connectionStatus").asText());
        assertTrue(body.path("database").path("tamanhoLogicoBytes").path("value").asLong() > 0);
        assertEquals("medido", body.path("database").path("tamanhoLogicoBytes").path("status").asText());
        assertTrue(body.path("neon").path("armazenamentoFaturadoBytes").path("value").isNull());
        assertTrue(body.path("googleCloud").path("custoEstimado").path("value").isNull());
        var second = mvc.perform(get(path).with(authorized)).andReturn().getResponse();
        assertEquals(body.path("collectedAt").asText(), mapper.readTree(second.getContentAsString())
                .path("collectedAt").asText(), "cached result must avoid repeated provider calls");
    }

    @Test void administrativeSummaryRequiresReadGrantAndUsesRealCounts() throws Exception {
        String path = "/api/admin/resumo";
        assertEquals(403, mvc.perform(get(path).with(user("operator").roles("ADMIN")))
                .andReturn().getResponse().getStatus());
        var response = mvc.perform(get(path).with(user("admin").authorities(
                new SimpleGrantedAuthority("PERM_usuarios.visualizar")))).andReturn().getResponse();
        assertEquals(200, response.getStatus());
        JsonNode body = mapper.readTree(response.getContentAsString());
        assertEquals(body.path("usuarios").asLong(), body.path("ativos").asLong() + body.path("inativos").asLong());
        assertTrue(body.path("eventosRecentes").size() <= 5);
        assertEquals("local", body.path("origemBanco").asText());
    }
}
