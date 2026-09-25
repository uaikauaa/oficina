package com.oficinagestao.dto;

import com.oficinagestao.entity.TipoProduto;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

import jakarta.validation.constraints.Pattern;

public record ProdutoUpdateDTO(
        @Size(max = 50, message = "O código deve ter no máximo 50 caracteres.")
        String codigo,

        @Pattern(regexp = "^(https?://\\S+)?$", message = "O link de compra deve ser uma URL válida iniciando com http:// ou https:// sem espaços.")
        @Size(max = 1000, message = "O link de compra deve ter no máximo 1000 caracteres.")
        String linkCompra,

        @NotBlank(message = "O nome do produto é obrigatório.")
        @Size(max = 200, message = "O nome deve ter no máximo 200 caracteres.")
        String nome,

        String descricao,

        @Size(max = 100, message = "A marca deve ter no máximo 100 caracteres.")
        String marca,

        TipoProduto tipo,

        @Size(max = 10, message = "A unidade de medida deve ter no máximo 10 caracteres.")
        String unidadeMedida,

        @NotNull(message = "O preço de custo é obrigatório.")
        @DecimalMin(value = "0.00", message = "O preço de custo não pode ser negativo.")
        BigDecimal precoCusto,

        @NotNull(message = "O preço de venda é obrigatório.")
        @DecimalMin(value = "0.00", message = "O preço de venda não pode ser negativo.")
        BigDecimal precoVenda,

        @DecimalMin(value = "0.000", message = "O estoque mínimo não pode ser negativo.")
        BigDecimal estoqueMinimo,

        @Size(max = 50, message = "A localização deve ter no máximo 50 caracteres.")
        String localizacao,

        Long categoriaId,

        Long fornecedorId
) {
}
