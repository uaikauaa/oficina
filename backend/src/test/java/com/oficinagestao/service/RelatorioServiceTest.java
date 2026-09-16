package com.oficinagestao.service;

import com.oficinagestao.dto.*;
import com.oficinagestao.entity.*;
import com.oficinagestao.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RelatorioServiceTest {

    @Mock
    private OrdemServicoRepository ordemServicoRepository;

    @Mock
    private ProdutoRepository produtoRepository;

    @Mock
    private EstoqueMovimentacaoRepository estoqueMovimentacaoRepository;

    @Mock
    private OrdemServicoItemRepository ordemServicoItemRepository;

    @Mock
    private ClienteRepository clienteRepository;

    @Mock
    private MaquinaRepository maquinaRepository;

    @Mock
    private OrdemServicoService ordemServicoService;

    @Mock
    private EstoqueService estoqueService;

    @InjectMocks
    private RelatorioService relatorioService;

    private Pageable pageable;

    @BeforeEach
    void setUp() {
        pageable = PageRequest.of(0, 20);
    }

    @Test
    @DisplayName("Deve gerar relatório de Ordens de Serviço por período com contadores e somatório de concluídas")
    void deveGerarRelatorioOsPorPeriodo() {
        OffsetDateTime inicio = OffsetDateTime.now().minusDays(30);
        OffsetDateTime fim = OffsetDateTime.now();

        when(ordemServicoRepository.contarPorPeriodoEStatus(inicio, fim, null)).thenReturn(10L);
        when(ordemServicoRepository.contarPorPeriodoEStatus(inicio, fim, StatusOrdemServico.CONCLUIDA)).thenReturn(6L);
        when(ordemServicoRepository.contarAbertasPorPeriodo(inicio, fim)).thenReturn(3L);
        when(ordemServicoRepository.contarPorPeriodoEStatus(inicio, fim, StatusOrdemServico.CANCELADA)).thenReturn(1L);
        when(ordemServicoRepository.somarValorConcluidasPorPeriodo(inicio, fim)).thenReturn(new BigDecimal("4500.00"));

        OrdemServico os = new OrdemServico();
        os.setId(1L);
        Page<OrdemServico> pageOs = new PageImpl<>(List.of(os), pageable, 1);
        when(ordemServicoRepository.pesquisarGlobal(isNull(), isNull(), eq(inicio), eq(fim), eq(pageable))).thenReturn(pageOs);

        RelatorioOsResponseDTO resultado = relatorioService.obterRelatorioOsPorPeriodo(inicio, fim, null, pageable);

        assertNotNull(resultado);
        assertNotNull(resultado.resumo());
        assertEquals(10L, resultado.resumo().totalOs());
        assertEquals(6L, resultado.resumo().concluidas());
        assertEquals(3L, resultado.resumo().abertas());
        assertEquals(1L, resultado.resumo().canceladas());
        assertEquals(new BigDecimal("4500.00"), resultado.resumo().valorTotalConcluidas());
        assertEquals(1, resultado.itens().getTotalElements());
    }

    @Test
    @DisplayName("Deve classificar status do estoque corretamente (ZERADO, BAIXO, NORMAL)")
    void deveClassificarStatusEstoqueCorretamente() {
        Categoria cat = new Categoria();
        cat.setNome("Eletrônica");

        Fornecedor forn = new Fornecedor();
        forn.setRazaoSocial("Semikron S.A.");

        // Produto Zerado
        Produto pZerado = new Produto();
        pZerado.setId(1L);
        pZerado.setCodigo("IGBT-01");
        pZerado.setNome("IGBT Zerado");
        pZerado.setCategoria(cat);
        pZerado.setFornecedor(forn);
        pZerado.setEstoqueAtual(BigDecimal.ZERO);
        pZerado.setEstoqueMinimo(new BigDecimal("5.00"));

        // Produto Baixo
        Produto pBaixo = new Produto();
        pBaixo.setId(2L);
        pBaixo.setCodigo("DIO-02");
        pBaixo.setNome("Diodo Baixo");
        pBaixo.setCategoria(cat);
        pBaixo.setFornecedor(forn);
        pBaixo.setEstoqueAtual(new BigDecimal("3.00"));
        pBaixo.setEstoqueMinimo(new BigDecimal("5.00"));

        // Produto Normal
        Produto pNormal = new Produto();
        pNormal.setId(3L);
        pNormal.setCodigo("CAP-03");
        pNormal.setNome("Capacitor Normal");
        pNormal.setCategoria(cat);
        pNormal.setFornecedor(forn);
        pNormal.setEstoqueAtual(new BigDecimal("20.00"));
        pNormal.setEstoqueMinimo(new BigDecimal("5.00"));

        Page<Produto> produtosPage = new PageImpl<>(List.of(pZerado, pBaixo, pNormal), pageable, 3);
        when(produtoRepository.relatorioEstoque(null, null, null, null, pageable)).thenReturn(produtosPage);

        Page<RelatorioEstoqueItemDTO> relatorio = relatorioService.obterRelatorioEstoque(null, null, null, null, pageable);

        assertNotNull(relatorio);
        assertEquals(3, relatorio.getTotalElements());

        List<RelatorioEstoqueItemDTO> itens = relatorio.getContent();
        assertEquals("ZERADO", itens.get(0).statusEstoque());
        assertEquals("BAIXO", itens.get(1).statusEstoque());
        assertEquals("NORMAL", itens.get(2).statusEstoque());
    }

    @Test
    @DisplayName("Deve retornar ranking de peças mais utilizadas")
    void deveRetornarRankingPecasMaisUtilizadas() {
        PecaMaisUtilizadaDTO peca1 = new PecaMaisUtilizadaDTO(1L, "IGBT-60N60", "Transistor IGBT", "Infineon", 45L, 12L);
        PecaMaisUtilizadaDTO peca2 = new PecaMaisUtilizadaDTO(2L, "DIO-100A", "Diodo Rápido", "Semikron", 20L, 8L);

        Page<PecaMaisUtilizadaDTO> rankingPage = new PageImpl<>(List.of(peca1, peca2), pageable, 2);
        when(ordemServicoItemRepository.relatorioPecasMaisUtilizadas(pageable)).thenReturn(rankingPage);

        Page<PecaMaisUtilizadaDTO> resultado = relatorioService.obterPecasMaisUtilizadas(pageable);

        assertNotNull(resultado);
        assertEquals(2, resultado.getTotalElements());
        assertEquals("IGBT-60N60", resultado.getContent().get(0).codigo());
        assertEquals(0, new BigDecimal("45").compareTo(resultado.getContent().get(0).quantidadeTotalUtilizada()));
    }

    @Test
    @DisplayName("Deve retornar relatório consolidado de clientes com valor acumulado estrito")
    void deveRetornarRelatorioClientes() {
        RelatorioClienteItemDTO c1 = new RelatorioClienteItemDTO(
                1L, "Metalúrgica ABC", "11.222.333/0001-44", "(31) 3333-1111",
                3L, 5L, OffsetDateTime.now().minusDays(5), new BigDecimal("12500.00")
        );

        Page<RelatorioClienteItemDTO> pageCliente = new PageImpl<>(List.of(c1), pageable, 1);
        when(clienteRepository.relatorioClientes(pageable)).thenReturn(pageCliente);

        Page<RelatorioClienteItemDTO> resultado = relatorioService.obterRelatorioClientes(pageable);

        assertNotNull(resultado);
        assertEquals(1, resultado.getTotalElements());
        assertEquals(new BigDecimal("12500.00"), resultado.getContent().get(0).valorAcumulado());
    }

    @Test
    @DisplayName("Deve retornar relatório consolidado de equipamentos com valor acumulado estrito")
    void deveRetornarRelatorioEquipamentos() {
        RelatorioMaquinaItemDTO m1 = new RelatorioMaquinaItemDTO(
                10L, "Metalúrgica ABC", TipoEquipamento.MAQUINA_SOLDA, "ESAB", "Smashweld 450", "SN-9988",
                4L, OffsetDateTime.now().minusDays(10), new BigDecimal("3200.00")
        );

        Page<RelatorioMaquinaItemDTO> pageMaquina = new PageImpl<>(List.of(m1), pageable, 1);
        when(maquinaRepository.relatorioEquipamentos(pageable)).thenReturn(pageMaquina);

        Page<RelatorioMaquinaItemDTO> resultado = relatorioService.obterRelatorioEquipamentos(pageable);

        assertNotNull(resultado);
        assertEquals(1, resultado.getTotalElements());
        assertEquals("ESAB", resultado.getContent().get(0).marca());
        assertEquals(new BigDecimal("3200.00"), resultado.getContent().get(0).valorAcumulado());
    }
}
