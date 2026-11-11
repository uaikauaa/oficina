package com.oficinagestao.security;

import com.oficinagestao.entity.Role;
import com.oficinagestao.entity.Usuario;
import com.oficinagestao.repository.RoleRepository;
import com.oficinagestao.repository.UsuarioRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc(print = org.springframework.boot.webmvc.test.autoconfigure.MockMvcPrint.NONE)
class ConsultaPermissionIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired UsuarioRepository users;
    @Autowired RoleRepository roles;
    @Autowired JwtService jwt;

    private Usuario create(String roleName) {
        Role role = roles.findByNome(roleName).orElseThrow();
        Usuario user = new Usuario("Synthetic RBAC", UUID.randomUUID() + "@example.invalid", "unused", true);
        user.addRole(role);
        return users.saveAndFlush(user);
    }

    private int status(Usuario user, String path) throws Exception {
        return mvc.perform(get(path).header("Authorization", "Bearer " + jwt.generateToken(user)))
                .andReturn().getResponse().getStatus();
    }

    private int configurationUpdateStatus(Usuario user) throws Exception {
        return mvc.perform(put("/api/configuracao-oficina")
                .header("Authorization", "Bearer " + jwt.generateToken(user))
                .contentType("application/json")
                .content("{\"nomeFantasia\":\"Oficina Sintetica\"}"))
                .andReturn().getResponse().getStatus();
    }

    @Test
    @Transactional
    void consultaHasOnlyReviewedCatalogReadsAndCannotSeeFinancialOrAdministration() throws Exception {
        Usuario consulta = create("ROLE_CONSULTA");
        Set<String> grants = consulta.getRoles().iterator().next().getPermissoes().stream()
                .map(p -> p.getCodigo()).collect(Collectors.toSet());
        assertEquals(Set.of("categorias.ativas.get", "categorias.get", "categorias.id.get",
                "clientes.get", "clientes.id.get", "fornecedores.get", "fornecedores.id.get",
                "maquinas.get", "maquinas.id.get"), grants);
        assertEquals(200, status(consulta, "/api/categorias"));
        assertEquals(200, status(consulta, "/api/clientes"));
        for (String path : Set.of("/api/relatorios/ordens-servico", "/api/relatorios/estoque",
                "/api/configuracao-oficina", "/api/produtos", "/api/ordens-servico",
                "/api/admin/usuarios", "/api/admin/auditoria")) {
            assertEquals(403, status(consulta, path), path);
        }
    }

    @Test
    @Transactional
    void operatorAndSuperAdminRetainOperationalGrantsAndOnlySuperAdminHasAdminGrants() throws Exception {
        Usuario operator = create("ROLE_OPERADOR_GERAL");
        Usuario superAdmin = create("ROLE_SUPER_ADMIN");
        for (String path : Set.of("/api/clientes", "/api/produtos", "/api/ordens-servico",
                "/api/relatorios/ordens-servico", "/api/configuracao-oficina")) {
            assertEquals(200, status(operator, path), path);
            assertEquals(200, status(superAdmin, path), path);
        }
        assertEquals(403, status(operator, "/api/admin/usuarios"));
        assertEquals(200, status(superAdmin, "/api/admin/usuarios"));
        assertEquals(200, status(superAdmin, "/api/admin/papeis"));
        assertEquals(200, configurationUpdateStatus(operator));
        assertEquals(200, configurationUpdateStatus(superAdmin));
    }

    @Test
    @Transactional
    void consultaReceivesMinimizedClientFieldsWhileOperatorRetainsOperationalContact() throws Exception {
        Usuario operator = create("ROLE_OPERADOR_GERAL");
        Usuario consulta = create("ROLE_CONSULTA");
        String privateEmail = "private-" + UUID.randomUUID() + "@example.invalid";
        var created = mvc.perform(post("/api/clientes")
                .header("Authorization", "Bearer " + jwt.generateToken(operator))
                .contentType("application/json")
                .content("{\"tipoPessoa\":\"FISICA\",\"nomeRazaoSocial\":\"Cliente consulta sintético\","
                        + "\"email\":\"" + privateEmail + "\"}"))
                .andReturn().getResponse();
        assertEquals(201, created.getStatus(), created.getContentAsString());
        long id = new com.fasterxml.jackson.databind.ObjectMapper().readTree(created.getContentAsString())
                .path("id").asLong();
        var operatorResponse = mvc.perform(get("/api/clientes/" + id)
                .header("Authorization", "Bearer " + jwt.generateToken(operator)))
                .andReturn().getResponse();
        assertTrue(operatorResponse.getContentAsString().contains(privateEmail));
        var consultaResponse = mvc.perform(get("/api/clientes/" + id)
                .header("Authorization", "Bearer " + jwt.generateToken(consulta)))
                .andReturn().getResponse();
        assertEquals(200, consultaResponse.getStatus());
        assertFalse(consultaResponse.getContentAsString().contains(privateEmail));
        assertTrue(consultaResponse.getContentAsString().contains("Cliente consulta sintético"));
    }
    @Test
    @Transactional
    void consultaAddedToOperatorDoesNotRemoveOperationalContactAccess() throws Exception {
        Usuario operator = create("ROLE_OPERADOR_GERAL");
        operator.addRole(roles.findByNome("ROLE_CONSULTA").orElseThrow());
        operator = users.saveAndFlush(operator);
        String privateEmail = "private-" + UUID.randomUUID() + "@example.invalid";
        var created = mvc.perform(post("/api/clientes")
                .header("Authorization", "Bearer " + jwt.generateToken(operator))
                .contentType("application/json")
                .content("{\"tipoPessoa\":\"FISICA\",\"nomeRazaoSocial\":\"Cliente conjunto\","
                        + "\"email\":\"" + privateEmail + "\"}"))
                .andReturn().getResponse();
        assertEquals(201, created.getStatus(), created.getContentAsString());
        long id = new com.fasterxml.jackson.databind.ObjectMapper().readTree(created.getContentAsString())
                .path("id").asLong();
        var response = mvc.perform(get("/api/clientes/" + id)
                .header("Authorization", "Bearer " + jwt.generateToken(operator)))
                .andReturn().getResponse();
        assertEquals(200, response.getStatus());
        assertTrue(response.getContentAsString().contains(privateEmail));
    }
}
