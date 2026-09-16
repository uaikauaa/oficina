package com.oficinagestao.dto;

import java.math.BigDecimal;

public record RelatorioEstoqueItemDTO(
        Long produtoId,
        String codigo,
        String nome,
        String marca,
        String categoriaNome,
        String fornecedorNome,
        BigDecimal estoqueAtual,
        BigDecimal estoqueMinimo,
        String statusEstoque
) {
}
