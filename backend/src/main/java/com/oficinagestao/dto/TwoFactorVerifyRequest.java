package com.oficinagestao.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record TwoFactorVerifyRequest(
        @NotBlank(message = "O token do desafio é obrigatório.")
        String challengeToken,

        @NotBlank(message = "O código de verificação é obrigatório.")
        @Pattern(regexp = "^\\d{6}$", message = "O código deve conter exatamente 6 dígitos numéricos.")
        String code
) {}
