package com.oficinagestao.entity;

/**
 * Status específico do ciclo de vida da Declaração de Prestação de Serviços (DPS) / documento fiscal.
 *
 * IMPORTANTE:
 * Este status NÃO se confunde com o StatusOrdemServico.
 * Uma Ordem de Serviço pode estar CONCLUIDA e ter uma DPS em estado PREPARADA, PENDENTE_ENVIO, AUTORIZADA, etc.
 */
public enum StatusDpsFiscal {
    RASCUNHO,
    PREPARADA,
    PENDENTE_ENVIO,
    ENVIANDO,
    AUTORIZADA,
    REJEITADA,
    CANCELADA,
    ERRO
}
