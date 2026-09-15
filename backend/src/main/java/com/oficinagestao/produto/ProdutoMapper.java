package com.oficinagestao.produto;

import com.oficinagestao.fornecedor.Fornecedor;
import com.oficinagestao.produto.dto.CompatibilidadeResponseDTO;
import com.oficinagestao.produto.dto.ProdutoCreateDTO;
import com.oficinagestao.produto.dto.ProdutoResponseDTO;
import com.oficinagestao.produto.dto.ProdutoUpdateDTO;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Component
public class ProdutoMapper {

    public Produto toEntity(ProdutoCreateDTO dto, Fornecedor fornecedor) {
        if (dto == null) return null;
        Produto p = new Produto();
        p.setCodigo(dto.codigo().trim());
        p.setCodigoBarras(dto.codigoBarras() != null ? dto.codigoBarras().trim() : null);
        p.setNome(dto.nome().trim());
        p.setDescricao(dto.descricao() != null ? dto.descricao().trim() : null);
        p.setTipo(dto.tipo() != null ? dto.tipo() : TipoProduto.PECA);
        p.setUnidadeMedida(dto.unidadeMedida() != null && !dto.unidadeMedida().isBlank() ? dto.unidadeMedida().trim() : "UN");
        p.setPrecoCusto(dto.precoCusto());
        p.setPrecoVenda(dto.precoVenda());
        p.setMargemLucro(calcularMargemLucro(dto.precoCusto(), dto.precoVenda()));
        p.setEstoqueAtual(dto.estoqueInicial() != null ? dto.estoqueInicial() : BigDecimal.ZERO);
        p.setEstoqueMinimo(dto.estoqueMinimo() != null ? dto.estoqueMinimo() : BigDecimal.ZERO);
        p.setLocalizacao(dto.localizacao() != null ? dto.localizacao().trim() : null);
        p.setFornecedor(fornecedor);
        p.setAtivo(true);
        return p;
    }

    public void updateEntity(Produto p, ProdutoUpdateDTO dto, Fornecedor fornecedor) {
        if (p == null || dto == null) return;
        p.setCodigo(dto.codigo().trim());
        p.setCodigoBarras(dto.codigoBarras() != null ? dto.codigoBarras().trim() : null);
        p.setNome(dto.nome().trim());
        p.setDescricao(dto.descricao() != null ? dto.descricao().trim() : null);
        if (dto.tipo() != null) {
            p.setTipo(dto.tipo());
        }
        if (dto.unidadeMedida() != null && !dto.unidadeMedida().isBlank()) {
            p.setUnidadeMedida(dto.unidadeMedida().trim());
        }
        p.setPrecoCusto(dto.precoCusto());
        p.setPrecoVenda(dto.precoVenda());
        p.setMargemLucro(calcularMargemLucro(dto.precoCusto(), dto.precoVenda()));
        if (dto.estoqueMinimo() != null) {
            p.setEstoqueMinimo(dto.estoqueMinimo());
        }
        p.setLocalizacao(dto.localizacao() != null ? dto.localizacao().trim() : null);
        p.setFornecedor(fornecedor);
    }

    public ProdutoResponseDTO toResponseDTO(Produto p) {
        if (p == null) return null;
        return new ProdutoResponseDTO(
                p.getId(),
                p.getCodigo(),
                p.getCodigoBarras(),
                p.getNome(),
                p.getDescricao(),
                p.getTipo().name(),
                p.getTipo().getDescricao(),
                p.getUnidadeMedida(),
                p.getPrecoCusto(),
                p.getPrecoVenda(),
                p.getMargemLucro(),
                p.getEstoqueAtual(),
                p.getEstoqueMinimo(),
                p.getEstoqueMaximo(),
                p.getLocalizacao(),
                p.isAtivo(),
                p.getFornecedor() != null ? p.getFornecedor().getId() : null,
                p.getFornecedor() != null ? p.getFornecedor().getRazaoSocial() : null,
                p.isEstoqueBaixo(),
                p.isSemEstoque(),
                p.getCreatedAt(),
                p.getUpdatedAt()
        );
    }

    public CompatibilidadeResponseDTO toCompatibilidadeDTO(ProdutoMaquina pm) {
        if (pm == null) return null;
        return new CompatibilidadeResponseDTO(
                pm.getId(),
                pm.getMaquina().getId(),
                pm.getMaquina().getTipoEquipamento().name(),
                pm.getMaquina().getMarca(),
                pm.getMaquina().getModelo(),
                pm.getMaquina().getNumeroSerie(),
                pm.getObservacaoCompatibilidade(),
                pm.getCreatedAt()
        );
    }

    private BigDecimal calcularMargemLucro(BigDecimal custo, BigDecimal venda) {
        if (custo == null || venda == null || custo.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO;
        }
        return venda.subtract(custo)
                .divide(custo, 4, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100))
                .setScale(2, RoundingMode.HALF_UP);
    }
}
