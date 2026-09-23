package com.oficinagestao.service;

import com.oficinagestao.dto.OrdemServicoItemCreateDTO;
import com.oficinagestao.dto.OrdemServicoItemResponseDTO;
import com.oficinagestao.entity.EstoqueMovimentacao;
import com.oficinagestao.entity.OrdemServico;
import com.oficinagestao.entity.OrdemServicoItem;
import com.oficinagestao.entity.Produto;
import com.oficinagestao.entity.TipoItemOrdemServico;
import com.oficinagestao.entity.TipoMovimentacaoEstoque;
import com.oficinagestao.entity.Usuario;
import com.oficinagestao.exception.BusinessException;
import com.oficinagestao.exception.ResourceNotFoundException;
import com.oficinagestao.repository.EstoqueMovimentacaoRepository;
import com.oficinagestao.repository.OrdemServicoItemRepository;
import com.oficinagestao.repository.OrdemServicoRepository;
import com.oficinagestao.repository.ProdutoRepository;
import com.oficinagestao.repository.UsuarioRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

@Service
public class OrdemServicoItemService {

    private final OrdemServicoRepository ordemServicoRepository;
    private final OrdemServicoItemRepository ordemServicoItemRepository;
    private final ProdutoRepository produtoRepository;
    private final EstoqueMovimentacaoRepository estoqueMovimentacaoRepository;
    private final UsuarioRepository usuarioRepository;
    private final AuditoriaService auditoriaService;

    public OrdemServicoItemService(
            OrdemServicoRepository ordemServicoRepository,
            OrdemServicoItemRepository ordemServicoItemRepository,
            ProdutoRepository produtoRepository,
            EstoqueMovimentacaoRepository estoqueMovimentacaoRepository,
            UsuarioRepository usuarioRepository,
            AuditoriaService auditoriaService
    ) {
        this.ordemServicoRepository = ordemServicoRepository;
        this.ordemServicoItemRepository = ordemServicoItemRepository;
        this.produtoRepository = produtoRepository;
        this.estoqueMovimentacaoRepository = estoqueMovimentacaoRepository;
        this.usuarioRepository = usuarioRepository;
        this.auditoriaService = auditoriaService;
    }

    @Transactional(readOnly = true)
    public List<OrdemServicoItemResponseDTO> listarItens(Long ordemServicoId) {
        if (!ordemServicoRepository.existsById(ordemServicoId)) {
            throw new ResourceNotFoundException("Ordem de Serviço não encontrada com o ID: " + ordemServicoId);
        }
        return ordemServicoItemRepository.findByOrdemServicoIdComProduto(ordemServicoId).stream()
                .map(this::toResponseDTO)
                .toList();
    }

    @Transactional
    public OrdemServicoItemResponseDTO adicionarPeca(
            Long ordemServicoId,
            OrdemServicoItemCreateDTO dto,
            Long usuarioId,
            HttpServletRequest request
    ) {
        OrdemServico os = ordemServicoRepository.findById(ordemServicoId)
                .orElseThrow(() -> new ResourceNotFoundException("Ordem de Serviço não encontrada com o ID: " + ordemServicoId));

        if (os.getStatus().isTerminal()) {
            throw new BusinessException("Não é permitido adicionar peças a uma Ordem de Serviço com status " +
                    os.getStatus().getDescricao() + ".");
        }

        BigDecimal quantidade = dto.quantidade();
        if (quantidade == null || quantidade.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException("A quantidade da peça deve ser maior que zero.");
        }

        Produto produto = produtoRepository.findByIdWithLock(dto.produtoId())
                .orElseThrow(() -> new ResourceNotFoundException("Produto/Peça não encontrado com o ID: " + dto.produtoId()));

        if (!produto.isAtivo()) {
            throw new BusinessException("Não é possível utilizar a peça '" + produto.getNome() + "' pois o cadastro está inativo.");
        }

        BigDecimal saldoAnterior = produto.getEstoqueAtual() != null ? produto.getEstoqueAtual() : BigDecimal.ZERO;
        if (saldoAnterior.compareTo(quantidade) < 0) {
            throw new BusinessException("Estoque insuficiente para a peça '" + produto.getNome() +
                    "'. Saldo atual disponível: " + saldoAnterior + ", Quantidade solicitada: " + quantidade);
        }

        BigDecimal saldoPosterior = saldoAnterior.subtract(quantidade);
        produto.setEstoqueAtual(saldoPosterior);
        produtoRepository.save(produto);

        BigDecimal precoUnitarioCongelado = (produto.getPrecoVenda() != null ? produto.getPrecoVenda() : BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
        BigDecimal desconto = (dto.valorDesconto() != null ? dto.valorDesconto() : BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
        BigDecimal subtotal = precoUnitarioCongelado.multiply(quantidade).subtract(desconto).setScale(2, RoundingMode.HALF_UP);
        if (subtotal.compareTo(BigDecimal.ZERO) < 0) {
            subtotal = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }

        OrdemServicoItem item = new OrdemServicoItem(
                os,
                produto,
                TipoItemOrdemServico.PECA,
                quantidade,
                precoUnitarioCongelado,
                desconto,
                subtotal,
                dto.observacoes() != null ? dto.observacoes().trim() : null
        );
        OrdemServicoItem itemSalvo = ordemServicoItemRepository.save(item);

        Usuario usuario = usuarioId != null ? usuarioRepository.findById(usuarioId).orElse(null) : null;
        EstoqueMovimentacao mov = new EstoqueMovimentacao(
                produto,
                usuario,
                os,
                TipoMovimentacaoEstoque.SAIDA,
                quantidade,
                precoUnitarioCongelado,
                saldoAnterior,
                saldoPosterior,
                "Utilização na OS " + os.getNumeroOs()
        );
        estoqueMovimentacaoRepository.save(mov);

        recalcularValoresOS(os);
        ordemServicoRepository.save(os);

        auditoriaService.registrarComRequest(
                usuarioId,
                "OrdemServicoItem",
                itemSalvo.getId() != null ? itemSalvo.getId().toString() : "0",
                "INSERT",
                request
        );

        return toResponseDTO(itemSalvo);
    }

    @Transactional
    public void removerItem(Long ordemServicoId, Long itemId, Long usuarioId, HttpServletRequest request) {
        OrdemServico os = ordemServicoRepository.findById(ordemServicoId)
                .orElseThrow(() -> new ResourceNotFoundException("Ordem de Serviço não encontrada com o ID: " + ordemServicoId));

        if (os.getStatus().isTerminal()) {
            throw new BusinessException("Não é permitido remover peças de uma Ordem de Serviço com status " +
                    os.getStatus().getDescricao() + ".");
        }

        OrdemServicoItem item = ordemServicoItemRepository.findByIdAndOrdemServicoId(itemId, ordemServicoId)
                .orElseThrow(() -> new ResourceNotFoundException("Item não encontrado na OS " + ordemServicoId + " com o ID: " + itemId));

        Produto produto = produtoRepository.findByIdWithLock(item.getProduto().getId())
                .orElseThrow(() -> new ResourceNotFoundException("Produto vinculado ao item não encontrado."));

        BigDecimal quantidadeDevolvida = item.getQuantidade();
        BigDecimal saldoAnterior = produto.getEstoqueAtual() != null ? produto.getEstoqueAtual() : BigDecimal.ZERO;
        BigDecimal saldoPosterior = saldoAnterior.add(quantidadeDevolvida);

        produto.setEstoqueAtual(saldoPosterior);
        produtoRepository.save(produto);

        Usuario usuario = usuarioId != null ? usuarioRepository.findById(usuarioId).orElse(null) : null;
        EstoqueMovimentacao mov = new EstoqueMovimentacao(
                produto,
                usuario,
                os,
                TipoMovimentacaoEstoque.DEVOLUCAO,
                quantidadeDevolvida,
                item.getValorUnitario(),
                saldoAnterior,
                saldoPosterior,
                "Estorno por remoção da OS " + os.getNumeroOs()
        );
        estoqueMovimentacaoRepository.save(mov);

        ordemServicoItemRepository.delete(item);

        recalcularValoresOS(os);
        ordemServicoRepository.save(os);

        auditoriaService.registrarComRequest(
                usuarioId,
                "OrdemServicoItem",
                item.getId().toString(),
                "DELETE",
                request
        );
    }

    private void recalcularValoresOS(OrdemServico os) {
        List<OrdemServicoItem> itens = ordemServicoItemRepository.findByOrdemServicoIdComProduto(os.getId());
        BigDecimal totalPecas = itens.stream()
                .filter(i -> i.getTipoItem() == TipoItemOrdemServico.PECA)
                .map(OrdemServicoItem::getValorTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        os.setValorPecas(totalPecas);
        os.recalcularTotal();
    }

    // --- Método de Mapeamento Direto ---

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
