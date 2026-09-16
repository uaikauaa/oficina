package com.oficinagestao.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record FornecedorUpdateDTO(
        @NotBlank(message = "A razÃ£o social Ã© obrigatÃ³ria.")
        @Size(max = 200, message = "A razÃ£o social deve ter no mÃ¡ximo 200 caracteres.")
        String razaoSocial,

        @Size(max = 200, message = "O nome fantasia deve ter no mÃ¡ximo 200 caracteres.")
        String nomeFantasia,

        @Size(max = 20, message = "O CNPJ deve ter no mÃ¡ximo 20 caracteres.")
        String cnpj,

        @Size(max = 30, message = "A inscriÃ§Ã£o estadual deve ter no mÃ¡ximo 30 caracteres.")
        String inscricaoEstadual,

        @Size(max = 20, message = "O telefone deve ter no mÃ¡ximo 20 caracteres.")
        String telefone,

        @Size(max = 20, message = "O celular deve ter no mÃ¡ximo 20 caracteres.")
        String celular,

        @Size(max = 150, message = "O email deve ter no mÃ¡ximo 150 caracteres.")
        String email,

        @Size(max = 100, message = "O contato principal deve ter no mÃ¡ximo 100 caracteres.")
        String contatoPrincipal,

        String observacoes
) {
}
