package com.oficinagestao.dto;

import java.math.BigDecimal;

public record PecaMaisUtilizadaDTO(
        Long produtoId,
        String codigo,
        String nome,
        String marca,
        BigDecimal quantidadeTotalUtilizada,
        Long quantidadeOs
) {
    public PecaMaisUtilizadaDTO(Long produtoId, String codigo, String nome, String marca, long quantidadeTotalUtilizada, long quantidadeOs) {
        this(produtoId, codigo, nome, marca, BigDecimal.valueOf(quantidadeTotalUtilizada), quantidadeOs);
    }
}
