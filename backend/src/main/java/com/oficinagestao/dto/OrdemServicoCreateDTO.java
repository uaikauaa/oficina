package com.oficinagestao.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;

@Schema(description = "Dados para abertura de nova Ordem de ServiÃ§o na oficina")
public record OrdemServicoCreateDTO(

        @Schema(description = "Identificador do cliente proprietÃ¡rio do equipamento", example = "1")
        @NotNull(message = "O identificador do cliente Ã© obrigatÃ³rio")
        Long clienteId,

        @Schema(description = "Identificador do equipamento do cliente que passarÃ¡ pela manutenÃ§Ã£o", example = "3")
        @NotNull(message = "O identificador do equipamento Ã© obrigatÃ³rio")
        Long maquinaId,

        @Schema(description = "NÃºmero da OS (opcional; se nÃ£o informado, serÃ¡ gerado automaticamente no padrÃ£o OS-AAAA-XXXX)", example = "OS-2026-0001")
        @Size(max = 30, message = "O nÃºmero da OS nÃ£o pode exceder 30 caracteres")
        String numeroOs,

        @Schema(description = "Data e hora de entrada do equipamento na oficina (opcional; default Ã© agora)")
        OffsetDateTime dataEntrada,

        @Schema(description = "PrevisÃ£o estimada de conclusÃ£o")
        OffsetDateTime previsaoConclusao,

        @Schema(description = "DescriÃ§Ã£o detalhada do defeito ou problema relatado pelo cliente", example = "MÃ¡quina desarmando disjuntor ao abrir arco elÃ©trico")
        @NotBlank(message = "O problema relatado Ã© obrigatÃ³rio")
        String problemaRelatado,

        @Schema(description = "HorÃ­metro atual de uso do equipamento (para geradores ou mÃ¡quinas com marcador)", example = "1240.5")
        String horimetroAtual,

        @Schema(description = "ObservaÃ§Ãµes gerais de recepÃ§Ã£o", example = "Acompanha cabos de solda e tocha MIG")
        String observacoes
) {
}
