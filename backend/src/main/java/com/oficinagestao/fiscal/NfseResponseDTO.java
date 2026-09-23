package com.oficinagestao.fiscal;

import java.time.OffsetDateTime;

/**
 * DTO preparatório para resposta de futuros provedores de emissão de NFS-e.
 *
 * NOTA: A emissão fiscal real NÃO está implementada nesta fase.
 */
public record NfseResponseDTO(
        boolean sucesso,
        String numeroNfse,
        String chaveAcesso,
        String protocolo,
        String xmlRetorno,
        String mensagem,
        OffsetDateTime dataProcessamento
) {
    public static NfseResponseDTO preparacaoApenas(String mensagem) {
        return new NfseResponseDTO(
                false,
                null,
                null,
                null,
                null,
                mensagem,
                OffsetDateTime.now()
        );
    }
}
