package com.oficinagestao.entity;

/**
 * Status do ciclo de vida da Ordem de Serviço técnica
 * para máquinas de solda e geradores de energia.
 * <p>
 * Segue estritamente os status definidos na migration V5.
 */
public enum StatusOrdemServico {
    ABERTA("Aberta"),
    EM_DIAGNOSTICO("Em Diagnóstico"),
    AGUARDANDO_APROVACAO("Aguardando Aprovação"),
    EM_MANUTENCAO("Em Manutenção"),
    AGUARDANDO_PECA("Aguardando Peça"),
    PRONTA("Pronta"),
    CONCLUIDA("Concluída"),
    CANCELADA("Cancelada");

    private final String descricao;

    StatusOrdemServico(String descricao) {
        this.descricao = descricao;
    }

    public String getDescricao() {
        return descricao;
    }

    /**
     * Indica se o status é final/terminal.
     * Ordens concluídas ou canceladas não podem sofrer novas alterações de status.
     */
    public boolean isTerminal() {
        return this == CONCLUIDA || this == CANCELADA;
    }

    /**
     * Valida se a transição a partir do status atual para o novo status é permitida.
     */
    public boolean podeTransicionarPara(StatusOrdemServico novoStatus) {
        if (this == novoStatus) {
            return true;
        }

        // Status terminal não pode mudar para nenhum outro
        if (this.isTerminal()) {
            return false;
        }

        // Cancelamento é permitido a partir de qualquer status não terminal
        if (novoStatus == CANCELADA) {
            return true;
        }

        return switch (this) {
            case ABERTA -> novoStatus == EM_DIAGNOSTICO || novoStatus == AGUARDANDO_APROVACAO;
            case EM_DIAGNOSTICO -> novoStatus == AGUARDANDO_APROVACAO || novoStatus == EM_MANUTENCAO;
            case AGUARDANDO_APROVACAO -> novoStatus == EM_MANUTENCAO || novoStatus == EM_DIAGNOSTICO;
            case EM_MANUTENCAO -> novoStatus == AGUARDANDO_PECA || novoStatus == PRONTA;
            case AGUARDANDO_PECA -> novoStatus == EM_MANUTENCAO;
            case PRONTA -> novoStatus == CONCLUIDA || novoStatus == EM_MANUTENCAO;
            default -> false;
        };
    }
}
