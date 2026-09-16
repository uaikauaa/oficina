package com.oficinagestao.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record OrdemServicoItemResponseDTO(
        Long id,
        Long ordemServicoId,
        Long produtoId,
        String produtoCodigo,
        String produtoNome,
        String tipoItem,
        String tipoItemDescricao,
        BigDecimal quantidade,
        BigDecimal valorUnitario,
        BigDecimal valorDesconto,
        BigDecimal valorTotal,
        String observacoes,
        OffsetDateTime createdAt
) {
}
