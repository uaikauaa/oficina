package com.oficinagestao.ordem;

import com.oficinagestao.ordem.dto.OrdemServicoItemResponseDTO;
import org.springframework.stereotype.Component;

@Component
public class OrdemServicoItemMapper {

    public OrdemServicoItemResponseDTO toResponseDTO(OrdemServicoItem item) {
        if (item == null) return null;
        return new OrdemServicoItemResponseDTO(
                item.getId(),
                item.getOrdemServico().getId(),
                item.getProduto().getId(),
                item.getProduto().getCodigo(),
                item.getProduto().getNome(),
                item.getTipoItem().name(),
                item.getTipoItem().getDescricao(),
                item.getQuantidade(),
                item.getValorUnitario(),
                item.getValorDesconto(),
                item.getValorTotal(),
                item.getObservacoes(),
                item.getCreatedAt()
        );
    }
}
