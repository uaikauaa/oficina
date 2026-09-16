package com.oficinagestao.dto;

import com.oficinagestao.entity.TipoEquipamento;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record RelatorioMaquinaItemDTO(
        Long maquinaId,
        String clienteNome,
        TipoEquipamento tipo,
        String marca,
        String modelo,
        String numeroSerie,
        long quantidadeOs,
        OffsetDateTime ultimaManutencao,
        BigDecimal valorAcumulado
) {
}
