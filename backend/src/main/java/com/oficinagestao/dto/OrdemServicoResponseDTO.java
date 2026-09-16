package com.oficinagestao.dto;

import com.oficinagestao.entity.*;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Schema(description = "RepresentaÃ§Ã£o completa de uma Ordem de ServiÃ§o na assistÃªncia tÃ©cnica")
public record OrdemServicoResponseDTO(

        @Schema(description = "Identificador Ãºnico da OS", example = "1")
        Long id,

        @Schema(description = "NÃºmero formatado da OS", example = "OS-2026-0001")
        String numeroOs,

        // Cliente
        @Schema(description = "ID do cliente proprietÃ¡rio", example = "1")
        Long clienteId,

        @Schema(description = "Nome ou RazÃ£o Social do cliente", example = "MetalÃºrgica SÃ£o Pedro Ltda")
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

        @Schema(description = "DescriÃ§Ã£o amigÃ¡vel do tipo do equipamento", example = "MÃ¡quina de Solda")
        String maquinaTipoDescricao,

        @Schema(description = "Marca do equipamento", example = "ESAB")
        String maquinaMarca,

        @Schema(description = "Modelo do equipamento", example = "Smashweld 450 TopFlex")
        String maquinaModelo,

        @Schema(description = "NÃºmero de sÃ©rie do equipamento", example = "SN-2025-9876")
        String maquinaNumeroSerie,

        @Schema(description = "PotÃªncia do equipamento", example = "450A")
        String maquinaPotencia,

        @Schema(description = "TensÃ£o de trabalho do equipamento", example = "220V/380V TrifÃ¡sico")
        String maquinaTensao,

        // TÃ©cnico ResponsÃ¡vel
        @Schema(description = "ID do tÃ©cnico responsÃ¡vel (se atribuÃ­do)")
        Long tecnicoId,

        @Schema(description = "Nome do tÃ©cnico responsÃ¡vel")
        String tecnicoNome,

        // Atendimento
        @Schema(description = "Status atual da Ordem de ServiÃ§o", example = "ABERTA")
        StatusOrdemServico status,

        @Schema(description = "DescriÃ§Ã£o amigÃ¡vel do status", example = "Aberta")
        String statusDescricao,

        @Schema(description = "Data e hora de entrada do equipamento")
        OffsetDateTime dataEntrada,

        @Schema(description = "PrevisÃ£o estimada de conclusÃ£o")
        OffsetDateTime previsaoConclusao,

        @Schema(description = "Data e hora de conclusÃ£o e entrega do equipamento")
        OffsetDateTime dataConclusao,

        @Schema(description = "Defeito ou problema relatado pelo cliente")
        String problemaRelatado,

        @Schema(description = "DiagnÃ³stico tÃ©cnico de bancada")
        String diagnostico,

        @Schema(description = "SoluÃ§Ã£o tÃ©cnica aplicada")
        String solucaoAplicada,

        @Schema(description = "Registro dos testes tÃ©cnicos de bancada realizados")
        String testesRealizados,

        @Schema(description = "ObservaÃ§Ãµes gerais de atendimento")
        String observacoes,

        @Schema(description = "HorÃ­metro no momento da entrada")
        BigDecimal horimetroAtual,

        // Financeiro
        @Schema(description = "Valor da mÃ£o de obra tÃ©cnica", example = "250.00")
        BigDecimal valorMaoObra,

        @Schema(description = "Valor de peÃ§as e insumos", example = "180.00")
        BigDecimal valorPecas,

        @Schema(description = "Valor de desconto concedido", example = "30.00")
        BigDecimal valorDesconto,

        @Schema(description = "Valor total da Ordem de ServiÃ§o", example = "400.00")
        BigDecimal valorTotal,

        // Auditoria
        @Schema(description = "Data de abertura do registro")
        OffsetDateTime createdAt,

        @Schema(description = "Data da Ãºltima atualizaÃ§Ã£o do registro")
        OffsetDateTime updatedAt
) {
}
