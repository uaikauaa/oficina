package com.oficinagestao.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class SecurityUtilsTest {

    @Test
    @DisplayName("Deve extrair userId com sucesso quando o principal for AuthenticatedUser")
    void deveExtrairUserIdQuandoPrincipalForAuthenticatedUser() {
        AuthenticatedUser user = new AuthenticatedUser(42L, "admin@oficina.com");
        Authentication auth = new UsernamePasswordAuthenticationToken(
                user,
                null,
                List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))
        );

        Long userId = SecurityUtils.extractUserId(auth);

        assertEquals(42L, userId);
        assertEquals("admin@oficina.com", auth.getName());
        assertEquals("admin@oficina.com", user.getName());
        assertEquals("admin@oficina.com", user.toString());
    }

    @Test
    @DisplayName("Deve retornar null quando authentication for nula")
    void deveRetornarNullQuandoAuthenticationNula() {
        assertNull(SecurityUtils.extractUserId(null));
    }

    @Test
    @DisplayName("Deve retornar null quando principal for UserDetails padrão (como em @WithMockUser)")
    void deveRetornarNullQuandoPrincipalNaoForAuthenticatedUser() {
        User user = new User("admin@oficina.com", "password", List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
        Authentication auth = new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities());

        assertNull(SecurityUtils.extractUserId(auth));
        assertEquals("admin@oficina.com", auth.getName());
    }

    @Test
    @DisplayName("Deve retornar null quando principal for String simples")
    void deveRetornarNullQuandoPrincipalForString() {
        Authentication auth = new UsernamePasswordAuthenticationToken(
                "admin@oficina.com",
                null,
                List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))
        );

        assertNull(SecurityUtils.extractUserId(auth));
        assertEquals("admin@oficina.com", auth.getName());
    }
}
