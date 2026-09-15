package com.oficinagestao.ordem;

public enum TipoItemOrdemServico {
    PECA("Peça"),
    SERVICO("Serviço");

    private final String descricao;

    TipoItemOrdemServico(String descricao) {
        this.descricao = descricao;
    }

    public String getDescricao() {
        return descricao;
    }
}
