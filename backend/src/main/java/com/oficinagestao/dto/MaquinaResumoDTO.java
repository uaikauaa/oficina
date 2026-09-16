package com.oficinagestao.dto;

import com.oficinagestao.entity.StatusOrdemServico;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record MaquinaResumoDTO(
        Long maquinaId,
        long totalAtendimentos,
        OffsetDateTime ultimaManutencaoData,
        Long ultimaOsId,
        String ultimaOsNumero,
        String ultimaOsProblema,
        StatusOrdemServico ultimaOsStatus,
        BigDecimal valorAcumulado
) {
}
