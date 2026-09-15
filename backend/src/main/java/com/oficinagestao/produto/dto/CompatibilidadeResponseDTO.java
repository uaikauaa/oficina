package com.oficinagestao.produto.dto;

import java.time.OffsetDateTime;

public record CompatibilidadeResponseDTO(
        Long id,
        Long maquinaId,
        String maquinaTipoEquipamento,
        String maquinaMarca,
        String maquinaModelo,
        String maquinaNumeroSerie,
        String observacaoCompatibilidade,
        OffsetDateTime createdAt
) {
}
