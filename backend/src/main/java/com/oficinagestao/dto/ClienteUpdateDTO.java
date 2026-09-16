package com.oficinagestao.dto;

import com.oficinagestao.entity.*;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ClienteUpdateDTO(
        @NotNull(message = "Tipo de pessoa (FISICA ou JURIDICA) Ã© obrigatÃ³rio")
        TipoPessoa tipoPessoa,

        @NotBlank(message = "Nome ou RazÃ£o Social Ã© obrigatÃ³rio")
        @Size(max = 200, message = "Nome ou RazÃ£o Social deve ter no mÃ¡ximo 200 caracteres")
        String nomeRazaoSocial,

        @Size(max = 200, message = "Nome Fantasia deve ter no mÃ¡ximo 200 caracteres")
        String nomeFantasia,

        @Size(max = 20, message = "CPF/CNPJ deve ter no mÃ¡ximo 20 caracteres")
        String cpfCnpj,

        @Size(max = 30, message = "RG ou InscriÃ§Ã£o Estadual deve ter no mÃ¡ximo 30 caracteres")
        String rgIe,

        @Size(max = 20, message = "Telefone deve ter no mÃ¡ximo 20 caracteres")
        String telefone,

        @Size(max = 20, message = "Celular deve ter no mÃ¡ximo 20 caracteres")
        String celular,

        @Email(message = "E-mail com formato invÃ¡lido")
        @Size(max = 150, message = "E-mail deve ter no mÃ¡ximo 150 caracteres")
        String email,

        Boolean ativo,

        String observacoes,

        @Valid
        EnderecoDTO endereco
) {
}
