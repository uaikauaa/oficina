package com.oficinagestao.dto;

import java.time.OffsetDateTime;

public record CategoriaResponseDTO(
        Long id,
        String nome,
        String descricao,
        boolean ativo,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
}
