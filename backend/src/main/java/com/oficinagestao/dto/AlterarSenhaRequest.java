package com.oficinagestao.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

@Schema(description = "Dados para alteração de senha da usuária autenticada")
public record AlterarSenhaRequest(
        @NotBlank(message = "A senha atual é obrigatória")
        @Schema(description = "Senha atual em uso", example = "SenhaAntiga#2026")
        String senhaAtual,

        @NotBlank(message = "A nova senha é obrigatória")
        @Schema(description = "Nova senha segura (mínimo 12 caracteres, com letra, número e especial)", example = "NovaSenhaSegura@2026")
        String novaSenha,

        @NotBlank(message = "A confirmação da nova senha é obrigatória")
        @Schema(description = "Confirmação exata da nova senha", example = "NovaSenhaSegura@2026")
        String confirmacaoNovaSenha
) {
}
