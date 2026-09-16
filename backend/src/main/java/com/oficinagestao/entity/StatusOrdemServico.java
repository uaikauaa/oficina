package com.oficinagestao.entity;

/**
 * Status do ciclo de vida da Ordem de ServiÃ§o tÃ©cnica
 * para mÃ¡quinas de solda e geradores de energia.
 * <p>
 * Segue estritamente os status definidos na migration V5.
 */
public enum StatusOrdemServico {
    ABERTA("Aberta"),
    EM_DIAGNOSTICO("Em DiagnÃ³stico"),
    AGUARDANDO_APROVACAO("Aguardando AprovaÃ§Ã£o"),
    EM_MANUTENCAO("Em ManutenÃ§Ã£o"),
    AGUARDANDO_PECA("Aguardando PeÃ§a"),
    PRONTA("Pronta"),
    CONCLUIDA("ConcluÃ­da"),
    CANCELADA("Cancelada");

    private final String descricao;

    StatusOrdemServico(String descricao) {
        this.descricao = descricao;
    }

    public String getDescricao() {
        return descricao;
    }

    /**
     * Indica se o status Ã© final/terminal.
     * Ordens concluÃ­das ou canceladas nÃ£o podem sofrer novas alteraÃ§Ãµes de status.
     */
    public boolean isTerminal() {
        return this == CONCLUIDA || this == CANCELADA;
    }

    /**
     * Valida se a transiÃ§Ã£o a partir do status atual para o novo status Ã© permitida.
     */
    public boolean podeTransicionarPara(StatusOrdemServico novoStatus) {
        if (this == novoStatus) {
            return true;
        }

        // Status terminal nÃ£o pode mudar para nenhum outro
        if (this.isTerminal()) {
            return false;
        }

        // Cancelamento Ã© permitido a partir de qualquer status nÃ£o terminal
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
