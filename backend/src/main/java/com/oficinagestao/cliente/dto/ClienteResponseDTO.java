package com.oficinagestao.cliente.dto;

import com.oficinagestao.cliente.TipoPessoa;

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
        List<EnderecoDTO> enderecos,
        long totalEquipamentos,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
}
