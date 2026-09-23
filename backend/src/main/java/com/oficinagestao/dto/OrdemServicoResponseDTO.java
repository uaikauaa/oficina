package com.oficinagestao.dto;

import com.oficinagestao.entity.StatusOrdemServico;
import com.oficinagestao.entity.TipoEquipamento;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Schema(description = "Representação completa de uma Ordem de Serviço na assistência técnica")
public record OrdemServicoResponseDTO(

        @Schema(description = "Identificador único da OS", example = "1")
        Long id,

        @Schema(description = "Número formatado da OS", example = "OS-2026-0001")
        String numeroOs,

        // Cliente
        @Schema(description = "ID do cliente proprietário", example = "1")
        Long clienteId,

        @Schema(description = "Nome ou Razão Social do cliente", example = "Metalúrgica São Pedro Ltda")
        String clienteNome,

        @Schema(description = "Telefone ou celular para contato do cliente", example = "(11) 98765-4321")
        String clienteTelefone,

        @Schema(description = "CPF ou CNPJ do cliente", example = "12.345.678/0001-90")
        String clienteCpfCnpj,

        // Equipamento
        @Schema(description = "ID do equipamento cadastrado", example = "3")
        Long maquinaId,

        @Schema(description = "Tipo do equipamento", example = "MAQUINA_SOLDA")
        TipoEquipamento maquinaTipoEquipamento,

        @Schema(description = "Descrição amigável do tipo do equipamento", example = "Máquina de Solda")
        String maquinaTipoDescricao,

        @Schema(description = "Marca do equipamento", example = "ESAB")
        String maquinaMarca,

        @Schema(description = "Modelo do equipamento", example = "Smashweld 450 TopFlex")
        String maquinaModelo,

        @Schema(description = "Número de série do equipamento", example = "SN-2025-9876")
        String maquinaNumeroSerie,

        @Schema(description = "Potência do equipamento", example = "450A")
        String maquinaPotencia,

        @Schema(description = "Tensão de trabalho do equipamento", example = "220V/380V Trifásico")
        String maquinaTensao,

        // Técnico Responsável
        @Schema(description = "ID do técnico responsável (se atribuído)")
        Long tecnicoId,

        @Schema(description = "Nome do técnico responsável")
        String tecnicoNome,

        // Atendimento
        @Schema(description = "Status atual da Ordem de Serviço", example = "ABERTA")
        StatusOrdemServico status,

        @Schema(description = "Descrição amigável do status", example = "Aberta")
        String statusDescricao,

        @Schema(description = "Data e hora de entrada do equipamento")
        OffsetDateTime dataEntrada,

        @Schema(description = "Previsão estimada de conclusão")
        OffsetDateTime previsaoConclusao,

        @Schema(description = "Data e hora de conclusão e entrega do equipamento")
        OffsetDateTime dataConclusao,

        @Schema(description = "Defeito ou problema relatado pelo cliente")
        String problemaRelatado,

        @Schema(description = "Diagnóstico técnico de bancada")
        String diagnostico,

        @Schema(description = "Solução técnica aplicada")
        String solucaoAplicada,

        @Schema(description = "Registro dos testes técnicos de bancada realizados")
        String testesRealizados,

        @Schema(description = "Observações gerais de atendimento")
        String observacoes,

        @Schema(description = "Horímetro no momento da entrada")
        BigDecimal horimetroAtual,

        // Financeiro
        @Schema(description = "Valor da mão de obra técnica", example = "250.00")
        BigDecimal valorMaoObra,

        @Schema(description = "Valor de peças e insumos", example = "180.00")
        BigDecimal valorPecas,

        @Schema(description = "Valor de desconto concedido", example = "30.00")
        BigDecimal valorDesconto,

        @Schema(description = "Valor total da Ordem de Serviço", example = "400.00")
        BigDecimal valorTotal,

        // Auditoria
        @Schema(description = "Data de abertura do registro")
        OffsetDateTime createdAt,

        @Schema(description = "Data da última atualização do registro")
        OffsetDateTime updatedAt
) {
}
