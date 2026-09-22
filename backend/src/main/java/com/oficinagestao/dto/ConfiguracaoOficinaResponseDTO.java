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

        /** Inscrição municipal (pode ser null) */
        String inscricaoMunicipal,

        /** Regime tributário de referência. Ex: "Simples Nacional / MEI" */
        String regimeTributario,

        /**
         * Código de tributação de referência baseado na NFS-e.
         * Não deve ser assumido como padrão fixo para todas as emissões futuras.
         */
        String codigoTributacaoServico,

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

        /** Código IBGE do município conforme NFS-e de referência. Ex: "35.34708" */
        String codigoIbge,

        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {}
