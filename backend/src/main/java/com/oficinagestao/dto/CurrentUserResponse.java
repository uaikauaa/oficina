package com.oficinagestao.dto;

import java.util.Set;

public record CurrentUserResponse(
        Long id,
        String nome,
        String email,
        Set<String> roles,
        Set<String> permissoes
) {
    public CurrentUserResponse(Long id, String nome, String email, Set<String> roles) {
        this(id, nome, email, roles, Set.of());
    }
}
