package com.oficinagestao.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.Set;

public record RoleChangeRequest(
        @NotBlank String nome,
        @NotBlank @Size(max = 255) String descricao,
        @NotNull @Size(max = 100) Set<String> permissoes,
        @NotBlank @Size(min = 10, max = 500) String motivo,
        @NotBlank String senhaAtual,
        @NotBlank String confirmacao
) {}
