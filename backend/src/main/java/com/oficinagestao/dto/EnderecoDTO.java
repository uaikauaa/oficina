package com.oficinagestao.dto;

import com.oficinagestao.entity.TipoEndereco;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record EnderecoDTO(
        Long id,

        @Pattern(regexp = "^\\d{5}-?\\d{3}$|^$", message = "CEP deve estar no formato 00000-000 ou 00000000")
        String cep,

        @NotBlank(message = "Logradouro é obrigatório")
        @Size(max = 200, message = "Logradouro deve ter no máximo 200 caracteres")
        String logradouro,

        @NotBlank(message = "Número é obrigatório")
        @Size(max = 20, message = "Número deve ter no máximo 20 caracteres")
        String numero,

        @Size(max = 100, message = "Complemento deve ter no máximo 100 caracteres")
        String complemento,

        @NotBlank(message = "Bairro é obrigatório")
        @Size(max = 100, message = "Bairro deve ter no máximo 100 caracteres")
        String bairro,

        @NotBlank(message = "Cidade é obrigatória")
        @Size(max = 100, message = "Cidade deve ter no máximo 100 caracteres")
        String cidade,

        @NotBlank(message = "Estado (UF) é obrigatório")
        @Size(min = 2, max = 2, message = "Estado deve ser a sigla da UF com 2 caracteres")
        String estado,

        TipoEndereco tipoEndereco
) {
}
