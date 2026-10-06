package com.oficinagestao.service;

import com.oficinagestao.dto.EstoqueMovimentacaoResponseDTO;
import com.oficinagestao.dto.MovimentacaoManualDTO;
import com.oficinagestao.dto.ProdutoCreateDTO;
import com.oficinagestao.dto.ProdutoResponseDTO;
import com.oficinagestao.dto.ProdutoUpdateDTO;
import com.oficinagestao.entity.Produto;
import com.oficinagestao.entity.TipoMovimentacaoEstoque;
import com.oficinagestao.entity.TipoProduto;
import com.oficinagestao.repository.ProdutoRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@ActiveProfiles("test")
class ProdutoEstoqueConcurrencyIntegrationTest {

    private static final BigDecimal DEZ = new BigDecimal("10.000");
    private static final BigDecimal TRES = new BigDecimal("3.000");

    @Autowired private ProdutoService produtoService;
    @Autowired private EstoqueService estoqueService;
    @Autowired private ProdutoRepository produtoRepository;
    @Autowired private TransactionTemplate transactionTemplate;
    @Autowired private JdbcTemplate jdbcTemplate;

    private final List<Long> produtoIds = new ArrayList<>();

    @AfterEach
    void limparFixtures() {
        for (Long id : produtoIds) {
            jdbcTemplate.update("DELETE FROM auditoria WHERE (entidade = 'Produto' AND entidade_id = ?) "
                    + "OR (entidade = 'EstoqueMovimentacao' AND entidade_id IN "
                    + "(SELECT id::text FROM estoque_movimentacoes WHERE produto_id = ?))", id.toString(), id);
            jdbcTemplate.update("DELETE FROM notificacoes WHERE chave_unica = ?", "ESTOQUE_BAIXO_" + id);
            jdbcTemplate.update("DELETE FROM estoque_movimentacoes WHERE produto_id = ?", id);
            jdbcTemplate.update("DELETE FROM produtos WHERE id = ?", id);
        }
        produtoIds.clear();
    }

    @ParameterizedTest
    @EnumSource(value = TipoMovimentacaoEstoque.class,
            names = {"ENTRADA", "SAIDA", "AJUSTE_POSITIVO", "AJUSTE_NEGATIVO"})
    void edicaoComLeituraObsoletaPreservaMovimentacaoConcluida(TipoMovimentacaoEstoque tipo) throws Exception {
        Long id = criarProdutoComSaldoDez();
        CountDownLatch produtoCarregado = new CountDownLatch(1);
        CountDownLatch movimentacaoConcluida = new CountDownLatch(1);
        AtomicReference<ProdutoResponseDTO> respostaEdicao = new AtomicReference<>();
        ExecutorService executor = Executors.newFixedThreadPool(2);

        try {
            Future<?> edicao = executor.submit(() -> transactionTemplate.executeWithoutResult(tx -> {
                assertNotNull(produtoRepository.findById(id).orElseThrow());
                produtoCarregado.countDown();
                aguardar(movimentacaoConcluida);
                respostaEdicao.set(produtoService.atualizar(id, edicaoDto(), null, request()));
            }));
            Future<EstoqueMovimentacaoResponseDTO> movimentacao = executor.submit(() -> {
                aguardar(produtoCarregado);
                try {
                    return movimentar(id, tipo);
                } finally {
                    movimentacaoConcluida.countDown();
                }
            });

            EstoqueMovimentacaoResponseDTO registro = movimentacao.get(15, TimeUnit.SECONDS);
            edicao.get(15, TimeUnit.SECONDS);

            BigDecimal esperado = tipo == TipoMovimentacaoEstoque.ENTRADA
                    || tipo == TipoMovimentacaoEstoque.AJUSTE_POSITIVO
                    ? new BigDecimal("13.000") : new BigDecimal("7.000");
            assertSaldoEMovimentacao(id, tipo, esperado, registro);
            assertEquals("Produto cadastral editado", nomeNoBanco(id));
            assertDecimal(esperado, respostaEdicao.get().estoqueAtual());
        } finally {
            movimentacaoConcluida.countDown();
            executor.shutdownNow();
            assertTrue(executor.awaitTermination(5, TimeUnit.SECONDS));
        }
    }

    @Test
    void movimentacaoAposEdicaoTambemPreservaSaldoENome() throws Exception {
        Long id = criarProdutoComSaldoDez();
        CountDownLatch edicaoConcluida = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<?> edicao = executor.submit(() -> {
                try {
                    produtoService.atualizar(id, edicaoDto(), null, request());
                } finally {
                    edicaoConcluida.countDown();
                }
            });
            Future<EstoqueMovimentacaoResponseDTO> saida = executor.submit(() -> {
                aguardar(edicaoConcluida);
                return movimentar(id, TipoMovimentacaoEstoque.SAIDA);
            });
            edicao.get(15, TimeUnit.SECONDS);
            EstoqueMovimentacaoResponseDTO registro = saida.get(15, TimeUnit.SECONDS);
            assertSaldoEMovimentacao(id, TipoMovimentacaoEstoque.SAIDA, new BigDecimal("7.000"), registro);
            assertEquals("Produto cadastral editado", nomeNoBanco(id));
        } finally {
            edicaoConcluida.countDown();
            executor.shutdownNow();
            assertTrue(executor.awaitTermination(5, TimeUnit.SECONDS));
        }
    }

    @Test
    void alteracaoDeStatusObsoletaNaoRestauraEstoque() throws Exception {
        Long id = criarProdutoComSaldoDez();
        CountDownLatch carregado = new CountDownLatch(1);
        CountDownLatch saidaConcluida = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<?> status = executor.submit(() -> transactionTemplate.executeWithoutResult(tx -> {
                assertNotNull(produtoRepository.findById(id).orElseThrow());
                carregado.countDown();
                aguardar(saidaConcluida);
                ProdutoResponseDTO resposta = produtoService.alterarStatus(id, false, null, request());
                assertDecimal(new BigDecimal("7.000"), resposta.estoqueAtual());
            }));
            Future<EstoqueMovimentacaoResponseDTO> saida = executor.submit(() -> {
                aguardar(carregado);
                try {
                    return movimentar(id, TipoMovimentacaoEstoque.SAIDA);
                } finally {
                    saidaConcluida.countDown();
                }
            });
            EstoqueMovimentacaoResponseDTO registro = saida.get(15, TimeUnit.SECONDS);
            status.get(15, TimeUnit.SECONDS);
            assertSaldoEMovimentacao(id, TipoMovimentacaoEstoque.SAIDA, new BigDecimal("7.000"), registro);
            assertEquals(Boolean.FALSE, jdbcTemplate.queryForObject(
                    "SELECT ativo FROM produtos WHERE id = ?", Boolean.class, id));
        } finally {
            saidaConcluida.countDown();
            executor.shutdownNow();
            assertTrue(executor.awaitTermination(5, TimeUnit.SECONDS));
        }
    }

    @Test
    void cadastroAindaRegistraEstoqueInicial() {
        ProdutoCreateDTO dto = new ProdutoCreateDTO(null, null, "Inicial B01", null, null,
                TipoProduto.PECA, "UN", new BigDecimal("5.00"), new BigDecimal("10.00"),
                BigDecimal.ZERO, DEZ, null, null, null);
        ProdutoResponseDTO resposta = produtoService.cadastrar(dto, null, request());
        produtoIds.add(resposta.id());

        assertDecimal(DEZ, saldoNoBanco(resposta.id()));
        assertEquals(1, jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM estoque_movimentacoes WHERE produto_id = ? AND tipo_movimentacao = 'ENTRADA'",
                Integer.class, resposta.id()));
        assertDecimal(BigDecimal.ZERO, jdbcTemplate.queryForObject(
                "SELECT quantidade_anterior FROM estoque_movimentacoes WHERE produto_id = ?",
                BigDecimal.class, resposta.id()));
        assertDecimal(DEZ, jdbcTemplate.queryForObject(
                "SELECT quantidade_posterior FROM estoque_movimentacoes WHERE produto_id = ?",
                BigDecimal.class, resposta.id()));
    }

    private Long criarProdutoComSaldoDez() {
        Long id = transactionTemplate.execute(tx -> {
            Produto produto = new Produto();
            produto.setCodigo("B01-" + UUID.randomUUID());
            produto.setNome("Produto B01 original");
            produto.setTipo(TipoProduto.PECA);
            produto.setPrecoCusto(new BigDecimal("5.00"));
            produto.setPrecoVenda(new BigDecimal("10.00"));
            produto.setEstoqueAtual(DEZ);
            return produtoRepository.saveAndFlush(produto).getId();
        });
        produtoIds.add(id);
        return id;
    }

    private ProdutoUpdateDTO edicaoDto() {
        return new ProdutoUpdateDTO(null, "https://example.invalid/produto", "Produto cadastral editado",
                "Descrição editada", "Marca editada", TipoProduto.PECA, "UN",
                new BigDecimal("5.00"), new BigDecimal("10.00"), new BigDecimal("2.000"),
                "Prateleira B01", null, null);
    }

    private EstoqueMovimentacaoResponseDTO movimentar(Long id, TipoMovimentacaoEstoque tipo) {
        return estoqueService.registrarMovimentacaoManual(
                new MovimentacaoManualDTO(id, tipo, TRES, null, "Concorrência B01"), null, request());
    }

    private void assertSaldoEMovimentacao(Long id, TipoMovimentacaoEstoque tipo,
                                           BigDecimal esperado, EstoqueMovimentacaoResponseDTO registro) {
        assertDecimal(DEZ, registro.quantidadeAnterior());
        assertDecimal(esperado, registro.quantidadePosterior());
        assertDecimal(esperado, saldoNoBanco(id));
        assertEquals(tipo.name(), jdbcTemplate.queryForObject(
                "SELECT tipo_movimentacao FROM estoque_movimentacoes WHERE id = ?", String.class, registro.id()));
        assertDecimal(DEZ, jdbcTemplate.queryForObject(
                "SELECT quantidade_anterior FROM estoque_movimentacoes WHERE id = ?", BigDecimal.class, registro.id()));
        assertDecimal(esperado, jdbcTemplate.queryForObject(
                "SELECT quantidade_posterior FROM estoque_movimentacoes WHERE id = ?", BigDecimal.class, registro.id()));
    }

    private BigDecimal saldoNoBanco(Long id) {
        return jdbcTemplate.queryForObject("SELECT estoque_atual FROM produtos WHERE id = ?", BigDecimal.class, id);
    }

    private String nomeNoBanco(Long id) {
        return jdbcTemplate.queryForObject("SELECT nome FROM produtos WHERE id = ?", String.class, id);
    }

    private static void assertDecimal(BigDecimal esperado, BigDecimal atual) {
        assertEquals(0, esperado.compareTo(atual), () -> "Esperado " + esperado + ", atual " + atual);
    }

    private static void aguardar(CountDownLatch latch) {
        try {
            assertTrue(latch.await(10, TimeUnit.SECONDS), "Operação concorrente não concluiu a tempo");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Teste concorrente interrompido", e);
        }
    }

    private static MockHttpServletRequest request() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("198.51.100.251");
        return request;
    }
}
