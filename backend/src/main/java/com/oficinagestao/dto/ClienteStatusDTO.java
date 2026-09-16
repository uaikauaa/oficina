package com.oficinagestao.dto;

import jakarta.validation.constraints.NotNull;

public record ClienteStatusDTO(
        @NotNull(message = "Status ativo (true/false) Ã© obrigatÃ³rio")
        Boolean ativo
) {
}
