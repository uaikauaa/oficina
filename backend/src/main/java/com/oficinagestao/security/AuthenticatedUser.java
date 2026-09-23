package com.oficinagestao.security;

import java.security.Principal;

/**
 * Representa o usuário autenticado validado criptograficamente pelo JwtAuthenticationFilter.
 * Implementa java.security.Principal para manter compatibilidade total com o ecossistema Spring Security.
 */
public record AuthenticatedUser(
        Long id,
        String email
) implements Principal {

    @Override
    public String getName() {
        return email;
    }

    @Override
    public String toString() {
        return email;
    }
}
