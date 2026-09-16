package com.oficinagestao.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record RelatorioClienteItemDTO(
        Long clienteId,
        String nomeRazaoSocial,
        String cpfCnpj,
        String telefone,
        long quantidadeEquipamentos,
        long quantidadeOs,
        OffsetDateTime ultimaVisita,
        BigDecimal valorAcumulado
) {
}
