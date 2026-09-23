package com.oficinagestao.dto;

import com.oficinagestao.entity.TipoEquipamento;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record MaquinaUpdateDTO(

        @NotNull(message = "O tipo de equipamento é obrigatório")
        TipoEquipamento tipoEquipamento,

        @NotBlank(message = "A marca é obrigatória")
        @Size(max = 100, message = "Marca deve ter no máximo 100 caracteres")
        String marca,

        @NotBlank(message = "O modelo é obrigatório")
        @Size(max = 100, message = "Modelo deve ter no máximo 100 caracteres")
        String modelo,

        @Min(value = 1900, message = "Ano de fabricação inválido")
        @Max(value = 2100, message = "Ano de fabricação inválido")
        Integer anoFabricacao,

        @Size(max = 100, message = "Número de série deve ter no máximo 100 caracteres")
        String numeroSerie,

        String horimetro,

        @Size(max = 50, message = "Potência deve ter no máximo 50 caracteres")
        String potencia,

        @Size(max = 50, message = "Tensão deve ter no máximo 50 caracteres")
        String tensao,

        String observacoes
) {
}
