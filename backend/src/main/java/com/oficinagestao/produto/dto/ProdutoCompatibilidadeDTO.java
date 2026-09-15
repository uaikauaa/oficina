package com.oficinagestao.produto.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ProdutoCompatibilidadeDTO(
        @NotNull(message = "O ID da máquina/equipamento é obrigatório.")
        Long maquinaId,

        @Size(max = 255, message = "A observação de compatibilidade deve ter no máximo 255 caracteres.")
        String observacaoCompatibilidade
) {
}
