package com.oficinagestao.dto;

import jakarta.validation.constraints.NotNull;

public record MaquinaStatusDTO(
        @NotNull(message = "O campo 'ativo' Ã© obrigatÃ³rio")
        Boolean ativo
) {
}
