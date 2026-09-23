package com.oficinagestao.dto;

import com.oficinagestao.entity.StatusDpsFiscal;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record DpsFiscalResponseDTO(
        Long id,
        Long ordemServicoId,
        String numeroOs,
        Long clienteId,
        String serie,
        Long numero,
        StatusDpsFiscal status,
        OffsetDateTime dataEmissao,
        BigDecimal valorServico,
        String codigoTributacaoServico,
        String descricaoServico,
        String municipioPrestacao,
        String codigoIbgePrestacao,

        // Snapshot Prestador
        String prestadorCnpj,
        String prestadorRazaoSocial,
        String prestadorNomeFantasia,
        String prestadorInscricaoMunicipal,
        String prestadorRegimeTributario,
        String prestadorLogradouro,
        String prestadorNumero,
        String prestadorBairro,
        String prestadorCep,
        String prestadorMunicipio,
        String prestadorUf,
        String prestadorCodigoIbge,

        // Snapshot Tomador
        String tomadorTipoPessoa,
        String tomadorCpfCnpj,
        String tomadorRazaoSocial,
        String tomadorNomeFantasia,
        String tomadorRgIe,
        String tomadorEmail,
        String tomadorTelefone,
        String tomadorLogradouro,
        String tomadorNumero,
        String tomadorComplemento,
        String tomadorBairro,
        String tomadorCidade,
        String tomadorUf,
        String tomadorCep,
        String tomadorCodigoIbge,

        // Dados de retorno futuro NFS-e
        String numeroNfse,
        String chaveAcessoNfse,
        String xmlAutorizado,
        String mensagensRetorno,

        // Preparatório Reforma Tributária (IBS / CBS)
        BigDecimal aliquotaIbs,
        BigDecimal valorIbs,
        BigDecimal aliquotaCbs,
        BigDecimal valorCbs,
        String codigoTributacaoIbsCbs,

        Long usuarioPreparacaoId,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
}
