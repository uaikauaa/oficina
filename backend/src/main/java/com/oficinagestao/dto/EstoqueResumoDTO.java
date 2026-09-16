package com.oficinagestao.dto;

import java.math.BigDecimal;

public record EstoqueResumoDTO(
        long totalProdutos,
        long itensSemEstoque,
        long itensEstoqueBaixo,
        BigDecimal valorTotalEstoque
) {
}
