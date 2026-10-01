package com.oficinagestao.dto;

import com.oficinagestao.entity.Notificacao;
import com.oficinagestao.entity.TipoNotificacao;

import java.time.OffsetDateTime;

public record NotificacaoResponseDTO(
        Long id,
        TipoNotificacao tipo,
        String titulo,
        String mensagem,
        boolean lida,
        OffsetDateTime criadoEm,
        OffsetDateTime lidoEm,
        String recursoTipo,
        Long recursoId,
        String link
) {
    public static NotificacaoResponseDTO fromEntity(Notificacao entity) {
        return new NotificacaoResponseDTO(
                entity.getId(),
                entity.getTipo(),
                entity.getTitulo(),
                entity.getMensagem(),
                entity.isLida(),
                entity.getCriadoEm(),
                entity.getLidoEm(),
                entity.getRecursoTipo(),
                entity.getRecursoId(),
                entity.getLink()
        );
    }
}
