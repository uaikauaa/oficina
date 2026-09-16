package com.oficinagestao.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record EstoqueMovimentacaoResponseDTO(
        Long id,
        Long produtoId,
        String produtoCodigo,
        String produtoNome,
        Long usuarioId,
        String usuarioNome,
        Long ordemServicoId,
        String ordemServicoNumero,
        String tipoMovimentacao,
        String tipoDescricao,
        BigDecimal quantidade,
        BigDecimal valorUnitario,
        BigDecimal quantidadeAnterior,
        BigDecimal quantidadePosterior,
        String motivo,
        OffsetDateTime dataMovimentacao
) {
}
