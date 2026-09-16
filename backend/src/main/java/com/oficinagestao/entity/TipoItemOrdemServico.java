package com.oficinagestao.entity;

public enum TipoItemOrdemServico {
    PECA("PeÃ§a"),
    SERVICO("ServiÃ§o");

    private final String descricao;

    TipoItemOrdemServico(String descricao) {
        this.descricao = descricao;
    }

    public String getDescricao() {
        return descricao;
    }
}
