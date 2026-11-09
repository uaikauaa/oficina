package com.oficinagestao.security;

import com.oficinagestao.dto.AcceptInviteRequest;
import com.oficinagestao.dto.BootstrapSuperAdminRequest;
import com.oficinagestao.entity.Usuario;
import com.oficinagestao.exception.ConflictException;
import com.oficinagestao.repository.RoleRepository;
import com.oficinagestao.repository.UsuarioRepository;
import com.oficinagestao.service.EmailService;
import com.oficinagestao.service.InviteService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
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

@SpringBootTest(properties = "security.super-admin-bootstrap.email=synthetic-owner@example.invalid")
@ActiveProfiles("test")
class SuperAdminBootstrapIntegrationTest {
    @Autowired InviteService invites;
    @Autowired UsuarioRepository users;
    @Autowired RoleRepository roles;
    @Autowired PasswordEncoder passwords;
    @MockitoBean EmailService mail;

    @AfterEach void clear() { SecurityContextHolder.clearContext(); }

    @Test @Transactional
    void legacyAdminCanIssueOnlyFixedEmailInvitationAndCannotRepeatAfterAcceptance() {
        String password = "SyntheticLegacyPassword1!";
        Usuario actor = new Usuario("Synthetic legacy", "legacy-" + UUID.randomUUID() + "@example.invalid",
                passwords.encode(password), true);
        actor.addRole(roles.findByNome("ROLE_ADMIN").orElseThrow());
        users.saveAndFlush(actor);
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new AuthenticatedUser(actor.getId(), actor.getEmail()), null,
                List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))));
        BootstrapSuperAdminRequest request = new BootstrapSuperAdminRequest(password,
                "Provisionamento sintético aprovado", "PROVISIONAR_SUPER_ADMIN");
        invites.bootstrapSuperAdmin(request);
        var url = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(mail).sendInvitation(eq("synthetic-owner@example.invalid"), url.capture());
        assertTrue(users.findByEmail("synthetic-owner@example.invalid").isEmpty());
        String token = URI.create(url.getValue()).getRawQuery().substring("token=".length());
        var publicRequest = new MockHttpServletRequest("POST", "/api/auth/convites/aceitar");
        publicRequest.setRemoteAddr("127.0.0.1");
        SecurityContextHolder.clearContext();
        invites.accept(new AcceptInviteRequest(token, "Synthetic owner", "SyntheticOwnerPassword1!"), publicRequest);
        Usuario owner = users.findByEmail("synthetic-owner@example.invalid").orElseThrow();
        assertTrue(owner.getRoles().stream().anyMatch(role -> role.getNome().equals("ROLE_SUPER_ADMIN")));
        assertThrows(ConflictException.class, () -> {
            SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                    new AuthenticatedUser(actor.getId(), actor.getEmail()), null,
                    List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))));
            invites.bootstrapSuperAdmin(request);
        });
    }
}
