package com.oficinagestao.cliente.dto;

import jakarta.validation.constraints.NotNull;

public record ClienteStatusDTO(
        @NotNull(message = "Status ativo (true/false) é obrigatório")
        Boolean ativo
) {
}
