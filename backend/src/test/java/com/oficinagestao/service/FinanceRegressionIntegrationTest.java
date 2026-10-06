package com.oficinagestao.service;

import com.lowagie.text.pdf.PdfReader;
import com.lowagie.text.pdf.parser.PdfTextExtractor;
import com.oficinagestao.dto.OrdemServicoUpdateDTO;
import com.oficinagestao.dto.ProdutoCreateDTO;
import com.oficinagestao.dto.ProdutoUpdateDTO;
import com.oficinagestao.entity.Cliente;
import com.oficinagestao.entity.Maquina;
import com.oficinagestao.entity.OrdemServico;
import com.oficinagestao.entity.TipoEquipamento;
import com.oficinagestao.entity.TipoPessoa;
import com.oficinagestao.entity.TipoProduto;
import com.oficinagestao.exception.BusinessException;
import com.oficinagestao.repository.ClienteRepository;
import com.oficinagestao.repository.MaquinaRepository;
import com.oficinagestao.repository.OrdemServicoRepository;
import com.oficinagestao.repository.ProdutoRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class FinanceRegressionIntegrationTest {

    @Autowired private ProdutoService produtoService;
    @Autowired private ProdutoRepository produtoRepository;
    @Autowired private OrdemServicoService ordemServicoService;
    @Autowired private OrdemServicoRepository ordemServicoRepository;
    @Autowired private ClienteRepository clienteRepository;
    @Autowired private MaquinaRepository maquinaRepository;
    @Autowired private EntityManager entityManager;

    private BigDecimal money(String value) {
        return new BigDecimal(value);
    }

    private ProdutoCreateDTO novoProduto(String custo, String venda) {
        return new ProdutoCreateDTO(null, null, "FinanceQA", null, null, TipoProduto.PECA, "UN",
                money(custo), money(venda), BigDecimal.ZERO, BigDecimal.ZERO, null, null, null);
    }

    private ProdutoUpdateDTO atualizarProduto(String custo, String venda) {
        return new ProdutoUpdateDTO(null, null, "FinanceQA", null, null, TipoProduto.PECA, "UN",
                money(custo), money(venda), BigDecimal.ZERO, null, null, null);
    }

    private OrdemServico novaOs(String maoObra, String pecas, String desconto) {
        String id = UUID.randomUUID().toString().substring(0, 8);
        Cliente cliente = clienteRepository.saveAndFlush(new Cliente(TipoPessoa.FISICA,
                "FinanceQA-" + id, null, null, null, null, null, null, null));
        Maquina maquina = new Maquina();
        maquina.setCliente(cliente);
        maquina.setTipoEquipamento(TipoEquipamento.MAQUINA_SOLDA);
        maquina.setMarca("QA");
        maquina.setModelo("QA");
        maquina = maquinaRepository.saveAndFlush(maquina);
        OrdemServico os = new OrdemServico();
        os.setNumeroOs("FINQA-" + id);
        os.setCliente(cliente);
        os.setMaquina(maquina);
        os.setProblemaRelatado("Teste financeiro");
        os.setValorMaoObra(money(maoObra));
        os.setValorPecas(money(pecas));
        os.setValorDesconto(money(desconto));
        return ordemServicoRepository.saveAndFlush(os);
    }

    private OrdemServicoUpdateDTO update(String maoObra, String pecas, String desconto) {
        return new OrdemServicoUpdateDTO(null, null, null, null, null, null,
                maoObra == null ? null : money(maoObra), pecas == null ? null : money(pecas),
                desconto == null ? null : money(desconto), null);
    }

    private OrdemServico reler(Long id) {
        entityManager.flush();
        entityManager.clear();
        return ordemServicoRepository.findById(id).orElseThrow();
    }

    private void assertMoney(String expected, BigDecimal actual) {
        assertEquals(0, money(expected).compareTo(actual));
    }

    @Test
    void margemGrandeComumEAtualizacaoPersistemCorretamente() {
        var produto = produtoService.cadastrar(novoProduto("0.01", "1.00"), null, new MockHttpServletRequest());
        entityManager.flush();
        entityManager.clear();
        assertMoney("9900.00", produtoRepository.findById(produto.id()).orElseThrow().getMargemLucro());

        produtoService.atualizar(produto.id(), atualizarProduto("100.00", "150.00"), null, new MockHttpServletRequest());
        entityManager.flush();
        entityManager.clear();
        assertMoney("50.00", produtoRepository.findById(produto.id()).orElseThrow().getMargemLucro());

        produtoService.atualizar(produto.id(), atualizarProduto("0.01", "9999999999.99"), null, new MockHttpServletRequest());
        entityManager.flush();
        entityManager.clear();
        assertMoney("99999999999800.00", produtoRepository.findById(produto.id()).orElseThrow().getMargemLucro());

        produtoService.atualizar(produto.id(), atualizarProduto("0.00", "1.00"), null, new MockHttpServletRequest());
        entityManager.flush();
        entityManager.clear();
        assertMoney("0", produtoRepository.findById(produto.id()).orElseThrow().getMargemLucro());
    }

    @Test
    void descontoParcialPreservaMaoDeObraERejeitaExcesso() {
        OrdemServico os = novaOs("100.00", "0.00", "0.00");
        ordemServicoService.atualizar(os.getId(), update(null, null, "10.00"), null, "127.0.0.1");
        OrdemServico salvo = reler(os.getId());
        assertMoney("100.00", salvo.getValorMaoObra());
        assertMoney("0.00", salvo.getValorPecas());
        assertMoney("10.00", salvo.getValorDesconto());
        assertMoney("90.00", salvo.getValorTotal());

        assertThrows(BusinessException.class, () ->
                ordemServicoService.atualizar(os.getId(), update(null, null, "100.01"), null, "127.0.0.1"));
    }

    @Test
    void updatesParciaisCombinadosECompletosUsamEstadoEfetivo() {
        OrdemServico os = novaOs("100.00", "25.25", "5.05");
        ordemServicoService.atualizar(os.getId(), update("110.00", null, null), null, "127.0.0.1");
        ordemServicoService.atualizar(os.getId(), update(null, null, "10.00"), null, "127.0.0.1");
        OrdemServico salvo = reler(os.getId());
        assertMoney("110.00", salvo.getValorMaoObra());
        assertMoney("25.25", salvo.getValorPecas());
        assertMoney("10.00", salvo.getValorDesconto());
        assertMoney("125.25", salvo.getValorTotal());

        ordemServicoService.atualizar(os.getId(), update("100.10", "25.25", "5.05"), null, "127.0.0.1");
        salvo = reler(os.getId());
        assertMoney("120.30", salvo.getValorTotal());
    }

    @ParameterizedTest
    @ValueSource(strings = {"0.001", "0.005", "0.009", "1.001", "1.999", "10.999"})
    void subcentavosSaoRejeitadosSemAlterarPersistencia(String valor) {
        OrdemServico os = novaOs("100.00", "0.00", "0.00");
        BusinessException erro = assertThrows(BusinessException.class, () ->
                ordemServicoService.atualizar(os.getId(), update(valor, null, null), null, "127.0.0.1"));
        assertTrue(erro.getMessage().contains("centavos"));
        entityManager.clear();
        OrdemServico salvo = ordemServicoRepository.findById(os.getId()).orElseThrow();
        assertMoney("100.00", salvo.getValorMaoObra());
        assertMoney("100.00", salvo.getValorTotal());
    }

    @Test
    void subcentavosEmPecasOuDescontoTambemSaoRejeitados() {
        OrdemServico os = novaOs("100.00", "0.00", "0.00");
        assertThrows(BusinessException.class, () ->
                ordemServicoService.atualizar(os.getId(), update(null, "0.005", null), null, "127.0.0.1"));
        entityManager.clear();
        assertThrows(BusinessException.class, () ->
                ordemServicoService.atualizar(os.getId(), update(null, null, "0.005"), null, "127.0.0.1"));
    }

    @Test
    void createComSubcentavosNaoPersiste() {
        OrdemServico os = novaOs("0.00", "0.00", "0.00");
        OrdemServico novo = new OrdemServico();
        novo.setNumeroOs("FINQA-INVALID-" + UUID.randomUUID().toString().substring(0, 8));
        novo.setCliente(os.getCliente());
        novo.setMaquina(os.getMaquina());
        novo.setProblemaRelatado("Teste financeiro");
        novo.setValorMaoObra(money("0.005"));
        novo.setValorPecas(money("0.005"));
        assertThrows(BusinessException.class, () -> ordemServicoRepository.saveAndFlush(novo));
    }

    @ParameterizedTest
    @CsvSource({"100.00,24.00,4.00,120.00", "0.00,10.10,0.10,10.00", "10.55,20.25,0.00,30.80",
            "100.000,0.01,0.00,100.01", "100.010,0.00,0.00,100.01",
            "1,0,0,1", "1.0,0,0,1", "1.00,0,0,1", "1.000,0,0,1"})
    void valoresValidosFechamAposReleitura(String maoObra, String pecas, String desconto, String esperado) {
        OrdemServico os = novaOs(maoObra, pecas, desconto);
        OrdemServico salvo = reler(os.getId());
        assertMoney(esperado, salvo.getValorTotal());
        assertEquals(0, salvo.getValorMaoObra().add(salvo.getValorPecas())
                .subtract(salvo.getValorDesconto()).compareTo(salvo.getValorTotal()));
    }

    @Test
    void pdfEApiExibemMesmoTotalPersistido() throws Exception {
        OrdemServico os = novaOs("100.10", "25.25", "5.05");
        OrdemServico salvo = reler(os.getId());
        assertMoney("120.30", salvo.getValorTotal());
        assertMoney("120.30", ordemServicoService.buscarPorId(os.getId()).valorTotal());
        try (PdfReader pdf = new PdfReader(ordemServicoService.gerarPdf(os.getId()))) {
            String texto = new PdfTextExtractor(pdf).getTextFromPage(1);
            assertTrue(texto.contains("120,30"));
        }
    }
}
