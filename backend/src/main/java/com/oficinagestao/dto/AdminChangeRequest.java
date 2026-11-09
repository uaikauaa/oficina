package com.oficinagestao.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AdminChangeRequest(
        @NotBlank @Size(min = 10, max = 500) String motivo,
        @NotBlank String senhaAtual,
        @NotBlank String confirmacao,
        Boolean ativo,
        java.util.Set<String> roles
) {}
