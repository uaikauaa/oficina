package com.oficinagestao.ordem;

import com.oficinagestao.cliente.Cliente;
import com.oficinagestao.maquina.Maquina;
import com.oficinagestao.ordem.dto.OrdemServicoResponseDTO;
import com.oficinagestao.ordem.dto.OrdemServicoUpdateDTO;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

@Component
public class OrdemServicoMapper {

    public OrdemServicoResponseDTO toResponseDTO(OrdemServico entity) {
        if (entity == null) {
            return null;
        }

        Cliente cliente = entity.getCliente();
        Maquina maquina = entity.getMaquina();

        String clienteTelefone = null;
        String clienteNome = null;
        String clienteCpfCnpj = null;
        Long clienteId = null;

        if (cliente != null) {
            clienteId = cliente.getId();
            clienteNome = cliente.getNomeRazaoSocial();
            clienteCpfCnpj = cliente.getCpfCnpj();
            if (cliente.getCelular() != null && !cliente.getCelular().isBlank()) {
                clienteTelefone = cliente.getCelular();
            } else {
                clienteTelefone = cliente.getTelefone();
            }
        }

        return new OrdemServicoResponseDTO(
                entity.getId(),
                entity.getNumeroOs(),
                clienteId,
                clienteNome,
                clienteTelefone,
                clienteCpfCnpj,
                maquina != null ? maquina.getId() : null,
                maquina != null ? maquina.getTipoEquipamento() : null,
                maquina != null && maquina.getTipoEquipamento() != null ? maquina.getTipoEquipamento().getDescricao() : null,
                maquina != null ? maquina.getMarca() : null,
                maquina != null ? maquina.getModelo() : null,
                maquina != null ? maquina.getNumeroSerie() : null,
                maquina != null ? maquina.getPotencia() : null,
                maquina != null ? maquina.getTensao() : null,
                entity.getTecnicoResponsavel() != null ? entity.getTecnicoResponsavel().getId() : null,
                entity.getTecnicoResponsavel() != null ? entity.getTecnicoResponsavel().getNome() : null,
                entity.getStatus(),
                entity.getStatus() != null ? entity.getStatus().getDescricao() : null,
                entity.getDataEntrada(),
                entity.getPrevisaoConclusao(),
                entity.getDataConclusao(),
                entity.getProblemaRelatado(),
                entity.getDiagnostico(),
                entity.getSolucaoAplicada(),
                entity.getTestesRealizados(),
                entity.getObservacoes(),
                entity.getHorimetroAtual(),
                entity.getValorMaoObra(),
                entity.getValorPecas(),
                entity.getValorDesconto(),
                entity.getValorTotal(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    public void updateEntity(OrdemServico entity, OrdemServicoUpdateDTO dto) {
        if (dto.problemaRelatado() != null && !dto.problemaRelatado().isBlank()) {
            entity.setProblemaRelatado(dto.problemaRelatado().trim());
        }
        if (dto.diagnostico() != null) {
            entity.setDiagnostico(dto.diagnostico().trim().isEmpty() ? null : dto.diagnostico().trim());
        }
        if (dto.solucaoAplicada() != null) {
            entity.setSolucaoAplicada(dto.solucaoAplicada().trim().isEmpty() ? null : dto.solucaoAplicada().trim());
        }
        if (dto.testesRealizados() != null) {
            entity.setTestesRealizados(dto.testesRealizados().trim().isEmpty() ? null : dto.testesRealizados().trim());
        }
        if (dto.observacoes() != null) {
            entity.setObservacoes(dto.observacoes().trim().isEmpty() ? null : dto.observacoes().trim());
        }
        if (dto.horimetroAtual() != null) {
            entity.setHorimetroAtual(parseBigDecimal(dto.horimetroAtual()));
        }
        if (dto.valorMaoObra() != null) {
            entity.setValorMaoObra(dto.valorMaoObra());
        }
        if (dto.valorPecas() != null) {
            entity.setValorPecas(dto.valorPecas());
        }
        if (dto.valorDesconto() != null) {
            entity.setValorDesconto(dto.valorDesconto());
        }
        if (dto.previsaoConclusao() != null) {
            entity.setPrevisaoConclusao(dto.previsaoConclusao());
        }
        entity.recalcularTotal();
    }

    public static BigDecimal parseBigDecimal(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return new BigDecimal(value.trim().replace(",", "."));
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
