package com.oficinagestao.ordem;

import com.oficinagestao.auditoria.AuditoriaService;
import com.oficinagestao.estoque.EstoqueMovimentacao;
import com.oficinagestao.estoque.EstoqueMovimentacaoRepository;
import com.oficinagestao.estoque.TipoMovimentacaoEstoque;
import com.oficinagestao.exception.BusinessException;
import com.oficinagestao.exception.ResourceNotFoundException;
import com.oficinagestao.ordem.dto.OrdemServicoItemCreateDTO;
import com.oficinagestao.ordem.dto.OrdemServicoItemResponseDTO;
import com.oficinagestao.produto.Produto;
import com.oficinagestao.produto.ProdutoRepository;
import com.oficinagestao.usuario.Usuario;
import com.oficinagestao.usuario.UsuarioRepository;
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
    private final OrdemServicoItemMapper ordemServicoItemMapper;
    private final AuditoriaService auditoriaService;

    public OrdemServicoItemService(
            OrdemServicoRepository ordemServicoRepository,
            OrdemServicoItemRepository ordemServicoItemRepository,
            ProdutoRepository produtoRepository,
            EstoqueMovimentacaoRepository estoqueMovimentacaoRepository,
            UsuarioRepository usuarioRepository,
            OrdemServicoItemMapper ordemServicoItemMapper,
            AuditoriaService auditoriaService
    ) {
        this.ordemServicoRepository = ordemServicoRepository;
        this.ordemServicoItemRepository = ordemServicoItemRepository;
        this.produtoRepository = produtoRepository;
        this.estoqueMovimentacaoRepository = estoqueMovimentacaoRepository;
        this.usuarioRepository = usuarioRepository;
        this.ordemServicoItemMapper = ordemServicoItemMapper;
        this.auditoriaService = auditoriaService;
    }

    @Transactional(readOnly = true)
    public List<OrdemServicoItemResponseDTO> listarItens(Long ordemServicoId) {
        if (!ordemServicoRepository.existsById(ordemServicoId)) {
            throw new ResourceNotFoundException("Ordem de Serviço não encontrada com o ID: " + ordemServicoId);
        }
        return ordemServicoItemRepository.findByOrdemServicoIdComProduto(ordemServicoId).stream()
                .map(ordemServicoItemMapper::toResponseDTO)
                .toList();
    }

    /**
     * Adiciona uma peça à Ordem de Serviço em uma operação transacional atômica.
     * <p>
     * Passos executados:
     * 1. Validação de status da OS (rejeita se CONCLUIDA ou CANCELADA).
     * 2. Lock Pessimista de Escrita no Produto (SELECT ... FOR UPDATE) para evitar race condition.
     * 3. Validação de saldo disponível (rejeita se saldo < solicitado).
     * 4. Congelamento do preço unitário histórico (valor_venda no momento da OS).
     * 5. Baixa de estoque no Produto.
     * 6. Registro do item na Ordem de Serviço.
     * 7. Registro da movimentação de SAÍDA no histórico de estoque.
     * 8. Recalculo dos valores totais da OS.
     * 9. Auditoria.
     */
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

        // Lock Pessimista de Escrita no Produto
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

        // 1. Atualizar saldo do produto (baixa física)
        BigDecimal saldoPosterior = saldoAnterior.subtract(quantidade);
        produto.setEstoqueAtual(saldoPosterior);
        produtoRepository.save(produto);

        // 2. Congelar preço unitário histórico do produto naquele momento
        BigDecimal precoUnitarioCongelado = (produto.getPrecoVenda() != null ? produto.getPrecoVenda() : BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
        BigDecimal desconto = (dto.valorDesconto() != null ? dto.valorDesconto() : BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
        BigDecimal subtotal = precoUnitarioCongelado.multiply(quantidade).subtract(desconto).setScale(2, RoundingMode.HALF_UP);
        if (subtotal.compareTo(BigDecimal.ZERO) < 0) {
            subtotal = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }

        // 3. Criar e salvar item da OS
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

        // 4. Registrar movimentação de saída vinculada à OS
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

        // 5. Recalcular valores da OS
        recalcularValoresOS(os);
        ordemServicoRepository.save(os);

        auditoriaService.registrarComRequest(
                usuarioId,
                "OrdemServicoItem",
                itemSalvo.getId() != null ? itemSalvo.getId().toString() : "0",
                "INSERT",
                request
        );

        return ordemServicoItemMapper.toResponseDTO(itemSalvo);
    }

    /**
     * Remove uma peça da Ordem de Serviço, devolvendo a quantidade ao estoque em transação atômica.
     */
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

        // Lock Pessimista de Escrita no Produto
        Produto produto = produtoRepository.findByIdWithLock(item.getProduto().getId())
                .orElseThrow(() -> new ResourceNotFoundException("Produto vinculado ao item não encontrado."));

        BigDecimal quantidadeDevolvida = item.getQuantidade();
        BigDecimal saldoAnterior = produto.getEstoqueAtual() != null ? produto.getEstoqueAtual() : BigDecimal.ZERO;
        BigDecimal saldoPosterior = saldoAnterior.add(quantidadeDevolvida);

        // 1. Estornar saldo no estoque
        produto.setEstoqueAtual(saldoPosterior);
        produtoRepository.save(produto);

        // 2. Registrar movimentação de devolução vinculada à OS
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

        // 3. Deletar item da OS
        ordemServicoItemRepository.delete(item);

        // 4. Recalcular valores da OS
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
}
