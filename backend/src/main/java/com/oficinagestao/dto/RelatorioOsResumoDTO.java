package com.oficinagestao.dto;

import java.math.BigDecimal;

public record RelatorioOsResumoDTO(
        long totalOs,
        long concluidas,
        long abertas,
        long canceladas,
        BigDecimal valorTotalConcluidas,
        BigDecimal valorTotalAReceber
) {
    public RelatorioOsResumoDTO(
            long totalOs,
            long concluidas,
            long abertas,
            long canceladas,
            BigDecimal valorTotalConcluidas
    ) {
        this(totalOs, concluidas, abertas, canceladas, valorTotalConcluidas, BigDecimal.ZERO);
    }
}
