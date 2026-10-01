package com.oficinagestao.dto;

import jakarta.validation.constraints.NotBlank;

public record TwoFactorResendRequest(
        @NotBlank(message = "O token do desafio é obrigatório.")
        String challengeToken
) {}
