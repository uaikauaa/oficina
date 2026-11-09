package com.oficinagestao.security;

import com.oficinagestao.dto.RoleChangeRequest;
import com.oficinagestao.entity.Usuario;
import com.oficinagestao.repository.RoleRepository;
import com.oficinagestao.repository.UsuarioRepository;
import com.oficinagestao.service.RoleManagementService;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
class CustomRoleRevocationIntegrationTest {
    @Autowired RoleManagementService service;
    @Autowired UsuarioRepository users;
    @Autowired RoleRepository roles;
    @Autowired PasswordEncoder passwords;
    @Autowired EntityManager entityManager;

    @AfterEach void clear() { SecurityContextHolder.clearContext(); }

    @Test @Transactional
    void changingCustomRoleInvalidatesAssignedUsersWithoutGrantingAdministrativeRights() {
        String password = "SyntheticRolePassword1!";
        Usuario actor = new Usuario("Synthetic owner", "role-owner-" + UUID.randomUUID() + "@example.invalid",
                passwords.encode(password), true);
        actor.addRole(roles.findByNome("ROLE_SUPER_ADMIN").orElseThrow());
        actor = users.saveAndFlush(actor);
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new AuthenticatedUser(actor.getId(), actor.getEmail()), null,
                List.of(new SimpleGrantedAuthority("ROLE_SUPER_ADMIN"))));

        String name = "ROLE_CUSTOM_TEST_" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        var created = service.create(new RoleChangeRequest(name, "Synthetic limited role",
                Set.of("clientes.get"), "Criação sintética do papel", password, "GERENCIAR_PAPEL"));
        Usuario target = new Usuario("Synthetic delegated", "delegated-" + UUID.randomUUID() + "@example.invalid",
                "unused-synthetic", true);
        target.addRole(roles.findByNome(name).orElseThrow());
        target = users.saveAndFlush(target);
        Long targetId = target.getId();

        service.update(created.id(), new RoleChangeRequest(name, "Synthetic changed role",
                Set.of("clientes.post"), "Alteração sintética do papel", password, "GERENCIAR_PAPEL"));
        entityManager.flush();
        entityManager.clear();

        assertEquals(1, users.findById(targetId).orElseThrow().getTokenVersion());
        assertEquals(Set.of("clientes.post"), roles.findByNome(name).orElseThrow().getPermissoes().stream()
                .map(p -> p.getCodigo()).collect(java.util.stream.Collectors.toSet()));
        assertFalse(roles.findByNome(name).orElseThrow().getPermissoes().stream()
                .anyMatch(p -> p.getCodigo().equals("usuarios.gerenciar")));
    }
}
