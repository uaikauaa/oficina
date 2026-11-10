package com.oficinagestao.security;

import com.oficinagestao.dto.AcceptInviteRequest;
import com.oficinagestao.dto.CreateInviteRequest;
import com.oficinagestao.entity.Usuario;
import com.oficinagestao.repository.RoleRepository;
import com.oficinagestao.repository.UsuarioRepository;
import com.oficinagestao.service.EmailService;
import com.oficinagestao.service.InviteService;
import com.oficinagestao.service.InviteOutbox;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@SpringBootTest
@ActiveProfiles("test")
class InviteLifecycleIntegrationTest {
    @Autowired InviteService invites;
    @Autowired InviteOutbox outbox;
    @Autowired UsuarioRepository users;
    @Autowired RoleRepository roles;
    @Autowired PasswordEncoder passwords;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean EmailService mail;
    String actorEmail;
    String invitedEmail;

    @AfterEach void clear() {
        SecurityContextHolder.clearContext();
        if (invitedEmail != null) jdbc.update("DELETE FROM convites_usuarios WHERE email=?", invitedEmail);
        if (invitedEmail != null) jdbc.update("DELETE FROM usuarios WHERE email=?", invitedEmail);
        if (actorEmail != null) jdbc.update("DELETE FROM usuarios WHERE email=?", actorEmail);
    }

    @Test
    void emailProofCreatesOneAccountWithoutPublicRoleSelection() {
        String actorPassword = "SyntheticActorPassword1!";
        Usuario actor = new Usuario("Synthetic owner", "owner-" + UUID.randomUUID() + "@example.invalid",
                passwords.encode(actorPassword), true);
        actor.addRole(roles.findByNome("ROLE_SUPER_ADMIN").orElseThrow());
        actor = users.saveAndFlush(actor);
        actorEmail = actor.getEmail();
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new AuthenticatedUser(actor.getId(), actor.getEmail()), null,
                List.of(new SimpleGrantedAuthority("ROLE_SUPER_ADMIN"))));

        String email = "invited-" + UUID.randomUUID() + "@example.invalid";
        invitedEmail = email;
        invites.create(new CreateInviteRequest(email, "ROLE_CONSULTA", "Convite sintético autorizado",
                actorPassword, "CRIAR_CONVITE"));
        verifyNoInteractions(mail);
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM invite_delivery_outbox o "
                + "JOIN convites_usuarios c ON c.id=o.invite_id WHERE c.email=? AND o.status='PENDING'", Integer.class, email));
        assertTrue(outbox.dispatchOne());
        var url = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(mail).sendInvitation(eq(email), url.capture());
        String token = URI.create(url.getValue()).getRawQuery().substring("token=".length());
        assertEquals(0, users.findByEmail(email).stream().count());

        var request = new MockHttpServletRequest("POST", "/api/auth/convites/aceitar");
        request.setRemoteAddr("127.0.0.1");
        SecurityContextHolder.clearContext();
        invites.accept(new AcceptInviteRequest(token, "Synthetic invited", "SyntheticInvitePassword1!"), request);
        Usuario invited = users.findByEmail(email).orElseThrow();
        assertTrue(passwords.matches("SyntheticInvitePassword1!", invited.getSenha()));
        assertEquals(List.of("ROLE_CONSULTA"), invited.getRoles().stream().map(r -> r.getNome()).toList());
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM convites_usuarios WHERE email=? AND usado_em IS NOT NULL", Integer.class, email));
        assertThrows(com.oficinagestao.exception.BusinessException.class,
                () -> invites.accept(new AcceptInviteRequest(token, "Replay", "SyntheticInvitePassword1!"), request));
    }
}
