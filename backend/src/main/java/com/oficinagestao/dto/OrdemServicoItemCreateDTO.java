package com.oficinagestao.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record OrdemServicoItemCreateDTO(
        @NotNull(message = "O ID da peÃ§a/produto Ã© obrigatÃ³rio.")
        Long produtoId,

        @NotNull(message = "A quantidade Ã© obrigatÃ³ria.")
        @DecimalMin(value = "0.001", message = "A quantidade deve ser maior que zero.")
        BigDecimal quantidade,

        @DecimalMin(value = "0.00", message = "O desconto nÃ£o pode ser negativo.")
        BigDecimal valorDesconto,

        @Size(max = 255, message = "As observaÃ§Ãµes devem ter no mÃ¡ximo 255 caracteres.")
        String observacoes
) {
}
