package com.oficinagestao.entity;

/**
 * Tipos de equipamentos tÃ©cnicos atendidos pela oficina.
 * DomÃ­nio oficial: mÃ¡quinas de solda e geradores de energia.
 */
public enum TipoEquipamento {
    MAQUINA_SOLDA,
    GERADOR_ENERGIA,
    OUTRO_EQUIPAMENTO;

    public String getDescricao() {
        return switch (this) {
            case MAQUINA_SOLDA -> "MÃ¡quina de Solda";
            case GERADOR_ENERGIA -> "Gerador de Energia";
            case OUTRO_EQUIPAMENTO -> "Outro Equipamento";
        };
    }
}
