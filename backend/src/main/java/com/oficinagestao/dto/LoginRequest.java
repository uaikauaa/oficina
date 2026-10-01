package com.oficinagestao.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record LoginRequest(
        @NotBlank(message = "O email é obrigatório")
        @Email(message = "Formato de email inválido")
        String email,

        @NotBlank(message = "A senha é obrigatória")
        String senha,

        @JsonProperty("rememberMe")
        Boolean rememberMe
) {
    public LoginRequest(String email, String senha) {
        this(email, senha, false);
    }

    public boolean isRememberMe() {
        return Boolean.TRUE.equals(rememberMe);
    }
}
