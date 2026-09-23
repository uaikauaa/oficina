package com.oficinagestao.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * Utilitário centralizado para extração segura de dados do contexto de autenticação validado.
 */
public final class SecurityUtils {

    private SecurityUtils() {
    }

    /**
     * Extrai o ID do usuário autenticado a partir do objeto Authentication.
     * Retorna o userId presente no AuthenticatedUser (validado via assinatura criptográfica do JWT) ou null.
     */
    public static Long extractUserId(Authentication authentication) {
        if (authentication == null) {
            return null;
        }
        Object principal = authentication.getPrincipal();
        if (principal instanceof AuthenticatedUser user) {
            return user.id();
        }
        return null;
    }

    /**
     * Extrai o ID do usuário autenticado a partir do SecurityContextHolder atual.
     */
    public static Long getCurrentUserId() {
        return extractUserId(SecurityContextHolder.getContext().getAuthentication());
    }
}
