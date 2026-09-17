package com.oficinagestao.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Contadores consolidados de Ordens de Serviço por status para pills e filtros rápidos")
public record OrdemServicoContadoresStatusDTO(
        @Schema(description = "Total de todas as ordens de serviço", example = "42")
        long total,

        @Schema(description = "Quantidade de OS abertas", example = "8")
        long aberta,

        @Schema(description = "Quantidade de OS em diagnóstico", example = "2")
        long emDiagnostico,

        @Schema(description = "Quantidade de OS aguardando aprovação de orçamento", example = "5")
        long aguardandoAprovacao,

        @Schema(description = "Quantidade de OS em manutenção ativa", example = "6")
        long emManutencao,

        @Schema(description = "Quantidade de OS aguardando peça", example = "3")
        long aguardandoPeca,

        @Schema(description = "Quantidade de OS prontas para retirada", example = "4")
        long pronta,

        @Schema(description = "Quantidade de OS concluídas", example = "12")
        long concluida,

        @Schema(description = "Quantidade de OS canceladas", example = "2")
        long cancelada
) {
}
