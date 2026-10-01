package com.oficinagestao.dto;

import java.util.List;

public record NotificacoesResumoDTO(
        long total,
        long naoLidas,
        List<NotificacaoResponseDTO> notificacoes
) {}
