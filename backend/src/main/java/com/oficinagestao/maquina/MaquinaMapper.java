package com.oficinagestao.maquina;

import com.oficinagestao.maquina.dto.MaquinaResponseDTO;
import com.oficinagestao.maquina.dto.MaquinaUpdateDTO;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

@Component
public class MaquinaMapper {

    public MaquinaResponseDTO toResponseDTO(Maquina maquina) {
        if (maquina == null) {
            return null;
        }
        return new MaquinaResponseDTO(
                maquina.getId(),
                maquina.getCliente().getId(),
                maquina.getCliente().getNomeRazaoSocial(),
                maquina.getTipoEquipamento(),
                maquina.getTipoEquipamento() != null ? maquina.getTipoEquipamento().getDescricao() : null,
                maquina.getMarca(),
                maquina.getModelo(),
                maquina.getAnoFabricacao(),
                maquina.getNumeroSerie(),
                maquina.getHorimetro(),
                maquina.getPotencia(),
                maquina.getTensao(),
                maquina.getEspecificacoesTecnicas(),
                maquina.getObservacoes(),
                maquina.getAtivo(),
                maquina.getCreatedAt(),
                maquina.getUpdatedAt()
        );
    }

    public void updateEntity(Maquina maquina, MaquinaUpdateDTO dto) {
        maquina.setTipoEquipamento(dto.tipoEquipamento());
        maquina.setMarca(dto.marca().trim());
        maquina.setModelo(dto.modelo().trim());
        maquina.setAnoFabricacao(dto.anoFabricacao());
        maquina.setNumeroSerie(
                dto.numeroSerie() != null && !dto.numeroSerie().isBlank()
                        ? dto.numeroSerie().trim()
                        : null
        );
        maquina.setHorimetro(parseBigDecimal(dto.horimetro()));
        maquina.setPotencia(
                dto.potencia() != null && !dto.potencia().isBlank()
                        ? dto.potencia().trim()
                        : null
        );
        maquina.setTensao(
                dto.tensao() != null && !dto.tensao().isBlank()
                        ? dto.tensao().trim()
                        : null
        );
        maquina.setObservacoes(dto.observacoes());
    }

    static BigDecimal parseBigDecimal(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return new BigDecimal(value.replace(",", ".").trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
