package com.oficinagestao.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record LoginRequest(
        @NotBlank(message = "O email Ã© obrigatÃ³rio")
        @Email(message = "Formato de email invÃ¡lido")
        String email,

        @NotBlank(message = "A senha Ã© obrigatÃ³ria")
        String senha
) {
}
