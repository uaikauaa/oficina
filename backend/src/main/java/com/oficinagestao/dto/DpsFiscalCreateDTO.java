package com.oficinagestao.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record DpsFiscalCreateDTO(
        @NotNull(message = "ID da Ordem de Serviço é obrigatório")
        Long ordemServicoId,

        @Size(max = 10, message = "Série deve ter no máximo 10 caracteres")
        String serie,

        String descricaoServico
) {
}
