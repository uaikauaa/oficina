package com.oficinagestao.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record ProdutoResponseDTO(
        Long id,
        String codigo,
        String codigoBarras,
        String nome,
        String descricao,
        String tipo,
        String tipoDescricao,
        String unidadeMedida,
        BigDecimal precoCusto,
        BigDecimal precoVenda,
        BigDecimal margemLucro,
        BigDecimal estoqueAtual,
        BigDecimal estoqueMinimo,
        BigDecimal estoqueMaximo,
        String localizacao,
        boolean ativo,
        Long fornecedorId,
        String fornecedorNome,
        boolean estoqueBaixo,
        boolean semEstoque,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
}
