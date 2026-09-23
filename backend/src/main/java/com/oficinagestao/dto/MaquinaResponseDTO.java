package com.oficinagestao.dto;

import com.oficinagestao.entity.TipoEquipamento;


import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record MaquinaResponseDTO(
        Long id,
        Long clienteId,
        String clienteNome,
        TipoEquipamento tipoEquipamento,
        String tipoEquipamentoDescricao,
        String marca,
        String modelo,
        Integer anoFabricacao,
        String numeroSerie,
        BigDecimal horimetro,
        String potencia,
        String tensao,
        String especificacoesTecnicas,
        String observacoes,
        Boolean ativo,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
}
