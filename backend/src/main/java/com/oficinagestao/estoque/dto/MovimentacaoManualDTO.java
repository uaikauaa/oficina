package com.oficinagestao.estoque.dto;

import com.oficinagestao.estoque.TipoMovimentacaoEstoque;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record MovimentacaoManualDTO(
        @NotNull(message = "O ID do produto é obrigatório.")
        Long produtoId,

        @NotNull(message = "O tipo de movimentação é obrigatório.")
        TipoMovimentacaoEstoque tipoMovimentacao,

        @NotNull(message = "A quantidade é obrigatória.")
        @DecimalMin(value = "0.001", message = "A quantidade deve ser maior que zero.")
        BigDecimal quantidade,

        @DecimalMin(value = "0.00", message = "O valor unitário não pode ser negativo.")
        BigDecimal valorUnitario,

        @NotBlank(message = "O motivo da movimentação é obrigatório.")
        @Size(max = 255, message = "O motivo deve ter no máximo 255 caracteres.")
        String motivo
) {
}
