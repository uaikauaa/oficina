package com.oficinagestao.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record ClienteResumoDTO(
        Long clienteId,
        long quantidadeEquipamentos,
        long quantidadeTotalOs,
        long quantidadeOsAbertas,
        OffsetDateTime ultimaVisitaData,
        String ultimaOsNumero,
        BigDecimal valorAcumulado
) {
}
