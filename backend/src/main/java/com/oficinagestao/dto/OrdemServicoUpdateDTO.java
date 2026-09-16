package com.oficinagestao.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Schema(description = "Dados para atualizaÃ§Ã£o tÃ©cnica e financeira de uma Ordem de ServiÃ§o")
public record OrdemServicoUpdateDTO(

        @Schema(description = "DescriÃ§Ã£o detalhada do problema relatado")
        String problemaRelatado,

        @Schema(description = "DiagnÃ³stico tÃ©cnico constatado pelo tÃ©cnico na bancada", example = "Ponte retificadora em curto-circuito e placa osciladora danificada")
        String diagnostico,

        @Schema(description = "SoluÃ§Ã£o tÃ©cnica executada no equipamento", example = "SubstituiÃ§Ã£o da ponte de diodos e reparo dos trilhos da placa")
        String solucaoAplicada,

        @Schema(description = "Registro de testes tÃ©cnicos realizados na bancada sob carga", example = "Teste de arco sob carga de 180A por 15 min sem aquecimento anÃ´malo")
        String testesRealizados,

        @Schema(description = "ObservaÃ§Ãµes gerais")
        String observacoes,

        @Schema(description = "HorÃ­metro atualizado do equipamento", example = "1240.5")
        String horimetroAtual,

        @Schema(description = "Valor da mÃ£o de obra / serviÃ§os tÃ©cnicos", example = "250.00")
        @DecimalMin(value = "0.00", message = "O valor da mÃ£o de obra nÃ£o pode ser negativo")
        BigDecimal valorMaoObra,

        @Schema(description = "Valor total das peÃ§as e componentes utilizados", example = "380.00")
        @DecimalMin(value = "0.00", message = "O valor de peÃ§as nÃ£o pode ser negativo")
        BigDecimal valorPecas,

        @Schema(description = "Valor de desconto concedido", example = "30.00")
        @DecimalMin(value = "0.00", message = "O valor de desconto nÃ£o pode ser negativo")
        BigDecimal valorDesconto,

        @Schema(description = "PrevisÃ£o de conclusÃ£o")
        OffsetDateTime previsaoConclusao
) {
}
