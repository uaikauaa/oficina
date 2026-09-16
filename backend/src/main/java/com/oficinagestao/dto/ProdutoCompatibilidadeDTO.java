package com.oficinagestao.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ProdutoCompatibilidadeDTO(
        @NotNull(message = "O ID da mÃ¡quina/equipamento Ã© obrigatÃ³rio.")
        Long maquinaId,

        @Size(max = 255, message = "A observaÃ§Ã£o de compatibilidade deve ter no mÃ¡ximo 255 caracteres.")
        String observacaoCompatibilidade
) {
}
