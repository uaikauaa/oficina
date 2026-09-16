package com.oficinagestao.dto;

import com.oficinagestao.entity.*;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

@Schema(description = "Dados para alteraÃ§Ã£o ou avanÃ§o de status da Ordem de ServiÃ§o")
public record OrdemServicoStatusDTO(

        @Schema(description = "Novo status da Ordem de ServiÃ§o", example = "EM_DIAGNOSTICO")
        @NotNull(message = "O novo status Ã© obrigatÃ³rio")
        StatusOrdemServico status,

        @Schema(description = "Registro de testes tÃ©cnicos de bancada (obrigatÃ³rio para liberar para status PRONTA)", example = "Teste sob carga de 200A estÃ¡vel, ciclo de trabalho 100% OK")
        String testesRealizados,

        @Schema(description = "ObservaÃ§Ãµes adicionais sobre a transiÃ§Ã£o de status (ex: motivo do cancelamento ou liberaÃ§Ã£o)")
        String observacoes
) {
}
