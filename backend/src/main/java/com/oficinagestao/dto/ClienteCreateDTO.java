package com.oficinagestao.dto;

import com.oficinagestao.entity.*;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record ClienteCreateDTO(
        @NotNull(message = "Tipo de pessoa (FISICA ou JURIDICA) é obrigatório")
        TipoPessoa tipoPessoa,

        @NotBlank(message = "Nome ou Razão Social é obrigatório")
        @Size(max = 200, message = "Nome ou Razão Social deve ter no máximo 200 caracteres")
        String nomeRazaoSocial,

        @Size(max = 200, message = "Nome Fantasia deve ter no máximo 200 caracteres")
        String nomeFantasia,

        @Size(max = 20, message = "CPF/CNPJ deve ter no máximo 20 caracteres")
        String cpfCnpj,

        @Size(max = 30, message = "RG ou Inscrição Estadual deve ter no máximo 30 caracteres")
        String rgIe,

        @Size(max = 20, message = "Telefone deve ter no máximo 20 caracteres")
        String telefone,

        @Size(max = 20, message = "Celular deve ter no máximo 20 caracteres")
        String celular,

        @Email(message = "E-mail com formato inválido")
        @Size(max = 150, message = "E-mail deve ter no máximo 150 caracteres")
        String email,

        String observacoes,

        @Pattern(regexp = "^$|^\\d{7}$", message = "Código IBGE deve conter exatamente 7 dígitos numéricos")
        String codigoIbge,

        @Valid
        EnderecoDTO endereco
) {
    public ClienteCreateDTO(
            TipoPessoa tipoPessoa,
            String nomeRazaoSocial,
            String nomeFantasia,
            String cpfCnpj,
            String rgIe,
            String telefone,
            String celular,
            String email,
            String observacoes,
            EnderecoDTO endereco
    ) {
        this(tipoPessoa, nomeRazaoSocial, nomeFantasia, cpfCnpj, rgIe, telefone, celular, email, observacoes, null, endereco);
    }
}
