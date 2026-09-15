package com.oficinagestao.estoque;

import com.oficinagestao.auditoria.AuditoriaService;
import com.oficinagestao.estoque.dto.EstoqueMovimentacaoResponseDTO;
import com.oficinagestao.estoque.dto.EstoqueResumoDTO;
import com.oficinagestao.estoque.dto.MovimentacaoManualDTO;
import com.oficinagestao.exception.BusinessException;
import com.oficinagestao.produto.Produto;
import com.oficinagestao.produto.ProdutoRepository;
import com.oficinagestao.usuario.UsuarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EstoqueServiceTest {

    @Mock
    private EstoqueMovimentacaoRepository estoqueMovimentacaoRepository;

    @Mock
    private ProdutoRepository produtoRepository;

    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private AuditoriaService auditoriaService;

    @Spy
    private EstoqueMapper estoqueMapper = new EstoqueMapper();

    @InjectMocks
    private EstoqueService estoqueService;

    private Produto produto;

    @BeforeEach
    void setUp() {
        produto = new Produto();
        produto.setId(10L);
        produto.setCodigo("CAP-470UF");
        produto.setNome("Capacitor Eletrolítico 470uF 450V");
        produto.setEstoqueAtual(new BigDecimal("10.000"));
        produto.setEstoqueMinimo(new BigDecimal("3.000"));
        produto.setPrecoCusto(new BigDecimal("15.00"));
        produto.setPrecoVenda(new BigDecimal("30.00"));
        produto.setAtivo(true);
    }

    @Test
    @DisplayName("Deve registrar entrada manual no estoque e aumentar saldo")
    void deveRegistrarEntradaManualComSucesso() {
        MovimentacaoManualDTO dto = new MovimentacaoManualDTO(
                10L,
                TipoMovimentacaoEstoque.ENTRADA,
                new BigDecimal("5.000"),
                new BigDecimal("15.00"),
                "Compra NF 1234 Fornecedor ABC"
        );

        when(produtoRepository.findByIdWithLock(10L)).thenReturn(Optional.of(produto));
        when(produtoRepository.save(any(Produto.class))).thenReturn(produto);
        when(estoqueMovimentacaoRepository.save(any(EstoqueMovimentacao.class))).thenAnswer(i -> {
            EstoqueMovimentacao m = i.getArgument(0);
            m.setId(1L);
            return m;
        });

        EstoqueMovimentacaoResponseDTO response = estoqueService.registrarMovimentacaoManual(dto, 1L, null);

        assertNotNull(response);
        assertEquals(new BigDecimal("10.000"), response.quantidadeAnterior());
        assertEquals(new BigDecimal("15.000"), response.quantidadePosterior());
        assertEquals(new BigDecimal("15.000"), produto.getEstoqueAtual());
        verify(auditoriaService).registrarComRequest(eq(1L), eq("EstoqueMovimentacao"), eq("1"), eq("INSERT"), any());
    }

    @Test
    @DisplayName("Deve registrar saída manual e diminuir saldo")
    void deveRegistrarSaidaManualComSucesso() {
        MovimentacaoManualDTO dto = new MovimentacaoManualDTO(
                10L,
                TipoMovimentacaoEstoque.SAIDA,
                new BigDecimal("4.000"),
                null,
                "Descarte por dano físico"
        );

        when(produtoRepository.findByIdWithLock(10L)).thenReturn(Optional.of(produto));
        when(produtoRepository.save(any(Produto.class))).thenReturn(produto);
        when(estoqueMovimentacaoRepository.save(any(EstoqueMovimentacao.class))).thenAnswer(i -> {
            EstoqueMovimentacao m = i.getArgument(0);
            m.setId(2L);
            return m;
        });

        EstoqueMovimentacaoResponseDTO response = estoqueService.registrarMovimentacaoManual(dto, 1L, null);

        assertNotNull(response);
        assertEquals(new BigDecimal("10.000"), response.quantidadeAnterior());
        assertEquals(new BigDecimal("6.000"), response.quantidadePosterior());
        assertEquals(new BigDecimal("6.000"), produto.getEstoqueAtual());
    }

    @Test
    @DisplayName("Deve rejeitar saída se estoque for insuficiente (regra crítica: saldo nunca negativo)")
    void deveRejeitarSaidaSeEstoqueInsuficiente() {
        MovimentacaoManualDTO dto = new MovimentacaoManualDTO(
                10L,
                TipoMovimentacaoEstoque.SAIDA,
                new BigDecimal("11.000"), // Saldo é 10
                null,
                "Tentativa de saída maior que estoque"
        );

        when(produtoRepository.findByIdWithLock(10L)).thenReturn(Optional.of(produto));

        BusinessException ex = assertThrows(BusinessException.class, () ->
                estoqueService.registrarMovimentacaoManual(dto, 1L, null)
        );

        assertTrue(ex.getMessage().contains("Estoque insuficiente"));
        assertEquals(new BigDecimal("10.000"), produto.getEstoqueAtual()); // Saldo intocado
        verify(produtoRepository, never()).save(any());
        verify(estoqueMovimentacaoRepository, never()).save(any());
    }

    @Test
    @DisplayName("Deve rejeitar ajuste negativo se saldo for insuficiente")
    void deveRejeitarAjusteNegativoSeInsuficiente() {
        MovimentacaoManualDTO dto = new MovimentacaoManualDTO(
                10L,
                TipoMovimentacaoEstoque.AJUSTE_NEGATIVO,
                new BigDecimal("15.000"), // Saldo é 10
                null,
                "Conferência física com perda"
        );

        when(produtoRepository.findByIdWithLock(10L)).thenReturn(Optional.of(produto));

        assertThrows(BusinessException.class, () ->
                estoqueService.registrarMovimentacaoManual(dto, 1L, null)
        );

        verify(produtoRepository, never()).save(any());
    }

    @Test
    @DisplayName("Deve rejeitar movimentação se produto estiver inativo")
    void deveRejeitarMovimentacaoProdutoInativo() {
        produto.setAtivo(false);
        MovimentacaoManualDTO dto = new MovimentacaoManualDTO(
                10L, TipoMovimentacaoEstoque.ENTRADA, BigDecimal.ONE, null, "Entrada"
        );

        when(produtoRepository.findByIdWithLock(10L)).thenReturn(Optional.of(produto));

        BusinessException ex = assertThrows(BusinessException.class, () ->
                estoqueService.registrarMovimentacaoManual(dto, 1L, null)
        );

        assertTrue(ex.getMessage().contains("produto inativo"));
    }

    @Test
    @DisplayName("Deve retornar resumo de estoque com métricas")
    void deveRetornarResumoEstoque() {
        when(produtoRepository.count()).thenReturn(50L);
        when(produtoRepository.countSemEstoque()).thenReturn(3L);
        when(produtoRepository.countEstoqueBaixo()).thenReturn(8L);
        when(produtoRepository.somarValorTotalEstoque()).thenReturn(new BigDecimal("45600.00"));

        EstoqueResumoDTO resumo = estoqueService.obterResumoEstoque();

        assertNotNull(resumo);
        assertEquals(50L, resumo.totalProdutos());
        assertEquals(3L, resumo.itensSemEstoque());
        assertEquals(8L, resumo.itensEstoqueBaixo());
        assertEquals(new BigDecimal("45600.00"), resumo.valorTotalEstoque());
    }
}
