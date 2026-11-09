package com.oficinagestao.security;

import com.oficinagestao.entity.Permissao;
import com.oficinagestao.entity.Role;
import com.oficinagestao.entity.Usuario;
import com.oficinagestao.repository.UsuarioRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class CurrentGrantJwtFilterTest {
    @AfterEach void clearContext() { SecurityContextHolder.clearContext(); }

    @Test void oldJwtClaimsCannotRestoreRevokedPrivileges() throws Exception {
        JwtService jwt = mock(JwtService.class);
        UsuarioRepository users = mock(UsuarioRepository.class);
        Usuario current = new Usuario("Synthetic", "synthetic@example.invalid", "unused", true);
        current.setId(42L);
        current.setTokenVersion(7);
        Role restricted = new Role("ROLE_CONSULTA", "Read only");
        restricted.getPermissoes().add(new Permissao("clientes.get", "GET /api/clientes"));
        current.addRole(restricted);
        when(jwt.validateToken("old-claims")).thenReturn(true);
        when(jwt.extractEmail("old-claims")).thenReturn(current.getEmail());
        when(jwt.extractUserId("old-claims")).thenReturn(42L);
        when(jwt.extractTokenVersion("old-claims")).thenReturn(7);
        when(jwt.extractRoles("old-claims")).thenReturn(Set.of("ROLE_SUPER_ADMIN"));
        when(users.findActiveTokenVersionById(42L)).thenReturn(Optional.of(7));
        when(users.findById(42L)).thenReturn(Optional.of(current));

        var request = new MockHttpServletRequest("GET", "/api/clientes");
        request.addHeader("Authorization", "Bearer old-claims");
        new JwtAuthenticationFilter(jwt, users).doFilter(request, new MockHttpServletResponse(), new MockFilterChain());

        var authentication = SecurityContextHolder.getContext().getAuthentication();
        assertNotNull(authentication);
        assertTrue(authentication.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("PERM_clientes.get")));
        assertFalse(authentication.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_SUPER_ADMIN")));
        verify(jwt, never()).extractRoles("old-claims");
    }

    @Test void incrementedVersionRejectsPreviousJwtBeforeLoadingGrants() throws Exception {
        JwtService jwt = mock(JwtService.class);
        UsuarioRepository users = mock(UsuarioRepository.class);
        when(jwt.validateToken("stale")).thenReturn(true);
        when(jwt.extractEmail("stale")).thenReturn("synthetic@example.invalid");
        when(jwt.extractUserId("stale")).thenReturn(42L);
        when(jwt.extractTokenVersion("stale")).thenReturn(6);
        when(users.findActiveTokenVersionById(42L)).thenReturn(Optional.of(7));
        var request = new MockHttpServletRequest("GET", "/api/clientes");
        request.addHeader("Authorization", "Bearer stale");
        new JwtAuthenticationFilter(jwt, users).doFilter(request, new MockHttpServletResponse(), new MockFilterChain());
        assertNull(SecurityContextHolder.getContext().getAuthentication());
        verify(users, never()).findById(42L);
    }
}
