package com.oficinagestao.ordem.dto;

import com.oficinagestao.ordem.StatusOrdemServico;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

@Schema(description = "Dados para alteração ou avanço de status da Ordem de Serviço")
public record OrdemServicoStatusDTO(

        @Schema(description = "Novo status da Ordem de Serviço", example = "EM_DIAGNOSTICO")
        @NotNull(message = "O novo status é obrigatório")
        StatusOrdemServico status,

        @Schema(description = "Registro de testes técnicos de bancada (obrigatório para liberar para status PRONTA)", example = "Teste sob carga de 200A estável, ciclo de trabalho 100% OK")
        String testesRealizados,

        @Schema(description = "Observações adicionais sobre a transição de status (ex: motivo do cancelamento ou liberação)")
        String observacoes
) {
}
