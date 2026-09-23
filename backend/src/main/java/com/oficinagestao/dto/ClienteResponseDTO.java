package com.oficinagestao.dto;

import com.oficinagestao.entity.*;

import java.time.OffsetDateTime;
import java.util.List;

public record ClienteResponseDTO(
        Long id,
        TipoPessoa tipoPessoa,
        String nomeRazaoSocial,
        String nomeFantasia,
        String cpfCnpj,
        String rgIe,
        String telefone,
        String celular,
        String email,
        Boolean ativo,
        String observacoes,
        String codigoIbge,
        List<EnderecoDTO> enderecos,
        long totalEquipamentos,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
    public ClienteResponseDTO(
            Long id,
            TipoPessoa tipoPessoa,
            String nomeRazaoSocial,
            String nomeFantasia,
            String cpfCnpj,
            String rgIe,
            String telefone,
            String celular,
            String email,
            Boolean ativo,
            String observacoes,
            List<EnderecoDTO> enderecos,
            long totalEquipamentos,
            OffsetDateTime createdAt,
            OffsetDateTime updatedAt
    ) {
        this(
                id,
                tipoPessoa,
                nomeRazaoSocial,
                nomeFantasia,
                cpfCnpj,
                rgIe,
                telefone,
                celular,
                email,
                ativo,
                observacoes,
                null,
                enderecos,
                totalEquipamentos,
                createdAt,
                updatedAt
        );
    }
}
