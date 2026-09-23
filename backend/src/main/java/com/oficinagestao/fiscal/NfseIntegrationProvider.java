package com.oficinagestao.fiscal;

import com.oficinagestao.entity.DpsFiscal;

/**
 * Interface preparatória para o contrato de integração com provedores de NFS-e
 * (ex: Emissor Nacional / SEFIN Nacional / Prefeitura).
 *
 * REGRA ARQUITETURAL:
 * A implementação real deste provedor exigirá certificado digital A1, assinatura de XML
 * e homologação na SEFIN, os quais NÃO fazem parte do escopo da Fase 6.3.
 */
public interface NfseIntegrationProvider {

    /**
     * Identificador do provedor (ex: "SEFIN_NACIONAL", "PREFEITURA_OURINHOS").
     */
    String getIdentificador();

    /**
     * Valida se o documento DPS está apto para transmissão fiscal.
     */
    boolean validarAptidaoEmissao(DpsFiscal dps);

    /**
     * Método reservado para futura transmissão quando os certificados e credenciais estiverem disponíveis.
     */
    NfseResponseDTO transmitirDps(DpsFiscal dps);
}
