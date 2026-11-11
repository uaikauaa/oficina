package com.oficinagestao.security;

import com.oficinagestao.controller.AdminAuditController;
import com.oficinagestao.entity.Usuario;
import com.oficinagestao.repository.UsuarioRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
class AdminAuditFilterIntegrationTest {
    @Autowired AdminAuditController controller;
    @Autowired UsuarioRepository users;
    @Autowired PasswordEncoder passwords;
    @Autowired JdbcTemplate jdbc;
    Usuario user;

    @AfterEach void cleanup() { if (user != null) {
        jdbc.update("DELETE FROM eventos_administrativos WHERE ator_id=? OR alvo_usuario_id=?",
                user.getId(), user.getId());
        users.deleteById(user.getId());
    } }

    @Test void filtersAndStablePagesWithBoundValues() {
        user = users.saveAndFlush(new Usuario("Audit synthetic", "audit-" + UUID.randomUUID()
                + "@example.invalid", passwords.encode("SyntheticPassword1!"), true));
        String action = "SYNTHETIC_" + UUID.randomUUID().toString().replace("-", "");
        jdbc.update("INSERT INTO eventos_administrativos(ator_id,acao,ocorrido_em) VALUES (?,?,now()-interval '2 days')",
                user.getId(), action);
        jdbc.update("INSERT INTO eventos_administrativos(alvo_usuario_id,acao,ocorrido_em) VALUES (?,?,now())",
                user.getId(), action);
        var page1 = controller.list(0, 1, action, user.getId(),
                OffsetDateTime.now().minusDays(3), OffsetDateTime.now().plusDays(1), "desc");
        var page2 = controller.list(1, 1, action, user.getId(), null, null, "desc");
        assertEquals(2, page1.totalElements());
        assertEquals(1, page1.content().size());
        assertNotEquals(page1.content().getFirst().id(), page2.content().getFirst().id());
        assertTrue(page1.content().getFirst().id() > page2.content().getFirst().id());
        assertEquals(0, controller.list(0, 20, "%_", user.getId(), null, null, "asc").totalElements());
        assertThrows(ResponseStatusException.class,
                () -> controller.list(0, 20, action, user.getId(), null, null, "desc;drop table usuarios"));
        assertEquals(0, controller.list(0, 20, action, user.getId(),
                OffsetDateTime.now().plusDays(1), null, "desc").totalElements());
    }
}
