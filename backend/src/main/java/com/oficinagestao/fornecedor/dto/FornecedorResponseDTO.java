package com.oficinagestao.fornecedor.dto;

import java.time.OffsetDateTime;

public record FornecedorResponseDTO(
        Long id,
        String razaoSocial,
        String nomeFantasia,
        String cnpj,
        String inscricaoEstadual,
        String telefone,
        String celular,
        String email,
        String contatoPrincipal,
        boolean ativo,
        String observacoes,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
}
