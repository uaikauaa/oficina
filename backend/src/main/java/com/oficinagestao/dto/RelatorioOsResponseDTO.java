package com.oficinagestao.dto;

import org.springframework.data.domain.Page;

public record RelatorioOsResponseDTO(
        RelatorioOsResumoDTO resumo,
        Page<OrdemServicoResponseDTO> itens
) {
}
