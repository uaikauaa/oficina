package com.oficinagestao.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Schema(description = "Dados para atualização técnica e financeira de uma Ordem de Serviço")
public record OrdemServicoUpdateDTO(

        @Schema(description = "Descrição detalhada do problema relatado")
        String problemaRelatado,

        @Schema(description = "Diagnóstico técnico constatado pelo técnico na bancada", example = "Ponte retificadora em curto-circuito e placa osciladora danificada")
        String diagnostico,

        @Schema(description = "Solução técnica executada no equipamento", example = "Substituição da ponte de diodos e reparo dos trilhos da placa")
        String solucaoAplicada,

        @Schema(description = "Registro de testes técnicos realizados na bancada sob carga", example = "Teste de arco sob carga de 180A por 15 min sem aquecimento anômalo")
        String testesRealizados,

        @Schema(description = "Observações gerais")
        String observacoes,

        @Schema(description = "Horímetro atualizado do equipamento", example = "1240.5")
        String horimetroAtual,

        @Schema(description = "Valor da mão de obra / serviços técnicos", example = "250.00")
        @DecimalMin(value = "0.00", message = "O valor da mão de obra não pode ser negativo")
        BigDecimal valorMaoObra,

        @Schema(description = "Valor total das peças e componentes utilizados", example = "380.00")
        @DecimalMin(value = "0.00", message = "O valor de peças não pode ser negativo")
        BigDecimal valorPecas,

        @Schema(description = "Valor de desconto concedido", example = "30.00")
        @DecimalMin(value = "0.00", message = "O valor de desconto não pode ser negativo")
        BigDecimal valorDesconto,

        @Schema(description = "Previsão de conclusão")
        OffsetDateTime previsaoConclusao
) {
}
