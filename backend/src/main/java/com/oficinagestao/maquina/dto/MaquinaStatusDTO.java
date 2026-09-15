package com.oficinagestao.maquina.dto;

import jakarta.validation.constraints.NotNull;

public record MaquinaStatusDTO(
        @NotNull(message = "O campo 'ativo' é obrigatório")
        Boolean ativo
) {
}
