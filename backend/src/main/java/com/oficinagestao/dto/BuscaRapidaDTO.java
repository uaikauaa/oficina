package com.oficinagestao.dto;

import java.util.List;

public record BuscaRapidaDTO(
        List<ItemBuscaDTO> clientes,
        List<ItemBuscaDTO> maquinas,
        List<ItemBuscaDTO> ordensServico,
        List<ItemBuscaDTO> produtos,
        int totalResultados
) {
    public record ItemBuscaDTO(
            Long id,
            String titulo,
            String subtitulo,
            String tag,
            String url
    ) {}
}
