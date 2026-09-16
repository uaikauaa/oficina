package com.oficinagestao.dto;

import java.math.BigDecimal;

public record RelatorioOsResumoDTO(
        long totalOs,
        long concluidas,
        long abertas,
        long canceladas,
        BigDecimal valorTotalConcluidas
) {
}
