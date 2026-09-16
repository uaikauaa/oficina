package com.oficinagestao.dto;

import com.oficinagestao.entity.*;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record MovimentacaoManualDTO(
        @NotNull(message = "O ID do produto Ã© obrigatÃ³rio.")
        Long produtoId,

        @NotNull(message = "O tipo de movimentaÃ§Ã£o Ã© obrigatÃ³rio.")
        TipoMovimentacaoEstoque tipoMovimentacao,

        @NotNull(message = "A quantidade Ã© obrigatÃ³ria.")
        @DecimalMin(value = "0.001", message = "A quantidade deve ser maior que zero.")
        BigDecimal quantidade,

        @DecimalMin(value = "0.00", message = "O valor unitÃ¡rio nÃ£o pode ser negativo.")
        BigDecimal valorUnitario,

        @NotBlank(message = "O motivo da movimentaÃ§Ã£o Ã© obrigatÃ³rio.")
        @Size(max = 255, message = "O motivo deve ter no mÃ¡ximo 255 caracteres.")
        String motivo
) {
}
