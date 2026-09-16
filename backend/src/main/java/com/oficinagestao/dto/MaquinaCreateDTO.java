package com.oficinagestao.dto;

import com.oficinagestao.entity.*;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record MaquinaCreateDTO(

        @NotNull(message = "O ID do cliente Ã© obrigatÃ³rio")
        Long clienteId,

        @NotNull(message = "O tipo de equipamento Ã© obrigatÃ³rio")
        TipoEquipamento tipoEquipamento,

        @NotBlank(message = "A marca Ã© obrigatÃ³ria")
        @Size(max = 100, message = "Marca deve ter no mÃ¡ximo 100 caracteres")
        String marca,

        @NotBlank(message = "O modelo Ã© obrigatÃ³rio")
        @Size(max = 100, message = "Modelo deve ter no mÃ¡ximo 100 caracteres")
        String modelo,

        @Min(value = 1900, message = "Ano de fabricaÃ§Ã£o invÃ¡lido")
        @Max(value = 2100, message = "Ano de fabricaÃ§Ã£o invÃ¡lido")
        Integer anoFabricacao,

        @Size(max = 100, message = "NÃºmero de sÃ©rie deve ter no mÃ¡ximo 100 caracteres")
        String numeroSerie,

        String horimetro,

        @Size(max = 50, message = "PotÃªncia deve ter no mÃ¡ximo 50 caracteres")
        String potencia,

        @Size(max = 50, message = "TensÃ£o deve ter no mÃ¡ximo 50 caracteres")
        String tensao,

        String observacoes
) {
}
