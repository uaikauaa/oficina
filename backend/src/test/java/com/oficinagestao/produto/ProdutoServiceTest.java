package com.oficinagestao.produto;

import com.oficinagestao.auditoria.AuditoriaService;
import com.oficinagestao.estoque.EstoqueMovimentacao;
import com.oficinagestao.estoque.EstoqueMovimentacaoRepository;
import com.oficinagestao.exception.BusinessException;
import com.oficinagestao.exception.ConflictException;
import com.oficinagestao.exception.ResourceNotFoundException;
import com.oficinagestao.fornecedor.Fornecedor;
import com.oficinagestao.fornecedor.FornecedorRepository;
import com.oficinagestao.maquina.Maquina;
import com.oficinagestao.maquina.MaquinaRepository;
import com.oficinagestao.maquina.TipoEquipamento;
import com.oficinagestao.produto.dto.CompatibilidadeResponseDTO;
import com.oficinagestao.produto.dto.ProdutoCompatibilidadeDTO;
import com.oficinagestao.produto.dto.ProdutoCreateDTO;
import com.oficinagestao.produto.dto.ProdutoResponseDTO;
import com.oficinagestao.produto.dto.ProdutoUpdateDTO;
import com.oficinagestao.usuario.Usuario;
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

    @Spy
    private ProdutoMapper produtoMapper = new ProdutoMapper();

    @InjectMocks
    private ProdutoService produtoService;

    private Produto produto;
    private Fornecedor fornecedor;
    private Maquina maquina;

    @BeforeEach
    void setUp() {
        fornecedor = new Fornecedor("Eletrônica XYZ", "XYZ", "11222333000144", "3133332222", "xyz@mail.com");
        fornecedor.setId(1L);

        produto = new Produto();
        produto.setId(10L);
        produto.setCodigo("IGBT-60N100");
        produto.setNome("Módulo IGBT 60A 1000V");
        produto.setTipo(TipoProduto.PECA);
        produto.setPrecoCusto(new BigDecimal("45.00"));
        produto.setPrecoVenda(new BigDecimal("85.00"));
        produto.setEstoqueAtual(new BigDecimal("10.000"));
        produto.setEstoqueMinimo(new BigDecimal("2.000"));
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
    @DisplayName("Deve cadastrar produto/peça com sucesso sem estoque inicial")
    void deveCadastrarProdutoComSucesso() {
        ProdutoCreateDTO dto = new ProdutoCreateDTO(
                "IGBT-60N100",
                null,
                "Módulo IGBT 60A 1000V",
                "Chaveador inversor para solda TIG/MIG",
                TipoProduto.PECA,
                "UN",
                new BigDecimal("45.00"),
                new BigDecimal("85.00"),
                new BigDecimal("2.000"),
                null,
                "Gaveta A-3",
                1L
        );

        when(produtoRepository.existsByCodigo("IGBT-60N100")).thenReturn(false);
        when(fornecedorRepository.findById(1L)).thenReturn(Optional.of(fornecedor));
        when(produtoRepository.save(any(Produto.class))).thenAnswer(i -> {
            Produto p = i.getArgument(0);
            p.setId(10L);
            return p;
        });

        ProdutoResponseDTO response = produtoService.cadastrar(dto, 1L, null);

        assertNotNull(response);
        assertEquals("IGBT-60N100", response.codigo());
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
                TipoProduto.PECA,
                "UN",
                new BigDecimal("120.00"),
                new BigDecimal("210.00"),
                new BigDecimal("1.000"),
                new BigDecimal("5.000"), // estoque inicial = 5
                "Prateleira B-1",
                1L
        );

        when(produtoRepository.existsByCodigo("AVR-10KVA")).thenReturn(false);
        when(fornecedorRepository.findById(1L)).thenReturn(Optional.of(fornecedor));
        when(produtoRepository.save(any(Produto.class))).thenAnswer(i -> {
            Produto p = i.getArgument(0);
            p.setId(20L);
            return p;
        });

        ProdutoResponseDTO response = produtoService.cadastrar(dto, 1L, null);

        assertNotNull(response);
        assertEquals("AVR-10KVA", response.codigo());
        assertEquals(new BigDecimal("5.000"), response.estoqueAtual());
        verify(estoqueMovimentacaoRepository).save(any(EstoqueMovimentacao.class));
    }

    @Test
    @DisplayName("Deve rejeitar cadastro com código de produto duplicado")
    void deveRejeitarCadastroComCodigoDuplicado() {
        ProdutoCreateDTO dto = new ProdutoCreateDTO(
                "IGBT-60N100", null, "Nome", null, TipoProduto.PECA, "UN",
                BigDecimal.TEN, BigDecimal.TEN, BigDecimal.ZERO, null, null, null
        );

        when(produtoRepository.existsByCodigo("IGBT-60N100")).thenReturn(true);

        assertThrows(ConflictException.class, () -> produtoService.cadastrar(dto, 1L, null));
        verify(produtoRepository, never()).save(any());
    }

    @Test
    @DisplayName("Deve adicionar compatibilidade entre peça e máquina")
    void deveAdicionarCompatibilidade() {
        ProdutoCompatibilidadeDTO dto = new ProdutoCompatibilidadeDTO(100L, "Compatível com inversoras de solda 250A a 300A");

        when(produtoRepository.findById(10L)).thenReturn(Optional.of(produto));
        when(maquinaRepository.findById(100L)).thenReturn(Optional.of(maquina));
        when(produtoMaquinaRepository.existsByProdutoIdAndMaquinaId(10L, 100L)).thenReturn(false);
        when(produtoMaquinaRepository.save(any(ProdutoMaquina.class))).thenAnswer(i -> {
            ProdutoMaquina pm = i.getArgument(0);
            pm.setId(55L);
            return pm;
        });

        CompatibilidadeResponseDTO response = produtoService.adicionarCompatibilidade(10L, dto, 1L, null);

        assertNotNull(response);
        assertEquals(100L, response.maquinaId());
        assertEquals("ESAB", response.maquinaMarca());
        verify(auditoriaService).registrarComRequest(eq(1L), eq("ProdutoMaquina"), eq("55"), eq("INSERT"), any());
    }

    @Test
    @DisplayName("Deve rejeitar compatibilidade duplicada")
    void deveRejeitarCompatibilidadeDuplicada() {
        ProdutoCompatibilidadeDTO dto = new ProdutoCompatibilidadeDTO(100L, "Compatível");

        when(produtoRepository.findById(10L)).thenReturn(Optional.of(produto));
        when(maquinaRepository.findById(100L)).thenReturn(Optional.of(maquina));
        when(produtoMaquinaRepository.existsByProdutoIdAndMaquinaId(10L, 100L)).thenReturn(true);

        assertThrows(BusinessException.class, () -> produtoService.adicionarCompatibilidade(10L, dto, 1L, null));
        verify(produtoMaquinaRepository, never()).save(any());
    }
}
