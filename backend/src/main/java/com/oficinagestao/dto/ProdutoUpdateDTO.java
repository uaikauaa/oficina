package com.oficinagestao.dto;

import com.oficinagestao.entity.*;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record ProdutoUpdateDTO(
        @NotBlank(message = "O cÃ³digo do produto Ã© obrigatÃ³rio.")
        @Size(max = 50, message = "O cÃ³digo deve ter no mÃ¡ximo 50 caracteres.")
        String codigo,

        @Size(max = 50, message = "O cÃ³digo de barras deve ter no mÃ¡ximo 50 caracteres.")
        String codigoBarras,

        @NotBlank(message = "O nome do produto Ã© obrigatÃ³rio.")
        @Size(max = 200, message = "O nome deve ter no mÃ¡ximo 200 caracteres.")
        String nome,

        String descricao,

        TipoProduto tipo,

        @Size(max = 10, message = "A unidade de medida deve ter no mÃ¡ximo 10 caracteres.")
        String unidadeMedida,

        @NotNull(message = "O preÃ§o de custo Ã© obrigatÃ³rio.")
        @DecimalMin(value = "0.00", message = "O preÃ§o de custo nÃ£o pode ser negativo.")
        BigDecimal precoCusto,

        @NotNull(message = "O preÃ§o de venda Ã© obrigatÃ³rio.")
        @DecimalMin(value = "0.00", message = "O preÃ§o de venda nÃ£o pode ser negativo.")
        BigDecimal precoVenda,

        @DecimalMin(value = "0.000", message = "O estoque mÃ­nimo nÃ£o pode ser negativo.")
        BigDecimal estoqueMinimo,

        @Size(max = 50, message = "A localizaÃ§Ã£o deve ter no mÃ¡ximo 50 caracteres.")
        String localizacao,

        Long fornecedorId
) {
}
