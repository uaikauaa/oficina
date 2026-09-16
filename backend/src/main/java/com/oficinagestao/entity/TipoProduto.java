package com.oficinagestao.entity;

public enum TipoProduto {
    PRODUTO("Produto"),
    PECA("PeÃ§a / Componente"),
    SERVICO("ServiÃ§o"),
    CONSUMIVEL("ConsumÃ­vel");

    private final String descricao;

    TipoProduto(String descricao) {
        this.descricao = descricao;
    }

    public String getDescricao() {
        return descricao;
    }
}
