package com.oficinagestao.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;

@Schema(description = "Dados para abertura de nova Ordem de Serviço na oficina")
public record OrdemServicoCreateDTO(

        @Schema(description = "Identificador do cliente proprietário do equipamento", example = "1")
        @NotNull(message = "O identificador do cliente é obrigatório")
        Long clienteId,

        @Schema(description = "Identificador do equipamento do cliente que passará pela manutenção", example = "3")
        @NotNull(message = "O identificador do equipamento é obrigatório")
        Long maquinaId,

        @Schema(description = "Número da OS (opcional; se não informado, será gerado automaticamente no padrão OS-AAAA-XXXX)", example = "OS-2026-0001")
        @Size(max = 30, message = "O número da OS não pode exceder 30 caracteres")
        String numeroOs,

        @Schema(description = "Data e hora de entrada do equipamento na oficina (opcional; default é agora)")
        OffsetDateTime dataEntrada,

        @Schema(description = "Previsão estimada de conclusão")
        OffsetDateTime previsaoConclusao,

        @Schema(description = "Descrição detalhada do defeito ou problema relatado pelo cliente", example = "Máquina desarmando disjuntor ao abrir arco elétrico")
        @NotBlank(message = "O problema relatado é obrigatório")
        String problemaRelatado,

        @Schema(description = "Horímetro atual de uso do equipamento (para geradores ou máquinas com marcador)", example = "1240.5")
        String horimetroAtual,

        @Schema(description = "Observações gerais de recepção", example = "Acompanha cabos de solda e tocha MIG")
        String observacoes
) {
}
