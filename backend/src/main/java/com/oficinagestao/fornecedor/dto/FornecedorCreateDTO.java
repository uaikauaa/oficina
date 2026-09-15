package com.oficinagestao.fornecedor.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record FornecedorCreateDTO(
        @NotBlank(message = "A razão social é obrigatória.")
        @Size(max = 200, message = "A razão social deve ter no máximo 200 caracteres.")
        String razaoSocial,

        @Size(max = 200, message = "O nome fantasia deve ter no máximo 200 caracteres.")
        String nomeFantasia,

        @Size(max = 20, message = "O CNPJ deve ter no máximo 20 caracteres.")
        String cnpj,

        @Size(max = 30, message = "A inscrição estadual deve ter no máximo 30 caracteres.")
        String inscricaoEstadual,

        @Size(max = 20, message = "O telefone deve ter no máximo 20 caracteres.")
        String telefone,

        @Size(max = 20, message = "O celular deve ter no máximo 20 caracteres.")
        String celular,

        @Size(max = 150, message = "O email deve ter no máximo 150 caracteres.")
        String email,

        @Size(max = 100, message = "O contato principal deve ter no máximo 100 caracteres.")
        String contatoPrincipal,

        String observacoes
) {
}
