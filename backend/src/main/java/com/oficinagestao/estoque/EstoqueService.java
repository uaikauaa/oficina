package com.oficinagestao.estoque;

import com.oficinagestao.auditoria.AuditoriaService;
import com.oficinagestao.estoque.dto.EstoqueMovimentacaoResponseDTO;
import com.oficinagestao.estoque.dto.EstoqueResumoDTO;
import com.oficinagestao.estoque.dto.MovimentacaoManualDTO;
import com.oficinagestao.exception.BusinessException;
import com.oficinagestao.exception.ResourceNotFoundException;
import com.oficinagestao.produto.Produto;
import com.oficinagestao.produto.ProdutoRepository;
import com.oficinagestao.usuario.Usuario;
import com.oficinagestao.usuario.UsuarioRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Service
public class EstoqueService {

    private final EstoqueMovimentacaoRepository estoqueMovimentacaoRepository;
    private final ProdutoRepository produtoRepository;
    private final UsuarioRepository usuarioRepository;
    private final EstoqueMapper estoqueMapper;
    private final AuditoriaService auditoriaService;

    public EstoqueService(
            EstoqueMovimentacaoRepository estoqueMovimentacaoRepository,
            ProdutoRepository produtoRepository,
            UsuarioRepository usuarioRepository,
            EstoqueMapper estoqueMapper,
            AuditoriaService auditoriaService
    ) {
        this.estoqueMovimentacaoRepository = estoqueMovimentacaoRepository;
        this.produtoRepository = produtoRepository;
        this.usuarioRepository = usuarioRepository;
        this.estoqueMapper = estoqueMapper;
        this.auditoriaService = auditoriaService;
    }

    @Transactional(readOnly = true)
    public EstoqueResumoDTO obterResumoEstoque() {
        long totalProdutos = produtoRepository.count();
        long itensSemEstoque = produtoRepository.countSemEstoque();
        long itensEstoqueBaixo = produtoRepository.countEstoqueBaixo();
        BigDecimal valorTotalEstoque = produtoRepository.somarValorTotalEstoque();

        return new EstoqueResumoDTO(
                totalProdutos,
                itensSemEstoque,
                itensEstoqueBaixo,
                valorTotalEstoque != null ? valorTotalEstoque : BigDecimal.ZERO
        );
    }

    @Transactional
    public EstoqueMovimentacaoResponseDTO registrarMovimentacaoManual(
            MovimentacaoManualDTO dto,
            Long usuarioId,
            HttpServletRequest request
    ) {
        // Bloqueio Pessimista (SELECT ... FOR UPDATE) para garantir concorrência segura
        Produto produto = produtoRepository.findByIdWithLock(dto.produtoId())
                .orElseThrow(() -> new ResourceNotFoundException("Produto/Peça não encontrado com o ID: " + dto.produtoId()));

        if (!produto.isAtivo()) {
            throw new BusinessException("Não é possível movimentar o estoque de um produto inativo.");
        }

        BigDecimal quantidade = dto.quantidade();
        if (quantidade == null || quantidade.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException("A quantidade movimentada deve ser estritamente maior que zero.");
        }

        BigDecimal saldoAnterior = produto.getEstoqueAtual() != null ? produto.getEstoqueAtual() : BigDecimal.ZERO;
        BigDecimal saldoPosterior;

        switch (dto.tipoMovimentacao()) {
            case ENTRADA, AJUSTE_POSITIVO -> saldoPosterior = saldoAnterior.add(quantidade);
            case SAIDA, AJUSTE_NEGATIVO -> {
                if (saldoAnterior.compareTo(quantidade) < 0) {
                    throw new BusinessException("Estoque insuficiente para o produto '" + produto.getNome() +
                            "'. Saldo atual disponível: " + saldoAnterior + ", Quantidade solicitada: " + quantidade);
                }
                saldoPosterior = saldoAnterior.subtract(quantidade);
            }
            default -> throw new BusinessException("Tipo de movimentação manual inválido: " + dto.tipoMovimentacao());
        }

        produto.setEstoqueAtual(saldoPosterior);
        produtoRepository.save(produto);

        Usuario usuario = usuarioId != null ? usuarioRepository.findById(usuarioId).orElse(null) : null;
        BigDecimal valorUnitario = dto.valorUnitario() != null ? dto.valorUnitario() : produto.getPrecoCusto();

        EstoqueMovimentacao mov = new EstoqueMovimentacao(
                produto,
                usuario,
                null,
                dto.tipoMovimentacao(),
                quantidade,
                valorUnitario,
                saldoAnterior,
                saldoPosterior,
                dto.motivo().trim()
        );

        EstoqueMovimentacao salva = estoqueMovimentacaoRepository.save(mov);

        auditoriaService.registrarComRequest(
                usuarioId,
                "EstoqueMovimentacao",
                salva.getId().toString(),
                "INSERT",
                request
        );

        return estoqueMapper.toResponseDTO(salva);
    }

    @Transactional(readOnly = true)
    public Page<EstoqueMovimentacaoResponseDTO> listarMovimentacoes(
            Long produtoId,
            TipoMovimentacaoEstoque tipo,
            OffsetDateTime dataInicio,
            OffsetDateTime dataFim,
            String numeroOs,
            Pageable pageable
    ) {
        String numOs = (numeroOs != null && !numeroOs.isBlank()) ? numeroOs.trim() : null;
        return estoqueMovimentacaoRepository.pesquisarHistorico(produtoId, tipo, dataInicio, dataFim, numOs, pageable)
                .map(estoqueMapper::toResponseDTO);
    }
}
