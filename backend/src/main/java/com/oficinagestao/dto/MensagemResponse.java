package com.oficinagestao.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Resposta simples com mensagem informativa da operação")
public record MensagemResponse(
        @Schema(description = "Mensagem de retorno", example = "Senha alterada com sucesso.")
        String message
) {
}
