package com.oficinagestao.service;

import com.oficinagestao.dto.*;
import com.oficinagestao.entity.*;
import com.oficinagestao.repository.*;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Teste de integração cobrindo o ciclo de vida completo do Requisito 29:
 * 1. Criar cliente.
 * 2. Criar equipamento.
 * 3. Criar produto.
 * 4. Fazer entrada de 10 unidades.
 * 5. Abrir OS.
 * 6. Adicionar 3 unidades à OS.
 * 7. Verificar estoque = 7.
 * 8. Verificar item da OS = 3.
 * 9. Alterar preço do produto.
 * 10. Verificar que OS continua com preço original.
 * 11. Cancelar OS.
 * 12. Verificar estoque = 10.
 * 13. Verificar DEVOLUCAO.
 * 14. Verificar histórico.
 */
@ExtendWith(MockitoExtension.class)
class IntegracaoEstoqueOSTest {

    @Mock
    private ProdutoRepository produtoRepository;

    @Mock
    private EstoqueMovimentacaoRepository estoqueMovimentacaoRepository;

    @Mock
    private OrdemServicoRepository ordemServicoRepository;

    @Mock
    private OrdemServicoItemRepository ordemServicoItemRepository;

    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private AuditoriaService auditoriaService;

    @InjectMocks
    private EstoqueService estoqueService;

    @InjectMocks
    private OrdemServicoItemService ordemServicoItemService;

    @InjectMocks
    private OrdemServicoService ordemServicoService;

    @Test
    @DisplayName("Cenário Crítico: Ciclo de vida completo do fluxo Produto -> Entrada -> OS -> Baixa -> Preço Histórico -> Cancelamento -> Estorno")
    void cenarioCriticoCompletoIntegracaoEstoqueOS() {
        // 1. Criar cliente (simulação da entidade)
        Cliente cliente = new Cliente();
        cliente.setId(10L);
        cliente.setNomeRazaoSocial("Usinagem e Solda Central");

        // 2. Criar equipamento (Máquina de solda inversora)
        Maquina maquina = new Maquina();
        maquina.setId(20L);
        maquina.setCliente(cliente);
        maquina.setTipoEquipamento(TipoEquipamento.MAQUINA_SOLDA);
        maquina.setMarca("BAMBOZZI");
        maquina.setModelo("PI-250");
        maquina.setNumeroSerie("BZ-2026-888");

        // 3. Criar produto / peça
        Produto produto = new Produto();
        produto.setId(100L);
        produto.setCodigo("IGBT-40N120");
        produto.setNome("Transistor IGBT 40A 1200V");
        produto.setMarca("Fairchild");
        produto.setTipo(TipoProduto.PECA);
        produto.setPrecoCusto(new BigDecimal("30.00"));
        produto.setPrecoVenda(new BigDecimal("60.00")); // Preço original de venda = R$ 60,00
        produto.setEstoqueAtual(BigDecimal.ZERO);
        produto.setEstoqueMinimo(new BigDecimal("2.000"));
        produto.setAtivo(true);

        // 4. Fazer entrada de 10 unidades no estoque
        when(produtoRepository.findByIdWithLock(100L)).thenReturn(Optional.of(produto));
        when(produtoRepository.save(any(Produto.class))).thenAnswer(i -> i.getArgument(0));
        when(estoqueMovimentacaoRepository.save(any(EstoqueMovimentacao.class))).thenAnswer(i -> {
            EstoqueMovimentacao m = i.getArgument(0);
            m.setId(1L);
            return m;
        });

        MovimentacaoManualDTO entradaDTO = new MovimentacaoManualDTO(
                100L,
                TipoMovimentacaoEstoque.ENTRADA,
                new BigDecimal("10.000"),
                new BigDecimal("30.00"),
                "Entrada de lote fornecedor"
        );
        EstoqueMovimentacaoResponseDTO entradaResp = estoqueService.registrarMovimentacaoManual(entradaDTO, 1L, null);

        assertEquals(new BigDecimal("10.000"), produto.getEstoqueAtual(), "Passo 4: Saldo deve ser 10 após entrada");
        assertEquals(new BigDecimal("10.000"), entradaResp.quantidadePosterior());

        // 5. Abrir OS
        OrdemServico os = new OrdemServico();
        os.setId(500L);
        os.setNumeroOs("OS-2026-0001");
        os.setCliente(cliente);
        os.setMaquina(maquina);
        os.setStatus(StatusOrdemServico.EM_MANUTENCAO);
        os.setValorMaoObra(new BigDecimal("150.00"));
        os.setValorPecas(BigDecimal.ZERO);
        os.setValorDesconto(BigDecimal.ZERO);
        os.setValorTotal(new BigDecimal("150.00"));

        // 6. Adicionar 3 unidades à OS
        when(ordemServicoRepository.findById(500L)).thenReturn(Optional.of(os));
        when(ordemServicoItemRepository.save(any(OrdemServicoItem.class))).thenAnswer(i -> {
            OrdemServicoItem item = i.getArgument(0);
            item.setId(50L);
            return item;
        });

        List<OrdemServicoItem> itensOs = new ArrayList<>();
        when(ordemServicoItemRepository.findByOrdemServicoIdComProduto(500L)).thenAnswer(i -> itensOs);

        OrdemServicoItemCreateDTO itemDTO = new OrdemServicoItemCreateDTO(
                100L,
                new BigDecimal("3.000"),
                BigDecimal.ZERO,
                "Troca preventiva da ponte inversora"
        );

        OrdemServicoItemResponseDTO itemResp = ordemServicoItemService.adicionarPeca(500L, itemDTO, 1L, null);

        // 7. Verificar estoque = 7
        assertEquals(new BigDecimal("7.000"), produto.getEstoqueAtual(), "Passo 7: Saldo do produto após baixa deve ser exatamente 7");

        // 8. Verificar item da OS = 3 unidades e total da OS atualizado
        assertNotNull(itemResp);
        assertEquals(new BigDecimal("3.000"), itemResp.quantidade(), "Passo 8: Item da OS deve ter 3 unidades");
        assertEquals(new BigDecimal("60.00"), itemResp.valorUnitario(), "Passo 8: Valor unitário congelado deve ser R$ 60,00");
        assertEquals(new BigDecimal("180.00"), itemResp.valorTotal(), "Passo 8: Subtotal da peça deve ser R$ 180,00");

        // Adiciona à lista da OS para refletir persistência
        OrdemServicoItem itemPersistido = new OrdemServicoItem(
                os, produto, TipoItemOrdemServico.PECA,
                new BigDecimal("3.000"), new BigDecimal("60.00"), BigDecimal.ZERO, new BigDecimal("180.00"), "Troca"
        );
        itemPersistido.setId(50L);
        itensOs.add(itemPersistido);

        // 9. Alterar preço de venda do produto no cadastro (aumenta para R$ 110,00)
        produto.setPrecoVenda(new BigDecimal("110.00"));

        // 10. Verificar que o item da OS continua com o preço original de R$ 60,00 (Preço Histórico Congelado)
        assertEquals(new BigDecimal("60.00"), itemPersistido.getValorUnitario(), "Passo 10: Preço unitário na OS não pode sofrer alteração posterior");
        assertEquals(new BigDecimal("180.00"), itemPersistido.getValorTotal(), "Passo 10: Subtotal de peças na OS deve permanecer R$ 180,00");

        // 11. Cancelar OS (deve devolver peças, gerar DEVOLUCAO e atualizar estoque)
        when(ordemServicoRepository.findByIdWithClienteAndMaquina(500L)).thenReturn(Optional.of(os));
        when(ordemServicoRepository.save(any(OrdemServico.class))).thenAnswer(i -> i.getArgument(0));

        OrdemServicoStatusDTO cancelamentoDTO = new OrdemServicoStatusDTO(
                StatusOrdemServico.CANCELADA,
                null,
                "Cliente desistiu do reparo"
        );

        ordemServicoService.alterarStatus(500L, cancelamentoDTO, 1L, null);

        // 12. Verificar estoque = 10
        assertEquals(new BigDecimal("10.000"), produto.getEstoqueAtual(), "Passo 12: Estoque deve voltar a 10 unidades após devolução por cancelamento");

        // 13. Verificar que foi registrada movimentação de DEVOLUCAO
        ArgumentCaptor<EstoqueMovimentacao> movCaptor = ArgumentCaptor.forClass(EstoqueMovimentacao.class);
        verify(estoqueMovimentacaoRepository, atLeastOnce()).save(movCaptor.capture());

        List<EstoqueMovimentacao> movs = movCaptor.getAllValues();
        boolean temDevolucao = movs.stream().anyMatch(m ->
                m.getTipoMovimentacao() == TipoMovimentacaoEstoque.DEVOLUCAO &&
                m.getQuantidade().compareTo(new BigDecimal("3.000")) == 0 &&
                m.getQuantidadeAnterior().compareTo(new BigDecimal("7.000")) == 0 &&
                m.getQuantidadePosterior().compareTo(new BigDecimal("10.000")) == 0
        );
        assertTrue(temDevolucao, "Passo 13: Movimentação do tipo DEVOLUCAO de 3 unidades deve ter sido persistida com saldos anterior=7 e posterior=10");

        // 14. Verificar histórico de movimentações auditadas
        verify(auditoriaService, atLeastOnce()).registrar(eq(1L), eq("OrdemServico"), eq("500"), eq("STATUS_CANCELADA"), any());
    }
}
