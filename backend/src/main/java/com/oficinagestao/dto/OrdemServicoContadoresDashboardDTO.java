package com.oficinagestao.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Contadores operacionais para o painel de atenção da Dashboard")
public record OrdemServicoContadoresDashboardDTO(
        @Schema(description = "Quantidade de OS prontas para retirada", example = "5")
        long prontas,

        @Schema(description = "Quantidade de OS aguardando aprovação de orçamento", example = "3")
        long aguardandoAprovacao,

        @Schema(description = "Quantidade de OS em manutenção ativa na bancada", example = "8")
        long emManutencao
) {
}
