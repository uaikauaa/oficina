package com.oficinagestao.security;

import com.oficinagestao.entity.Role;
import com.oficinagestao.entity.Usuario;
import com.oficinagestao.repository.RoleRepository;
import com.oficinagestao.repository.UsuarioRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpMethod;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;

@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc(print = org.springframework.boot.webmvc.test.autoconfigure.MockMvcPrint.NONE)
class RoleMatrixRouteIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired UsuarioRepository users;
    @Autowired RoleRepository roles;
    @Autowired JwtService jwt;

    @Test @Transactional
    void everyCatalogMethodAndPathFollowsPersistedGrantsForEveryBuiltInRole() throws Exception {
        int roleIndex = 0;
        for (String name : List.of("ROLE_SUPER_ADMIN", "ROLE_OPERADOR_GERAL", "ROLE_ADMIN",
                "ROLE_GERENTE", "ROLE_ATENDENTE", "ROLE_TECNICO", "ROLE_ESTOQUISTA",
                "ROLE_FINANCEIRO", "ROLE_CONSULTA")) {
            Role role = roles.findByNome(name).orElseThrow();
            Set<String> granted = role.getPermissoes().stream().map(p -> p.getCodigo())
                    .collect(Collectors.toSet());
            Usuario user = new Usuario("Synthetic matrix", "matrix-" + UUID.randomUUID()
                    + "@example.invalid", "unused", true);
            user.addRole(role);
            user = users.saveAndFlush(user);
            String token = jwt.generateToken(user);
            String syntheticIp = "192.0.2." + (20 + roleIndex++);
            for (var rule : OperationalPermissionCatalog.RULES) {
                var probe = request(rule.method(), rule.path().replaceAll("\\{[^}]+}", "999999999"))
                        .header("Authorization", "Bearer " + token).with(req -> {
                            req.setRemoteAddr(syntheticIp); return req;
                        });
                if (!Set.of(HttpMethod.GET, HttpMethod.HEAD, HttpMethod.OPTIONS).contains(rule.method()))
                    probe.contentType("application/json").content("{}");
                int status = mvc.perform(probe).andReturn().getResponse().getStatus();
                String label = name + " " + rule.method() + " " + rule.path();
                if (granted.contains(rule.permission())) {
                    assertNotEquals(401, status, label);
                    assertNotEquals(403, status, label);
                    assertTrue(status < 500, label + " returned " + status);
                } else assertEquals(403, status, label);
            }
        }
    }
}
