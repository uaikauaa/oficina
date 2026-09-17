package com.oficinagestao.dto;

public record ClienteContadoresStatusDTO(
        long total,
        long pessoaFisica,
        long pessoaJuridica,
        long ativos,
        long inativos
) {
}
