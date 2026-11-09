package com.oficinagestao.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record BootstrapSuperAdminRequest(
        @NotBlank String senhaAtual,
        @NotBlank @Size(min = 10, max = 500) String motivo,
        @NotBlank String confirmacao
) {}
