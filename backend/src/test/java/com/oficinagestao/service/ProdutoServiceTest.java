package com.oficinagestao.service;

import com.oficinagestao.dto.*;
import com.oficinagestao.entity.*;
import com.oficinagestao.exception.BusinessException;
import com.oficinagestao.exception.ConflictException;
import com.oficinagestao.exception.ResourceNotFoundException;
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

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProdutoServiceTest {

    @Mock
    private ProdutoRepository produtoRepository;

    @Mock
    private CategoriaRepository categoriaRepository;

    @Mock
    private FornecedorRepository fornecedorRepository;

    @Mock
    private ProdutoMaquinaRepository produtoMaquinaRepository;

    @Mock
    private MaquinaRepository maquinaRepository;

    @Mock
    private EstoqueMovimentacaoRepository estoqueMovimentacaoRepository;

    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private AuditoriaService auditoriaService;

    @InjectMocks
    private ProdutoService produtoService;

    private Produto produto;
    private Categoria categoria;
    private Fornecedor fornecedor;
    private Maquina maquina;

    @BeforeEach
    void setUp() {
        categoria = new Categoria("Eletrônica", "Componentes eletrônicos");
        categoria.setId(5L);

        fornecedor = new Fornecedor("Eletrônica XYZ", "XYZ", "11222333000144", "3133332222", "xyz@mail.com");
        fornecedor.setId(1L);

        produto = new Produto();
        produto.setId(10L);
        produto.setCodigo("IGBT-60N100");
        produto.setNome("Módulo IGBT 60A 1000V");
        produto.setMarca("Toshiba");
        produto.setTipo(TipoProduto.PECA);
        produto.setPrecoCusto(new BigDecimal("45.00"));
        produto.setPrecoVenda(new BigDecimal("85.00"));
        produto.setEstoqueAtual(new BigDecimal("10.000"));
        produto.setEstoqueMinimo(new BigDecimal("2.000"));
        produto.setCategoria(categoria);
        produto.setFornecedor(fornecedor);
        produto.setAtivo(true);

        maquina = new Maquina();
        maquina.setId(100L);
        maquina.setTipoEquipamento(TipoEquipamento.MAQUINA_SOLDA);
        maquina.setMarca("ESAB");
        maquina.setModelo("Smashweld 260");
        maquina.setNumeroSerie("ESAB-2024-99");
    }

    @Test
    @DisplayName("Deve cadastrar produto/peça com sucesso com categoria, marca e sem estoque inicial")
    void deveCadastrarProdutoComSucesso() {
        ProdutoCreateDTO dto = new ProdutoCreateDTO(
                "IGBT-60N100",
                null,
                "Módulo IGBT 60A 1000V",
                "Chaveador inversor para solda TIG/MIG",
                "Toshiba",
                TipoProduto.PECA,
                "UN",
                new BigDecimal("45.00"),
                new BigDecimal("85.00"),
                new BigDecimal("2.000"),
                null,
                "Gaveta A-3",
                5L,
                1L
        );

        when(produtoRepository.existsByCodigo("IGBT-60N100")).thenReturn(false);
        when(categoriaRepository.findById(5L)).thenReturn(Optional.of(categoria));
        when(fornecedorRepository.findById(1L)).thenReturn(Optional.of(fornecedor));
        when(produtoRepository.save(any(Produto.class))).thenAnswer(i -> {
            Produto p = i.getArgument(0);
            p.setId(10L);
            return p;
        });

        ProdutoResponseDTO response = produtoService.cadastrar(dto, 1L, null);

        assertNotNull(response);
        assertEquals("IGBT-60N100", response.codigo());
        assertEquals("Toshiba", response.marca());
        assertEquals(5L, response.categoriaId());
        assertEquals("Eletrônica", response.categoriaNome());
        assertEquals(new BigDecimal("85.00"), response.precoVenda());
        assertEquals("Eletrônica XYZ", response.fornecedorNome());
        verify(estoqueMovimentacaoRepository, never()).save(any());
        verify(auditoriaService).registrarComRequest(eq(1L), eq("Produto"), eq("10"), eq("INSERT"), any());
    }

    @Test
    @DisplayName("Deve cadastrar produto com estoque inicial e gerar movimentação de entrada")
    void deveCadastrarProdutoComEstoqueInicial() {
        ProdutoCreateDTO dto = new ProdutoCreateDTO(
                "AVR-10KVA",
                null,
                "Regulador Automático de Voltagem AVR 10kVA",
                "Para geradores trifásicos",
                "Stamford",
                TipoProduto.PECA,
                "UN",
                new BigDecimal("120.00"),
                new BigDecimal("210.00"),
                new BigDecimal("1.000"),
                new BigDecimal("5.000"), // estoque inicial = 5
                "Prateleira B-1",
                5L,
                1L
        );

        when(produtoRepository.existsByCodigo("AVR-10KVA")).thenReturn(false);
        when(categoriaRepository.findById(5L)).thenReturn(Optional.of(categoria));
        when(fornecedorRepository.findById(1L)).thenReturn(Optional.of(fornecedor));
        when(produtoRepository.save(any(Produto.class))).thenAnswer(i -> {
            Produto p = i.getArgument(0);
            p.setId(20L);
            return p;
        });

        ProdutoResponseDTO response = produtoService.cadastrar(dto, 1L, null);

        assertNotNull(response);
        assertEquals("AVR-10KVA", response.codigo());
        assertEquals("Stamford", response.marca());
        assertEquals(new BigDecimal("5.000"), response.estoqueAtual());
        verify(estoqueMovimentacaoRepository).save(any(EstoqueMovimentacao.class));
    }

    @Test
    @DisplayName("Deve lançar ResourceNotFoundException ao cadastrar com categoria inexistente")
    void deveRejeitarCadastroComCategoriaInexistente() {
        ProdutoCreateDTO dto = new ProdutoCreateDTO(
                "IGBT-60N100", null, "Nome", null, "Toshiba", TipoProduto.PECA, "UN",
                BigDecimal.TEN, BigDecimal.TEN, BigDecimal.ZERO, null, null, 999L, null
        );

        when(produtoRepository.existsByCodigo("IGBT-60N100")).thenReturn(false);
        when(categoriaRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> produtoService.cadastrar(dto, 1L, null));
        verify(produtoRepository, never()).save(any());
    }

    @Test
    @DisplayName("Deve rejeitar cadastro com código de produto duplicado")
    void deveRejeitarCadastroComCodigoDuplicado() {
        ProdutoCreateDTO dto = new ProdutoCreateDTO(
                "IGBT-60N100", null, "Nome", null, null, TipoProduto.PECA, "UN",
                BigDecimal.TEN, BigDecimal.TEN, BigDecimal.ZERO, null, null, null, null
        );

        when(produtoRepository.existsByCodigo("IGBT-60N100")).thenReturn(true);

        assertThrows(ConflictException.class, () -> produtoService.cadastrar(dto, 1L, null));
        verify(produtoRepository, never()).save(any());
    }

    @Test
    @DisplayName("Deve atualizar produto com sucesso, incluindo alteração de marca e categoria")
    void deveAtualizarProdutoComSucesso() {
        ProdutoUpdateDTO dto = new ProdutoUpdateDTO(
                "IGBT-60N100-MOD",
                null,
                "Módulo IGBT 60A 1000V Revisado",
                "Chaveador rápido",
                "Infineon",
                TipoProduto.PECA,
                "UN",
                new BigDecimal("50.00"),
                new BigDecimal("95.00"),
                new BigDecimal("3.000"),
                "Gaveta A-4",
                5L,
                1L
        );

        when(produtoRepository.findById(10L)).thenReturn(Optional.of(produto));
        when(produtoRepository.existsByCodigoAndIdNot("IGBT-60N100-MOD", 10L)).thenReturn(false);
        when(categoriaRepository.findById(5L)).thenReturn(Optional.of(categoria));
        when(fornecedorRepository.findById(1L)).thenReturn(Optional.of(fornecedor));
        when(produtoRepository.save(any(Produto.class))).thenReturn(produto);

        ProdutoResponseDTO response = produtoService.atualizar(10L, dto, 1L, null);

        assertNotNull(response);
        assertEquals("IGBT-60N100-MOD", response.codigo());
        assertEquals("Infineon", response.marca());
        assertEquals(new BigDecimal("95.00"), response.precoVenda());
        verify(auditoriaService).registrarComRequest(eq(1L), eq("Produto"), eq("10"), eq("UPDATE"), any());
    }

    @Test
    @DisplayName("Deve alterar status do produto para inativo")
    void deveInativarProduto() {
        when(produtoRepository.findById(10L)).thenReturn(Optional.of(produto));
        when(produtoRepository.save(any(Produto.class))).thenReturn(produto);

        ProdutoResponseDTO response = produtoService.alterarStatus(10L, false, 1L, null);

        assertNotNull(response);
        assertFalse(response.ativo());
        verify(auditoriaService).registrarComRequest(eq(1L), eq("Produto"), eq("10"), eq("INATIVAR"), any());
    }

    @Test
    @DisplayName("Deve listar produtos com paginação e filtros")
    void deveListarProdutosComPaginacao() {
        Page<Produto> page = new PageImpl<>(List.of(produto));
        when(produtoRepository.pesquisarGlobal(eq("IGBT"), eq(TipoProduto.PECA), eq(5L), eq(1L), eq(true), eq(false), any()))
                .thenReturn(page);

        Page<ProdutoResponseDTO> resultado = produtoService.listar("IGBT", TipoProduto.PECA, 5L, 1L, true, false, PageRequest.of(0, 10));

        assertFalse(resultado.isEmpty());
        assertEquals(1, resultado.getTotalElements());
        assertEquals("IGBT-60N100", resultado.getContent().get(0).codigo());
    }

    @Test
    @DisplayName("Deve adicionar compatibilidade entre peça e equipamento com sucesso")
    void deveAdicionarCompatibilidadeComSucesso() {
        ProdutoCompatibilidadeDTO dto = new ProdutoCompatibilidadeDTO(100L, "Compatível com placa de controle versão 2.0");

        when(produtoRepository.findById(10L)).thenReturn(Optional.of(produto));
        when(maquinaRepository.findById(100L)).thenReturn(Optional.of(maquina));
        when(produtoMaquinaRepository.existsByProdutoIdAndMaquinaId(10L, 100L)).thenReturn(false);

        ProdutoMaquina pmSalvo = new ProdutoMaquina(produto, maquina, dto.observacaoCompatibilidade());
        pmSalvo.setId(1L);
        when(produtoMaquinaRepository.save(any(ProdutoMaquina.class))).thenReturn(pmSalvo);

        CompatibilidadeResponseDTO response = produtoService.adicionarCompatibilidade(10L, dto, 1L, null);

        assertNotNull(response);
        assertEquals(1L, response.id());
        assertEquals(100L, response.maquinaId());
        assertEquals("ESAB", response.maquinaMarca());
        verify(auditoriaService).registrarComRequest(eq(1L), eq("ProdutoMaquina"), eq("1"), eq("INSERT"), any());
    }

    @Test
    @DisplayName("Deve rejeitar adição de compatibilidade duplicada para o mesmo equipamento")
    void deveRejeitarCompatibilidadeDuplicada() {
        ProdutoCompatibilidadeDTO dto = new ProdutoCompatibilidadeDTO(100L, "Obs");

        when(produtoRepository.findById(10L)).thenReturn(Optional.of(produto));
        when(maquinaRepository.findById(100L)).thenReturn(Optional.of(maquina));
        when(produtoMaquinaRepository.existsByProdutoIdAndMaquinaId(10L, 100L)).thenReturn(true);

        assertThrows(BusinessException.class, () -> produtoService.adicionarCompatibilidade(10L, dto, 1L, null));
        verify(produtoMaquinaRepository, never()).save(any());
    }

    @Test
    @DisplayName("Deve remover compatibilidade com sucesso")
    void deveRemoverCompatibilidadeComSucesso() {
        ProdutoMaquina pm = new ProdutoMaquina(produto, maquina, "Obs");
        pm.setId(1L);

        when(produtoMaquinaRepository.findByProdutoIdAndMaquinaId(10L, 100L)).thenReturn(Optional.of(pm));

        produtoService.removerCompatibilidade(10L, 100L, 1L, null);

        verify(produtoMaquinaRepository).delete(pm);
        verify(auditoriaService).registrarComRequest(eq(1L), eq("ProdutoMaquina"), eq("1"), eq("DELETE"), any());
    }
}
