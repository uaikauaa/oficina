package com.oficinagestao.estoque;

public enum TipoMovimentacaoEstoque {
    ENTRADA("Entrada"),
    SAIDA("Saída"),
    AJUSTE_POSITIVO("Ajuste Positivo"),
    AJUSTE_NEGATIVO("Ajuste Negativo"),
    DEVOLUCAO("Devolução / Estorno");

    private final String descricao;

    TipoMovimentacaoEstoque(String descricao) {
        this.descricao = descricao;
    }

    public String getDescricao() {
        return descricao;
    }
}
