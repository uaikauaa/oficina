package com.oficinagestao.entity;

public enum TipoMovimentacaoEstoque {
    ENTRADA("Entrada"),
    SAIDA("SaÃ­da"),
    AJUSTE_POSITIVO("Ajuste Positivo"),
    AJUSTE_NEGATIVO("Ajuste Negativo"),
    DEVOLUCAO("DevoluÃ§Ã£o / Estorno");

    private final String descricao;

    TipoMovimentacaoEstoque(String descricao) {
        this.descricao = descricao;
    }

    public String getDescricao() {
        return descricao;
    }
}
