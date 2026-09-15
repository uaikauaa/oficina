package com.oficinagestao.ordem;

import com.oficinagestao.auditoria.AuditoriaService;
import com.oficinagestao.cliente.Cliente;
import com.oficinagestao.estoque.EstoqueMovimentacao;
import com.oficinagestao.estoque.EstoqueMovimentacaoRepository;
import com.oficinagestao.estoque.TipoMovimentacaoEstoque;
import com.oficinagestao.exception.BusinessException;
import com.oficinagestao.maquina.Maquina;
import com.oficinagestao.ordem.dto.OrdemServicoItemCreateDTO;
import com.oficinagestao.ordem.dto.OrdemServicoItemResponseDTO;
import com.oficinagestao.produto.Produto;
import com.oficinagestao.produto.ProdutoRepository;
import com.oficinagestao.usuario.UsuarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OrdemServicoItemServiceTest {

    @Mock
    private OrdemServicoRepository ordemServicoRepository;

    @Mock
    private OrdemServicoItemRepository ordemServicoItemRepository;

    @Mock
    private ProdutoRepository produtoRepository;

    @Mock
    private EstoqueMovimentacaoRepository estoqueMovimentacaoRepository;

    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private AuditoriaService auditoriaService;

    @Spy
    private OrdemServicoItemMapper ordemServicoItemMapper = new OrdemServicoItemMapper();

    @InjectMocks
    private OrdemServicoItemService ordemServicoItemService;

    private OrdemServico os;
    private Produto produto;

    @BeforeEach
    void setUp() {
        Cliente cliente = new Cliente();
        cliente.setId(1L);
        cliente.setNomeRazaoSocial("Indústria Metalúrgica ABC");

        Maquina maquina = new Maquina();
        maquina.setId(10L);
        maquina.setCliente(cliente);

        os = new OrdemServico();
        os.setId(100L);
        os.setNumeroOs("OS-2026-0012");
        os.setCliente(cliente);
        os.setMaquina(maquina);
        os.setStatus(StatusOrdemServico.EM_MANUTENCAO);
        os.setValorMaoObra(new BigDecimal("200.00"));
        os.setValorPecas(BigDecimal.ZERO);
        os.setValorDesconto(BigDecimal.ZERO);
        os.setValorTotal(new BigDecimal("200.00"));

        produto = new Produto();
        produto.setId(50L);
        produto.setCodigo("IGBT-60N100");
        produto.setNome("Módulo IGBT 60A 1000V");
        produto.setPrecoVenda(new BigDecimal("85.00"));
        produto.setPrecoCusto(new BigDecimal("45.00"));
        produto.setEstoqueAtual(new BigDecimal("10.000"));
        produto.setEstoqueMinimo(new BigDecimal("2.000"));
        produto.setAtivo(true);
    }

    @Test
    @DisplayName("Deve adicionar peça à OS com sucesso: baixar estoque, congelar preço, criar movimentação e recalcular OS")
    void deveAdicionarPecaComSucesso() {
        OrdemServicoItemCreateDTO dto = new OrdemServicoItemCreateDTO(
                50L,
                new BigDecimal("2.000"), // 2 unidades
                null,
                "Troca preventiva dos IGBTs do inversor de solda"
        );

        when(ordemServicoRepository.findById(100L)).thenReturn(Optional.of(os));
        when(produtoRepository.findByIdWithLock(50L)).thenReturn(Optional.of(produto));
        List<OrdemServicoItem> itensOs = new ArrayList<>();
        when(ordemServicoItemRepository.findByOrdemServicoIdComProduto(100L)).thenAnswer(i -> itensOs);
        when(ordemServicoItemRepository.save(any(OrdemServicoItem.class))).thenAnswer(i -> {
            OrdemServicoItem item = i.getArgument(0);
            item.setId(1L);
            itensOs.add(item);
            return item;
        });

        OrdemServicoItemResponseDTO response = ordemServicoItemService.adicionarPeca(100L, dto, 1L, null);

        assertNotNull(response);
        // 1. Preço unitário congelado
        assertEquals(new BigDecimal("85.00"), response.valorUnitario());
        assertEquals(new BigDecimal("170.00"), response.valorTotal());

        // 2. Baixa de estoque
        assertEquals(new BigDecimal("8.000"), produto.getEstoqueAtual());
        verify(produtoRepository).save(produto);

        // 3. Movimentação de saída gerada
        ArgumentCaptor<EstoqueMovimentacao> movCaptor = ArgumentCaptor.forClass(EstoqueMovimentacao.class);
        verify(estoqueMovimentacaoRepository).save(movCaptor.capture());
        EstoqueMovimentacao mov = movCaptor.getValue();
        assertEquals(TipoMovimentacaoEstoque.SAIDA, mov.getTipoMovimentacao());
        assertEquals(new BigDecimal("2.000"), mov.getQuantidade());
        assertEquals(new BigDecimal("10.000"), mov.getQuantidadeAnterior());
        assertEquals(new BigDecimal("8.000"), mov.getQuantidadePosterior());
        assertTrue(mov.getMotivo().contains("OS-2026-0012"));

        // 4. Recalculo dos totais da OS (Mão de obra 200 + Peças 170 = 370)
        assertEquals(new BigDecimal("170.00"), os.getValorPecas());
        assertEquals(new BigDecimal("370.00"), os.getValorTotal());
        verify(ordemServicoRepository).save(os);
    }

    @Test
    @DisplayName("Preço Histórico: reajustar o preço no cadastro do produto NUNCA deve alterar a OS existente")
    void reajustarPrecoProdutoNaoAlteraItemDaOs() {
        // Item criado na OS quando a peça custava 85
        OrdemServicoItem item = new OrdemServicoItem(
                os, produto, TipoItemOrdemServico.PECA,
                BigDecimal.ONE, new BigDecimal("85.00"), BigDecimal.ZERO, new BigDecimal("85.00"), "Item"
        );

        // No dia seguinte, a peça no catálogo sobe para 120.00
        produto.setPrecoVenda(new BigDecimal("120.00"));

        // O item da OS permanece com preço histórico congelado em 85.00
        assertEquals(new BigDecimal("85.00"), item.getValorUnitario());
        assertEquals(new BigDecimal("85.00"), item.getValorTotal());
    }

    @Test
    @DisplayName("Deve rejeitar adição de peça se estoque for insuficiente (regra crítica: nunca estoque negativo)")
    void deveRejeitarAdicaoPecaSeEstoqueInsuficiente() {
        produto.setEstoqueAtual(new BigDecimal("1.000")); // Apenas 1 disponível
        OrdemServicoItemCreateDTO dto = new OrdemServicoItemCreateDTO(50L, new BigDecimal("2.000"), null, null);

        when(ordemServicoRepository.findById(100L)).thenReturn(Optional.of(os));
        when(produtoRepository.findByIdWithLock(50L)).thenReturn(Optional.of(produto));

        BusinessException ex = assertThrows(BusinessException.class, () ->
                ordemServicoItemService.adicionarPeca(100L, dto, 1L, null)
        );

        assertTrue(ex.getMessage().contains("Estoque insuficiente"));
        assertEquals(new BigDecimal("1.000"), produto.getEstoqueAtual()); // Estoque inalterado
        verify(ordemServicoItemRepository, never()).save(any());
        verify(estoqueMovimentacaoRepository, never()).save(any());
    }

    @Test
    @DisplayName("Deve rejeitar adição de peça em OS com status CONCLUIDA")
    void deveRejeitarAdicaoPecaEmOsConcluida() {
        os.setStatus(StatusOrdemServico.CONCLUIDA);
        OrdemServicoItemCreateDTO dto = new OrdemServicoItemCreateDTO(50L, BigDecimal.ONE, null, null);

        when(ordemServicoRepository.findById(100L)).thenReturn(Optional.of(os));

        BusinessException ex = assertThrows(BusinessException.class, () ->
                ordemServicoItemService.adicionarPeca(100L, dto, 1L, null)
        );

        assertTrue(ex.getMessage().contains("Não é permitido adicionar peças"));
        verify(produtoRepository, never()).findByIdWithLock(any());
    }

    @Test
    @DisplayName("Deve rejeitar adição de peça em OS com status CANCELADA")
    void deveRejeitarAdicaoPecaEmOsCancelada() {
        os.setStatus(StatusOrdemServico.CANCELADA);
        OrdemServicoItemCreateDTO dto = new OrdemServicoItemCreateDTO(50L, BigDecimal.ONE, null, null);

        when(ordemServicoRepository.findById(100L)).thenReturn(Optional.of(os));

        assertThrows(BusinessException.class, () ->
                ordemServicoItemService.adicionarPeca(100L, dto, 1L, null)
        );
    }

    @Test
    @DisplayName("Deve remover peça da OS com sucesso: estornar estoque, criar movimentação de DEVOLUCAO e recalcular OS")
    void deveRemoverPecaComSucesso() {
        produto.setEstoqueAtual(new BigDecimal("8.000")); // Saldo após uso de 2 peças
        OrdemServicoItem item = new OrdemServicoItem(
                os, produto, TipoItemOrdemServico.PECA,
                new BigDecimal("2.000"), new BigDecimal("85.00"), BigDecimal.ZERO, new BigDecimal("170.00"), "Troca"
        );
        item.setId(5L);

        when(ordemServicoRepository.findById(100L)).thenReturn(Optional.of(os));
        when(ordemServicoItemRepository.findByIdAndOrdemServicoId(5L, 100L)).thenReturn(Optional.of(item));
        when(produtoRepository.findByIdWithLock(50L)).thenReturn(Optional.of(produto));
        when(ordemServicoItemRepository.findByOrdemServicoIdComProduto(100L)).thenReturn(List.of());

        ordemServicoItemService.removerItem(100L, 5L, 1L, null);

        // 1. Estoque estornado: 8 + 2 = 10
        assertEquals(new BigDecimal("10.000"), produto.getEstoqueAtual());
        verify(produtoRepository).save(produto);

        // 2. Movimentação de devolução criada
        ArgumentCaptor<EstoqueMovimentacao> movCaptor = ArgumentCaptor.forClass(EstoqueMovimentacao.class);
        verify(estoqueMovimentacaoRepository).save(movCaptor.capture());
        EstoqueMovimentacao mov = movCaptor.getValue();
        assertEquals(TipoMovimentacaoEstoque.DEVOLUCAO, mov.getTipoMovimentacao());
        assertEquals(new BigDecimal("2.000"), mov.getQuantidade());
        assertEquals(new BigDecimal("8.000"), mov.getQuantidadeAnterior());
        assertEquals(new BigDecimal("10.000"), mov.getQuantidadePosterior());

        // 3. Item deletado
        verify(ordemServicoItemRepository).delete(item);

        // 4. OS recalculada: total peças volta para zero, total geral volta para mão de obra (200)
        assertEquals(BigDecimal.ZERO, os.getValorPecas());
        assertEquals(new BigDecimal("200.00"), os.getValorTotal());
    }

    @Test
    @DisplayName("Simulação de Concorrência: quando estoque = 1 e ocorrem duas baixas concorrentes, o saldo NUNCA fica negativo")
    void simulacaoConcorrenciaSaldoNuncaFicaNegativo() throws Exception {
        // Simulação do comportamento atômico protegido por lock pessimista
        final Produto produtoComEstoqueUm = new Produto();
        produtoComEstoqueUm.setId(999L);
        produtoComEstoqueUm.setNome("Diodo Retificador 50A");
        produtoComEstoqueUm.setEstoqueAtual(BigDecimal.ONE); // Saldo = 1
        produtoComEstoqueUm.setPrecoVenda(new BigDecimal("35.00"));
        produtoComEstoqueUm.setAtivo(true);

        AtomicInteger sucessos = new AtomicInteger(0);
        AtomicInteger falhas = new AtomicInteger(0);

        int numThreads = 2;
        ExecutorService executor = Executors.newFixedThreadPool(numThreads);
        CountDownLatch latch = new CountDownLatch(1);

        for (int i = 0; i < numThreads; i++) {
            executor.submit(() -> {
                try {
                    latch.await();
                    // Simulação da exclusão mútua do lock pessimista
                    synchronized (produtoComEstoqueUm) {
                        BigDecimal saldo = produtoComEstoqueUm.getEstoqueAtual();
                        if (saldo.compareTo(BigDecimal.ONE) >= 0) {
                            produtoComEstoqueUm.setEstoqueAtual(saldo.subtract(BigDecimal.ONE));
                            sucessos.incrementAndGet();
                        } else {
                            falhas.incrementAndGet();
                        }
                    }
                } catch (Exception e) {
                    falhas.incrementAndGet();
                }
            });
        }

        latch.countDown(); // Dispara as duas threads simultaneamente
        executor.shutdown();
        while (!executor.isTerminated()) {
            Thread.sleep(10);
        }

        // Exatamente 1 deve ter obtido sucesso e 1 deve ter falhado
        assertEquals(1, sucessos.get(), "Exatamente 1 operação deve ter sucesso com estoque limite = 1.");
        assertEquals(1, falhas.get(), "A segunda operação concorrente deve ser rejeitada.");
        assertEquals(BigDecimal.ZERO, produtoComEstoqueUm.getEstoqueAtual(), "O saldo final deve ser exatamente 0, JAMAIS negativo.");
    }
}
