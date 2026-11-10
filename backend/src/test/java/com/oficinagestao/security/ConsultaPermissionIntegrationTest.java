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
}
