package com.oficinagestao.estoque.dto;

import java.math.BigDecimal;

public record EstoqueResumoDTO(
        long totalProdutos,
        long itensSemEstoque,
        long itensEstoqueBaixo,
        BigDecimal valorTotalEstoque
) {
}
