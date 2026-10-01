package com.oficinagestao.entity;

public enum TipoNotificacao {
    OS_AGUARDANDO_APROVACAO("Aguardando Aprovação"),
    OS_PRONTA("Pronta para Retirada"),
    ESTOQUE_BAIXO("Estoque Baixo");

    private final String descricao;

    TipoNotificacao(String descricao) {
        this.descricao = descricao;
    }

    public String getDescricao() {
        return descricao;
    }
}
