package com.oficinagestao.service;

import com.oficinagestao.entity.Cliente;
import com.oficinagestao.entity.Maquina;
import com.oficinagestao.entity.OrdemServico;
import com.oficinagestao.entity.OrdemServicoItem;
import com.oficinagestao.entity.Produto;
import com.oficinagestao.entity.StatusOrdemServico;
import com.oficinagestao.entity.TipoEquipamento;
import com.oficinagestao.entity.TipoItemOrdemServico;
import com.oficinagestao.entity.TipoPessoa;
import com.oficinagestao.repository.ClienteRepository;
import com.oficinagestao.repository.MaquinaRepository;
import com.oficinagestao.repository.OrdemServicoItemRepository;
import com.oficinagestao.repository.OrdemServicoRepository;
import com.oficinagestao.repository.ProdutoRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Pageable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class RelatorioRegressionIntegrationTest {

    @Autowired private RelatorioService relatorioService;
    @Autowired private ClienteRepository clienteRepository;
    @Autowired private MaquinaRepository maquinaRepository;
    @Autowired private OrdemServicoRepository ordemServicoRepository;
    @Autowired private OrdemServicoItemRepository itemRepository;
    @Autowired private ProdutoRepository produtoRepository;
    @Autowired private EntityManager entityManager;
    @Autowired private JdbcTemplate jdbc;

    private final String fixtureId = UUID.randomUUID().toString().substring(0, 8);

    private Maquina novaMaquina() {
        Cliente cliente = clienteRepository.saveAndFlush(new Cliente(TipoPessoa.FISICA,
                "RelatorioQA-" + fixtureId, null, null, null, null, null, null, null));
        Maquina maquina = new Maquina();
        maquina.setCliente(cliente);
        maquina.setTipoEquipamento(TipoEquipamento.MAQUINA_SOLDA);
        maquina.setMarca("QA");
        maquina.setModelo("QA");
        return maquinaRepository.saveAndFlush(maquina);
    }

    private OrdemServico novaOrdem(Maquina maquina, StatusOrdemServico status,
                                   OffsetDateTime data, String suffix, String valor) {
        OrdemServico os = new OrdemServico();
        os.setNumeroOs("RELQA-" + fixtureId + "-" + suffix);
        os.setCliente(maquina.getCliente());
        os.setMaquina(maquina);
        os.setStatus(status);
        os.setDataEntrada(data);
        os.setProblemaRelatado("Teste de relatorio");
        os.setValorMaoObra(new BigDecimal(valor));
        return ordemServicoRepository.saveAndFlush(os);
    }

    private Produto novoProduto(String suffix) {
        Produto produto = new Produto();
        produto.setCodigo("RELQA-" + fixtureId + "-" + suffix);
        produto.setNome("Produto QA " + suffix);
        return produtoRepository.saveAndFlush(produto);
    }

    private void novoItem(OrdemServico os, Produto produto, String quantidade) {
        BigDecimal qtd = new BigDecimal(quantidade);
        itemRepository.saveAndFlush(new OrdemServicoItem(os, produto, TipoItemOrdemServico.PECA,
                qtd, BigDecimal.ONE, BigDecimal.ZERO, qtd, null));
    }

    @Test
    void aReceberRespeitaStatusEPeriodoComoAListagem() {
        Maquina maquina = novaMaquina();
        OffsetDateTime dia = OffsetDateTime.parse("2099-04-10T12:00:00Z");
        novaOrdem(maquina, StatusOrdemServico.ABERTA, dia, "A", "100.00");
        novaOrdem(maquina, StatusOrdemServico.EM_DIAGNOSTICO, dia, "B", "200.00");
        novaOrdem(maquina, StatusOrdemServico.CONCLUIDA, dia, "D", "500.00");
        novaOrdem(maquina, StatusOrdemServico.CANCELADA, dia, "E", "600.00");
        novaOrdem(maquina, StatusOrdemServico.ABERTA, dia.plusDays(10), "C", "400.00");
        entityManager.flush();
        entityManager.clear();
        OffsetDateTime inicio = dia.minusDays(1);
        OffsetDateTime fim = dia.plusDays(1);

        var abertas = relatorioService.obterRelatorioOsPorPeriodo(inicio, fim, StatusOrdemServico.ABERTA, Pageable.unpaged());
        assertEquals(1, abertas.itens().getTotalElements());
        assertEquals(1, abertas.resumo().totalOs());
        assertEquals(0, new BigDecimal("100.00").compareTo(abertas.resumo().valorTotalAReceber()));

        var diagnostico = relatorioService.obterRelatorioOsPorPeriodo(inicio, fim, StatusOrdemServico.EM_DIAGNOSTICO, Pageable.unpaged());
        assertEquals(1, diagnostico.itens().getTotalElements());
        assertEquals(1, diagnostico.resumo().totalOs());
        assertEquals(0, new BigDecimal("200.00").compareTo(diagnostico.resumo().valorTotalAReceber()));

        var todos = relatorioService.obterRelatorioOsPorPeriodo(inicio, fim, null, Pageable.unpaged());
        assertEquals(4, todos.itens().getTotalElements());
        assertEquals(4, todos.resumo().totalOs());
        assertEquals(0, new BigDecimal("300.00").compareTo(todos.resumo().valorTotalAReceber()));

        var concluidas = relatorioService.obterRelatorioOsPorPeriodo(inicio, fim, StatusOrdemServico.CONCLUIDA, Pageable.unpaged());
        assertEquals(1, concluidas.itens().getTotalElements());
        assertEquals(0, BigDecimal.ZERO.compareTo(concluidas.resumo().valorTotalAReceber()));

        var canceladas = relatorioService.obterRelatorioOsPorPeriodo(inicio, fim, StatusOrdemServico.CANCELADA, Pageable.unpaged());
        assertEquals(1, canceladas.itens().getTotalElements());
        assertEquals(0, BigDecimal.ZERO.compareTo(canceladas.resumo().valorTotalAReceber()));

        var foraPeriodo = relatorioService.obterRelatorioOsPorPeriodo(dia.plusDays(9), dia.plusDays(11), StatusOrdemServico.ABERTA, Pageable.unpaged());
        assertEquals(1, foraPeriodo.itens().getTotalElements());
        assertEquals(0, new BigDecimal("400.00").compareTo(foraPeriodo.resumo().valorTotalAReceber()));
    }

    @Test
    void rankingIgnoraOsCanceladaMasPreservaSeuItemHistorico() {
        Maquina maquina = novaMaquina();
        Produto produto = novoProduto("MISTO");
        OffsetDateTime dia = OffsetDateTime.parse("2099-05-10T12:00:00Z");
        OrdemServico ativa = novaOrdem(maquina, StatusOrdemServico.EM_MANUTENCAO, dia, "ATIVA", "0.00");
        OrdemServico cancelada = novaOrdem(maquina, StatusOrdemServico.CANCELADA, dia, "CANCELADA", "0.00");
        novoItem(ativa, produto, "3.000");
        novoItem(cancelada, produto, "2.000");
        entityManager.flush();
        entityManager.clear();

        var item = relatorioService.obterPecasMaisUtilizadas(Pageable.unpaged()).getContent().stream()
                .filter(p -> p.produtoId().equals(produto.getId())).findFirst().orElseThrow();
        assertEquals(0, new BigDecimal("3.000").compareTo(item.quantidadeTotalUtilizada()));
        assertEquals(1L, item.quantidadeOs());
        assertEquals(1, itemRepository.findByOrdemServicoIdComProduto(cancelada.getId()).size());
        assertEquals(1, jdbc.queryForObject("select count(*) from ordem_servico_itens where ordem_servico_id = ?", Integer.class, cancelada.getId()));
    }

    @Test
    void produtoSomenteEmOsCanceladaNaoApareceNoRanking() {
        Maquina maquina = novaMaquina();
        Produto produto = novoProduto("SOMENTE-CANCELADA");
        OrdemServico cancelada = novaOrdem(maquina, StatusOrdemServico.CANCELADA,
                OffsetDateTime.parse("2099-06-10T12:00:00Z"), "CANCELADA", "0.00");
        novoItem(cancelada, produto, "2.000");
        entityManager.flush();
        entityManager.clear();

        assertTrue(relatorioService.obterPecasMaisUtilizadas(Pageable.unpaged()).getContent().stream()
                .noneMatch(p -> p.produtoId().equals(produto.getId())));
        assertEquals(1, itemRepository.findByOrdemServicoIdComProduto(cancelada.getId()).size());
    }
}
