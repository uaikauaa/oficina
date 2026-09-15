package com.oficinagestao.dto;

import java.util.Set;

public record CurrentUserResponse(
        Long id,
        String nome,
        String email,
        Set<String> roles
) {
}
