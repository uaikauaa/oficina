package com.oficinagestao.estoque;

import com.oficinagestao.estoque.dto.EstoqueMovimentacaoResponseDTO;
import org.springframework.stereotype.Component;

@Component
public class EstoqueMapper {

    public EstoqueMovimentacaoResponseDTO toResponseDTO(EstoqueMovimentacao m) {
        if (m == null) return null;
        return new EstoqueMovimentacaoResponseDTO(
                m.getId(),
                m.getProduto().getId(),
                m.getProduto().getCodigo(),
                m.getProduto().getNome(),
                m.getUsuario() != null ? m.getUsuario().getId() : null,
                m.getUsuario() != null ? m.getUsuario().getNome() : null,
                m.getOrdemServico() != null ? m.getOrdemServico().getId() : null,
                m.getOrdemServico() != null ? m.getOrdemServico().getNumeroOs() : null,
                m.getTipoMovimentacao().name(),
                m.getTipoMovimentacao().getDescricao(),
                m.getQuantidade(),
                m.getValorUnitario(),
                m.getQuantidadeAnterior(),
                m.getQuantidadePosterior(),
                m.getMotivo(),
                m.getDataMovimentacao()
        );
    }
}
