package com.oficinagestao.entity;

public enum TipoProduto {
    PRODUTO("Produto"),
    PECA("Peça / Componente"),
    SERVICO("Serviço"),
    CONSUMIVEL("Consumível");

    private final String descricao;

    TipoProduto(String descricao) {
        this.descricao = descricao;
    }

    public String getDescricao() {
        return descricao;
    }
}
