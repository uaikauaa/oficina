package com.oficinagestao.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateInviteRequest(
        @NotBlank @Email @Size(max = 150) String email,
        @NotBlank String role,
        @NotBlank @Size(min = 10, max = 500) String motivo,
        @NotBlank String senhaAtual,
        @NotBlank String confirmacao
) {}
