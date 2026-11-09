package com.oficinagestao.security;

import com.oficinagestao.dto.AdminChangeRequest;
import com.oficinagestao.entity.RefreshToken;
import com.oficinagestao.entity.Usuario;
import com.oficinagestao.repository.RefreshTokenRepository;
import com.oficinagestao.repository.RoleRepository;
import com.oficinagestao.repository.UsuarioRepository;
import com.oficinagestao.service.AdminUserService;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc(print = org.springframework.boot.webmvc.test.autoconfigure.MockMvcPrint.NONE)
class AdminUserLifecycleIntegrationTest {
    @Autowired UsuarioRepository users;
    @Autowired RoleRepository roles;
    @Autowired RefreshTokenRepository refreshTokens;
    @Autowired AdminUserService service;
    @Autowired JwtService jwt;
    @Autowired PasswordEncoder passwords;
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;
    @Autowired EntityManager entityManager;

    @AfterEach void clear() { SecurityContextHolder.clearContext(); }

    @Test
    @Transactional
    void operatorRetainsOperationsAndRoleChangeInvalidatesBothKindsOfToken() throws Exception {
        String password = "SyntheticStrongPassword1!";
        Usuario actor = create("ROLE_SUPER_ADMIN", passwords.encode(password));
        Usuario operator = create("ROLE_OPERADOR_GERAL", "unused-synthetic");
        refreshTokens.save(new RefreshToken(operator, "a".repeat(64), OffsetDateTime.now().plusDays(1)));
        String previousJwt = jwt.generateToken(operator);

        assertEquals(200, mvc.perform(get("/api/clientes").header("Authorization", "Bearer " + previousJwt))
                .andReturn().getResponse().getStatus());
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new AuthenticatedUser(actor.getId(), actor.getEmail()), null,
                List.of(new SimpleGrantedAuthority("ROLE_SUPER_ADMIN"))));

        service.changeRoles(operator.getId(), new AdminChangeRequest("Mudança sintética de papéis", password,
                "ALTERAR_PAPEIS", null, Set.of("ROLE_CONSULTA")));
        SecurityContextHolder.clearContext();
        entityManager.flush();
        entityManager.clear();

        assertEquals(1, users.findById(operator.getId()).orElseThrow().getTokenVersion());
        assertTrue(refreshTokens.findByTokenHash("a".repeat(64)).orElseThrow().getRevogado());
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM eventos_administrativos WHERE alvo_usuario_id=?",
                Integer.class, operator.getId()));
        assertEquals(401, mvc.perform(get("/api/clientes").header("Authorization", "Bearer " + previousJwt))
                .andReturn().getResponse().getStatus());
    }

    private Usuario create(String role, String hash) {
        Usuario user = new Usuario("Synthetic RBAC", "rbac-" + UUID.randomUUID() + "@example.invalid", hash, true);
        user.addRole(roles.findByNome(role).orElseThrow());
        return users.save(user);
    }
}
