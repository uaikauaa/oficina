package com.oficinagestao.dto;

import com.oficinagestao.entity.TipoMovimentacaoEstoque;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record EstoqueAjusteDTO(
        @NotNull(message = "O ID do produto é obrigatório.")
        Long produtoId,

        @NotNull(message = "A quantidade é obrigatória.")
        @DecimalMin(value = "0.001", message = "A quantidade deve ser maior que zero.")
        BigDecimal quantidade,

        @NotNull(message = "O tipo de movimentação de ajuste é obrigatório (AJUSTE_POSITIVO ou AJUSTE_NEGATIVO).")
        TipoMovimentacaoEstoque tipoMovimentacao,

        @NotBlank(message = "O motivo do ajuste é obrigatório.")
        @Size(max = 255, message = "O motivo deve ter no máximo 255 caracteres.")
        String motivo
) {
}
