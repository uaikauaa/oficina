package com.oficinagestao.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * DTO de atualização dos dados da oficina.
 * Usado pelo endpoint PUT /api/configuracao-oficina.
 *
 * Contém os dados comerciais e de contato da oficina.
 * Nenhum campo fiscal é armazenado — o sistema não emite NFS-e.
 */
public record ConfiguracaoOficinaUpdateDTO(

        /** Nome fantasia/comercial. Ex: "Bruno Soldas" */
        @NotBlank(message = "Nome fantasia é obrigatório.")
        @Size(max = 200, message = "Nome fantasia deve ter no máximo 200 caracteres.")
        String nomeFantasia,

        /** Nome empresarial conforme cadastro fiscal */
        @Size(max = 200, message = "Nome empresarial deve ter no máximo 200 caracteres.")
        String nomeEmpresarial,

        /** CNPJ. Aceito com ou sem formatação. */
        @Size(max = 20, message = "CNPJ deve ter no máximo 20 caracteres.")
        String cnpj,

        /** Nome do responsável/proprietário (dado administrativo) */
        @Size(max = 200, message = "Nome do responsável deve ter no máximo 200 caracteres.")
        String responsavel,

        @Size(max = 30, message = "Telefone deve ter no máximo 30 caracteres.")
        String telefone,

        @Email(message = "E-mail inválido.")
        @Size(max = 200, message = "E-mail deve ter no máximo 200 caracteres.")
        String email,

        @Size(max = 300, message = "Logradouro deve ter no máximo 300 caracteres.")
        String logradouro,

        @Size(max = 20, message = "Número deve ter no máximo 20 caracteres.")
        String numero,

        @Size(max = 100, message = "Bairro deve ter no máximo 100 caracteres.")
        String bairro,

        @Size(max = 20, message = "CEP deve ter no máximo 20 caracteres.")
        String cep,

        @Size(max = 100, message = "Município deve ter no máximo 100 caracteres.")
        String municipio,

        @Size(max = 2, message = "UF deve ter no máximo 2 caracteres.")
        String uf
) {}
