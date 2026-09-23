package com.oficinagestao.dto;

import java.time.OffsetDateTime;

/**
 * DTO de resposta com os dados completos da configuração da oficina.
 * Retornado pelo endpoint GET /api/configuracao-oficina.
 */
public record ConfiguracaoOficinaResponseDTO(
        Long id,

        /** Nome do sistema. Ex: "Oficina Gestão" */
        String nomeSistema,

        /** Nome fantasia / comercial. Ex: "Bruno Soldas" */
        String nomeFantasia,

        /** Nome empresarial / razão social conforme cadastro fiscal */
        String nomeEmpresarial,

        /** CNPJ. Ex: "45.076.507/0001-67" */
        String cnpj,

        /** Nome do responsável/proprietário (dado administrativo) */
        String responsavel,

        String telefone,
        String email,
        String logradouro,
        String numero,
        String bairro,
        String cep,
        String municipio,
        String uf,

        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {}
