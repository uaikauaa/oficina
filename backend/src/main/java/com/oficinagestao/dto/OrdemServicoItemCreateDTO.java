package com.oficinagestao.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record OrdemServicoItemCreateDTO(
        @NotNull(message = "O ID da peça/produto é obrigatório.")
        Long produtoId,

        @NotNull(message = "A quantidade é obrigatória.")
        @DecimalMin(value = "0.001", message = "A quantidade deve ser maior que zero.")
        BigDecimal quantidade,

        @DecimalMin(value = "0.00", message = "O desconto não pode ser negativo.")
        BigDecimal valorDesconto,

        @Size(max = 255, message = "As observações devem ter no máximo 255 caracteres.")
        String observacoes
) {
}
