package com.oficinagestao.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

@Schema(description = "DTO para ativação ou inativação rápida de entidade")
public record StatusUpdateDTO(
        @Schema(description = "Status ativo (true para ativo, false para inativo)", example = "true")
        @NotNull(message = "O campo ativo é obrigatório")
        Boolean ativo
) {
}
