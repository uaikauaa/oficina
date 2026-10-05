package com.oficinagestao.service;

import com.oficinagestao.dto.OrdemServicoItemCreateDTO;
import com.oficinagestao.dto.OrdemServicoStatusDTO;
import com.oficinagestao.entity.Cliente;
import com.oficinagestao.entity.Maquina;
import com.oficinagestao.entity.OrdemServico;
import com.oficinagestao.entity.OrdemServicoItem;
import com.oficinagestao.entity.Produto;
import com.oficinagestao.entity.StatusOrdemServico;
import com.oficinagestao.entity.TipoEquipamento;
import com.oficinagestao.entity.TipoItemOrdemServico;
import com.oficinagestao.entity.TipoPessoa;
import com.oficinagestao.entity.TipoProduto;
import com.oficinagestao.exception.BusinessException;
import com.oficinagestao.exception.ResourceNotFoundException;
import com.oficinagestao.repository.ClienteRepository;
import com.oficinagestao.repository.MaquinaRepository;
import com.oficinagestao.repository.OrdemServicoItemRepository;
import com.oficinagestao.repository.OrdemServicoRepository;
import com.oficinagestao.repository.ProdutoRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@ActiveProfiles("test")
class OrdemServicoConcurrencyIntegrationTest {

    private static final BigDecimal PRECO = new BigDecimal("10.00");

    @Autowired
    private OrdemServicoService ordemServicoService;

    @Autowired
    private OrdemServicoItemService ordemServicoItemService;

    @Autowired
    private ClienteRepository clienteRepository;

    @Autowired
    private MaquinaRepository maquinaRepository;

    @Autowired
    private ProdutoRepository produtoRepository;

    @Autowired
    private OrdemServicoRepository ordemServicoRepository;

    @Autowired
    private OrdemServicoItemRepository ordemServicoItemRepository;

    @Autowired
    private TransactionTemplate transactionTemplate;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private final List<TestData> testData = new ArrayList<>();

    @AfterEach
    void tearDown() {
        List<TestData> reverse = new ArrayList<>(testData);
        Collections.reverse(reverse);
        for (TestData data : reverse) {
            jdbcTemplate.update("DELETE FROM auditoria WHERE ip_origem = ?", data.ip());
            for (Long produtoId : data.produtoIds()) {
                jdbcTemplate.update("DELETE FROM notificacoes WHERE chave_unica = ?", "ESTOQUE_BAIXO_" + produtoId);
            }
            for (Long osId : data.osIds()) {
                jdbcTemplate.update("DELETE FROM estoque_movimentacoes WHERE ordem_servico_id = ?", osId);
                jdbcTemplate.update("DELETE FROM ordem_servico_itens WHERE ordem_servico_id = ?", osId);
                jdbcTemplate.update("DELETE FROM ordens_servico WHERE id = ?", osId);
            }
            for (Long produtoId : data.produtoIds()) {
                jdbcTemplate.update("DELETE FROM produtos WHERE id = ?", produtoId);
            }
            jdbcTemplate.update("DELETE FROM maquinas WHERE id = ?", data.maquinaId());
            jdbcTemplate.update("DELETE FROM clientes WHERE id = ?", data.clienteId());
        }
        testData.clear();
    }

    @Test
    void cancelarERemoverMesmoItemDevolvemEstoqueUmaVez() throws Exception {
        Fixture fixture = createFixture(StatusOrdemServico.EM_MANUTENCAO, new BigDecimal("8.000"), new BigDecimal("2.000"));

        List<Outcome> outcomes = race(
                () -> ordemServicoService.alterarStatus(
                        fixture.osId(), new OrdemServicoStatusDTO(StatusOrdemServico.CANCELADA, null, "NEW-01"), null, fixture.ip()),
                () -> ordemServicoItemService.removerItem(
                        fixture.osId(), fixture.itemId(), null, request(fixture.ip()))
        );

        assertNoInfrastructureFailure(outcomes);
        assertEquals("CANCELADA", status(fixture.osId()));
        assertDecimal("10.000", estoque(fixture.produtoId()));
        assertEquals(1, countMovimentacoes(fixture.osId(), "DEVOLUCAO"));
        assertTrue(countItens(fixture.osId()) == 0 || countItens(fixture.osId()) == 1);
    }

    @Test
    void cancelarEAdicionarMantemOsEEstoqueConsistentes() throws Exception {
        Fixture fixture = createFixture(StatusOrdemServico.EM_MANUTENCAO, new BigDecimal("8.000"), new BigDecimal("2.000"));
        OrdemServicoItemCreateDTO dto = new OrdemServicoItemCreateDTO(
                fixture.produtoId(), BigDecimal.ONE, BigDecimal.ZERO, "NEW-01 concorrente");

        List<Outcome> outcomes = race(
                () -> ordemServicoService.alterarStatus(
                        fixture.osId(), new OrdemServicoStatusDTO(StatusOrdemServico.CANCELADA, null, "NEW-01"), null, fixture.ip()),
                () -> ordemServicoItemService.adicionarPeca(fixture.osId(), dto, null, request(fixture.ip()))
        );

        assertNoInfrastructureFailure(outcomes);
        assertEquals("CANCELADA", status(fixture.osId()));
        assertDecimal("10.000", estoque(fixture.produtoId()));
        assertEquals(1, countMovimentacoes(fixture.osId(), "DEVOLUCAO"));
        assertTrue(countItens(fixture.osId()) == 1 || countItens(fixture.osId()) == 2);
        assertFrozenPrices(fixture.osId());
    }

    @Test
    void duasRemocoesDoMesmoItemDevolvemUmaVez() throws Exception {
        Fixture fixture = createFixture(StatusOrdemServico.EM_MANUTENCAO, new BigDecimal("8.000"), new BigDecimal("2.000"));

        List<Outcome> outcomes = race(
                () -> ordemServicoItemService.removerItem(fixture.osId(), fixture.itemId(), null, request(fixture.ip())),
                () -> ordemServicoItemService.removerItem(fixture.osId(), fixture.itemId(), null, request(fixture.ip()))
        );

        assertNoInfrastructureFailure(outcomes);
        assertEquals(1, outcomes.stream().filter(Outcome::success).count());
        assertEquals(0, countItens(fixture.osId()));
        assertDecimal("10.000", estoque(fixture.produtoId()));
        assertEquals(1, countMovimentacoes(fixture.osId(), "DEVOLUCAO"));
    }

    @Test
    void duasAdicoesNoEstoqueLimiteNuncaDeixamSaldoNegativo() throws Exception {
        Fixture fixture = createFixture(StatusOrdemServico.EM_MANUTENCAO, BigDecimal.ONE, null);
        OrdemServicoItemCreateDTO dto = new OrdemServicoItemCreateDTO(
                fixture.produtoId(), BigDecimal.ONE, BigDecimal.ZERO, "NEW-01 estoque limite");

        List<Outcome> outcomes = race(
                () -> ordemServicoItemService.adicionarPeca(fixture.osId(), dto, null, request(fixture.ip())),
                () -> ordemServicoItemService.adicionarPeca(fixture.osId(), dto, null, request(fixture.ip()))
        );

        assertNoInfrastructureFailure(outcomes);
        assertEquals(1, outcomes.stream().filter(Outcome::success).count());
        assertDecimal("0.000", estoque(fixture.produtoId()));
        assertEquals(1, countItens(fixture.osId()));
        assertEquals(1, countMovimentacoes(fixture.osId(), "SAIDA"));
        assertFrozenPrices(fixture.osId());
    }

    @Test
    void conclusaoEAdicaoNuncaInseremItemDepoisDoEstadoTerminal() throws Exception {
        Fixture fixture = createFixture(StatusOrdemServico.PRONTA, BigDecimal.ONE, null);
        OrdemServicoItemCreateDTO dto = new OrdemServicoItemCreateDTO(
                fixture.produtoId(), BigDecimal.ONE, BigDecimal.ZERO, "NEW-01 terminal");

        List<Outcome> outcomes = race(
                () -> ordemServicoService.alterarStatus(
                        fixture.osId(), new OrdemServicoStatusDTO(StatusOrdemServico.CONCLUIDA, null, "NEW-01"), null, fixture.ip()),
                () -> ordemServicoItemService.adicionarPeca(fixture.osId(), dto, null, request(fixture.ip()))
        );

        assertNoInfrastructureFailure(outcomes);
        assertEquals("CONCLUIDA", status(fixture.osId()));
        int itens = countItens(fixture.osId());
        assertTrue(itens == 0 || itens == 1);
        assertDecimal(itens == 0 ? "1.000" : "0.000", estoque(fixture.produtoId()));
        assertEquals(itens, countMovimentacoes(fixture.osId(), "SAIDA"));
    }

    @Test
    void cancelamentosComMultiplosProdutosUsamOrdemDeLockSemDeadlock() throws Exception {
        MultiFixture fixture = createMultiFixture();

        List<Outcome> outcomes = race(
                () -> ordemServicoService.alterarStatus(
                        fixture.osIds().get(0), new OrdemServicoStatusDTO(StatusOrdemServico.CANCELADA, null, "NEW-01-A"), null, fixture.ip()),
                () -> ordemServicoService.alterarStatus(
                        fixture.osIds().get(1), new OrdemServicoStatusDTO(StatusOrdemServico.CANCELADA, null, "NEW-01-B"), null, fixture.ip())
        );

        assertTrue(outcomes.stream().allMatch(Outcome::success), () -> "Cancelamentos não podem falhar: " + outcomes);
        for (Long osId : fixture.osIds()) {
            assertEquals("CANCELADA", status(osId));
            assertEquals(2, countMovimentacoes(osId, "DEVOLUCAO"));
        }
        for (Long produtoId : fixture.produtoIds()) {
            assertDecimal("10.000", estoque(produtoId));
        }
    }

    private Fixture createFixture(StatusOrdemServico status, BigDecimal estoqueAtual, BigDecimal itemQuantidade) {
        String token = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        String ip = "198.51.100." + (10 + testData.size());
        Fixture fixture = transactionTemplate.execute(tx -> {
            Cliente cliente = new Cliente();
            cliente.setTipoPessoa(TipoPessoa.FISICA);
            cliente.setNomeRazaoSocial("Cliente NEW-01 " + token);
            cliente.setCpfCnpj("N01" + token);
            cliente = clienteRepository.save(cliente);

            Maquina maquina = new Maquina();
            maquina.setCliente(cliente);
            maquina.setTipoEquipamento(TipoEquipamento.MAQUINA_SOLDA);
            maquina.setMarca("Teste");
            maquina.setModelo("Concorrencia " + token);
            maquina.setNumeroSerie("N01-M-" + token);
            maquina = maquinaRepository.save(maquina);

            Produto produto = produto(token, estoqueAtual);
            produto = produtoRepository.save(produto);

            OrdemServico os = ordemServico(cliente, maquina, "OS-N01-" + token, status);
            os = ordemServicoRepository.save(os);

            Long itemId = null;
            if (itemQuantidade != null) {
                OrdemServicoItem item = item(os, produto, itemQuantidade);
                itemId = ordemServicoItemRepository.save(item).getId();
                os.setValorPecas(PRECO.multiply(itemQuantidade));
                os.recalcularTotal();
                ordemServicoRepository.save(os);
            }
            return new Fixture(cliente.getId(), maquina.getId(), produto.getId(), os.getId(), itemId, ip);
        });
        testData.add(new TestData(fixture.clienteId(), fixture.maquinaId(), List.of(fixture.produtoId()), List.of(fixture.osId()), ip));
        return fixture;
    }

    private MultiFixture createMultiFixture() {
        String token = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        String ip = "198.51.100.200";
        MultiFixture fixture = transactionTemplate.execute(tx -> {
            Cliente cliente = new Cliente();
            cliente.setTipoPessoa(TipoPessoa.FISICA);
            cliente.setNomeRazaoSocial("Cliente NEW-01 multi " + token);
            cliente.setCpfCnpj("M01" + token);
            cliente = clienteRepository.save(cliente);

            Maquina maquina = new Maquina();
            maquina.setCliente(cliente);
            maquina.setTipoEquipamento(TipoEquipamento.MAQUINA_SOLDA);
            maquina.setMarca("Teste");
            maquina.setModelo("Multi " + token);
            maquina = maquinaRepository.save(maquina);

            Produto p1 = produto(token + "A", new BigDecimal("8.000"));
            Produto p2 = produto(token + "B", new BigDecimal("8.000"));
            p1 = produtoRepository.save(p1);
            p2 = produtoRepository.save(p2);

            OrdemServico os1 = ordemServico(cliente, maquina, "OS-N1-" + token, StatusOrdemServico.EM_MANUTENCAO);
            OrdemServico os2 = ordemServico(cliente, maquina, "OS-N2-" + token, StatusOrdemServico.EM_MANUTENCAO);
            os1 = ordemServicoRepository.save(os1);
            os2 = ordemServicoRepository.save(os2);

            ordemServicoItemRepository.save(item(os1, p1, BigDecimal.ONE));
            ordemServicoItemRepository.save(item(os1, p2, BigDecimal.ONE));
            ordemServicoItemRepository.save(item(os2, p2, BigDecimal.ONE));
            ordemServicoItemRepository.save(item(os2, p1, BigDecimal.ONE));

            return new MultiFixture(
                    cliente.getId(), maquina.getId(), List.of(p1.getId(), p2.getId()), List.of(os1.getId(), os2.getId()), ip);
        });
        testData.add(new TestData(fixture.clienteId(), fixture.maquinaId(), fixture.produtoIds(), fixture.osIds(), ip));
        return fixture;
    }

    private Produto produto(String token, BigDecimal estoqueAtual) {
        Produto produto = new Produto();
        produto.setCodigo("N01-" + token);
        produto.setNome("Produto NEW-01 " + token);
        produto.setTipo(TipoProduto.PECA);
        produto.setPrecoCusto(new BigDecimal("5.00"));
        produto.setPrecoVenda(PRECO);
        produto.setEstoqueAtual(estoqueAtual);
        produto.setEstoqueMinimo(BigDecimal.ZERO);
        produto.setAtivo(true);
        return produto;
    }

    private OrdemServico ordemServico(Cliente cliente, Maquina maquina, String numero, StatusOrdemServico status) {
        OrdemServico os = new OrdemServico();
        os.setNumeroOs(numero);
        os.setCliente(cliente);
        os.setMaquina(maquina);
        os.setStatus(status);
        os.setProblemaRelatado("Teste sintético NEW-01");
        if (status == StatusOrdemServico.PRONTA) {
            os.setTestesRealizados("Testes sintéticos concluídos com sucesso");
        }
        return os;
    }

    private OrdemServicoItem item(OrdemServico os, Produto produto, BigDecimal quantidade) {
        return new OrdemServicoItem(
                os,
                produto,
                TipoItemOrdemServico.PECA,
                quantidade,
                PRECO,
                BigDecimal.ZERO,
                PRECO.multiply(quantidade),
                "Item sintético NEW-01"
        );
    }

    private List<Outcome> race(ThrowingRunnable first, ThrowingRunnable second) throws Exception {
        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        try {
            Future<Outcome> left = executor.submit(() -> runWhenReleased(first, ready, start));
            Future<Outcome> right = executor.submit(() -> runWhenReleased(second, ready, start));
            assertTrue(ready.await(5, TimeUnit.SECONDS), "As duas operações devem estar prontas");
            start.countDown();
            return List.of(left.get(15, TimeUnit.SECONDS), right.get(15, TimeUnit.SECONDS));
        } finally {
            executor.shutdownNow();
            assertTrue(executor.awaitTermination(5, TimeUnit.SECONDS), "Executor deve encerrar sem thread presa");
        }
    }

    private Outcome runWhenReleased(ThrowingRunnable action, CountDownLatch ready, CountDownLatch start) {
        ready.countDown();
        try {
            start.await();
            action.run();
            return new Outcome(true, null);
        } catch (Throwable error) {
            return new Outcome(false, error);
        }
    }

    private void assertNoInfrastructureFailure(List<Outcome> outcomes) {
        for (Outcome outcome : outcomes) {
            if (!outcome.success()) {
                assertTrue(
                        outcome.error() instanceof BusinessException || outcome.error() instanceof ResourceNotFoundException,
                        () -> "A operação perdedora deve falhar por regra de negócio, não por infraestrutura: " + outcome.error()
                );
            }
        }
    }

    private MockHttpServletRequest request(String ip) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr(ip);
        return request;
    }

    private String status(Long osId) {
        return jdbcTemplate.queryForObject("SELECT status FROM ordens_servico WHERE id = ?", String.class, osId);
    }

    private BigDecimal estoque(Long produtoId) {
        return jdbcTemplate.queryForObject("SELECT estoque_atual FROM produtos WHERE id = ?", BigDecimal.class, produtoId);
    }

    private int countItens(Long osId) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM ordem_servico_itens WHERE ordem_servico_id = ?", Integer.class, osId);
    }

    private int countMovimentacoes(Long osId, String tipo) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM estoque_movimentacoes WHERE ordem_servico_id = ? AND tipo_movimentacao = ?",
                Integer.class,
                osId,
                tipo
        );
    }

    private void assertFrozenPrices(Long osId) {
        List<BigDecimal> prices = jdbcTemplate.queryForList(
                "SELECT valor_unitario FROM ordem_servico_itens WHERE ordem_servico_id = ?", BigDecimal.class, osId);
        assertFalse(prices.isEmpty());
        assertTrue(prices.stream().allMatch(price -> price.compareTo(PRECO) == 0));
    }

    private void assertDecimal(String expected, BigDecimal actual) {
        assertEquals(0, new BigDecimal(expected).compareTo(actual), () -> "Esperado " + expected + ", atual " + actual);
    }

    @FunctionalInterface
    private interface ThrowingRunnable {
        void run() throws Exception;
    }

    private record Outcome(boolean success, Throwable error) {
    }

    private record Fixture(Long clienteId, Long maquinaId, Long produtoId, Long osId, Long itemId, String ip) {
    }

    private record MultiFixture(Long clienteId, Long maquinaId, List<Long> produtoIds, List<Long> osIds, String ip) {
    }

    private record TestData(Long clienteId, Long maquinaId, List<Long> produtoIds, List<Long> osIds, String ip) {
    }
}
