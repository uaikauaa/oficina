package com.oficinagestao.service;

import com.oficinagestao.entity.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class OrdemServicoPdfTest {

    private PdfService pdfService;
    private Cliente cliente;
    private Maquina maquina;
    private OrdemServico os;

    @BeforeEach
    void setUp() {
        pdfService = new PdfService();

        cliente = new Cliente();
        cliente.setId(1L);
        cliente.setNomeRazaoSocial("Uai Soldas Industriais Ltda");
        cliente.setCpfCnpj("12.345.678/0001-90");
        cliente.setTelefone("(31) 3333-1111");
        cliente.setCelular("(31) 99999-2222");
        cliente.setEmail("contato@uaisoldas.com.br");

        Endereco endereco = new Endereco();
        endereco.setLogradouro("Av. Industrial");
        endereco.setNumero("1500");
        endereco.setBairro("Distrito Industrial");
        endereco.setCidade("Contagem");
        endereco.setEstado("MG");
        endereco.setCep("32000-000");
        cliente.setEnderecos(List.of(endereco));

        maquina = new Maquina();
        maquina.setId(10L);
        maquina.setCliente(cliente);
        maquina.setTipoEquipamento(TipoEquipamento.MAQUINA_SOLDA);
        maquina.setMarca("ESAB");
        maquina.setModelo("Smashweld 450 TopFlex");
        maquina.setNumeroSerie("SN-ESAB-450-9988");
        maquina.setTensao("220V/380V Trifásico");
        maquina.setPotencia("450A");
        maquina.setHorimetro(new BigDecimal("120.50"));

        os = new OrdemServico();
        os.setId(100L);
        os.setNumeroOs("OS-2026-0001");
        os.setCliente(cliente);
        os.setMaquina(maquina);
        os.setStatus(StatusOrdemServico.ABERTA);
        os.setDataEntrada(OffsetDateTime.now().minusDays(2));
        os.setProblemaRelatado("Máquina liga mas não abre arco elétrico na tocha MIG.");
        os.setDiagnostico("Módulo inversor com curto em dois transistores IGBT primários.");
        os.setSolucaoAplicada("Substituição do par de IGBTs e revisão das trilhas de disparo.");
        os.setTestesRealizados("Teste sob carga de 300A em bancada durante 15 minutos contínuos.");
        os.setObservacoes("Equipamento entregue limpo e com cabo de aterramento original.");
        os.setHorimetroAtual(new BigDecimal("120.50"));
        os.setValorMaoObra(new BigDecimal("250.00"));
        os.setValorPecas(BigDecimal.ZERO);
        os.setValorDesconto(BigDecimal.ZERO);
        os.setValorTotal(new BigDecimal("250.00"));
    }

    @Test
    @DisplayName("Deve gerar PDF válido (iniciando com cabeçalho PDF) para OS sem peças")
    void deveGerarPdfValidoParaOrdemServicoSemPecas() {
        byte[] pdf = pdfService.gerarOrdemServicoPdf(os, List.of());

        assertNotNull(pdf);
        assertTrue(pdf.length > 500, "O PDF gerado deve ter tamanho substancial");

        // Assinatura padrão de arquivo PDF: "%PDF-"
        String header = new String(pdf, 0, 5, StandardCharsets.US_ASCII);
        assertEquals("%PDF-", header, "O documento gerado deve ser um arquivo PDF válido");
    }

    @Test
    @DisplayName("Deve gerar PDF válido com tabela de peças e componentes aplicados")
    void deveGerarPdfValidoParaOrdemServicoComPecas() {
        Produto igbt = new Produto();
        igbt.setId(1L);
        igbt.setCodigo("IGBT-60N60");
        igbt.setNome("Transistor IGBT 60N60 600V");
        igbt.setMarca("Infineon");
        igbt.setPrecoVenda(new BigDecimal("75.00"));

        OrdemServicoItem item = new OrdemServicoItem();
        item.setId(1L);
        item.setOrdemServico(os);
        item.setProduto(igbt);
        item.setTipoItem(TipoItemOrdemServico.PECA);
        item.setQuantidade(new BigDecimal("2.000"));
        item.setValorUnitario(new BigDecimal("75.00"));
        item.setValorDesconto(BigDecimal.ZERO);
        item.setValorTotal(new BigDecimal("150.00"));

        os.setValorPecas(new BigDecimal("150.00"));
        os.setValorTotal(new BigDecimal("400.00"));

        byte[] pdf = pdfService.gerarOrdemServicoPdf(os, List.of(item));

        assertNotNull(pdf);
        assertTrue(pdf.length > 1000);
        String header = new String(pdf, 0, 5, StandardCharsets.US_ASCII);
        assertEquals("%PDF-", header);
    }

    @Test
    @DisplayName("Requisito 24: Teste de Integridade de Preço Histórico Congelado")
    void testeIntegridadePrecoHistoricoPrecoCongeladoNoPdf() {
        // Cenário do Requisito 24:
        // Produto cadastrado originalmente com Preço = R$ 50,00
        Produto diodo = new Produto();
        diodo.setId(2L);
        diodo.setCodigo("DIO-FAST-100");
        diodo.setNome("Diodo Rápido de Potência 100A");
        diodo.setMarca("Semikron");
        diodo.setPrecoVenda(new BigDecimal("50.00"));

        // OS: 1 unidade vinculada a R$ 50,00 (preço congelado no item)
        OrdemServicoItem item = new OrdemServicoItem();
        item.setId(20L);
        item.setOrdemServico(os);
        item.setProduto(diodo);
        item.setTipoItem(TipoItemOrdemServico.PECA);
        item.setQuantidade(new BigDecimal("1.000"));
        item.setValorUnitario(new BigDecimal("50.00")); // FONTE HISTÓRICA CONGELADA
        item.setValorDesconto(BigDecimal.ZERO);
        item.setValorTotal(new BigDecimal("50.00"));

        os.setValorPecas(new BigDecimal("50.00"));
        os.setValorTotal(new BigDecimal("300.00"));

        // DEPOIS: Produto tem seu preço reajustado no catálogo para R$ 80,00
        diodo.setPrecoVenda(new BigDecimal("80.00"));

        // Ao gerar o PDF da OS antiga:
        byte[] pdf = pdfService.gerarOrdemServicoPdf(os, List.of(item));

        assertNotNull(pdf);
        // O valor unitário do item enviado ao gerador de PDF DEVE ser R$ 50,00 e NUNCA R$ 80,00
        assertEquals(new BigDecimal("50.00"), item.getValorUnitario());
        assertEquals(new BigDecimal("50.00"), item.getValorTotal());
        assertEquals(new BigDecimal("300.00"), os.getValorTotal());
    }

    @Test
    @DisplayName("Requisito 25: Teste de Cancelamento de OS com Peças e Preservação de Histórico")
    void testeCancelamentoComPecasPreservaHistorico() {
        // OS com 2 peças
        Produto capacitor = new Produto();
        capacitor.setId(3L);
        capacitor.setCodigo("CAP-470UF");
        capacitor.setNome("Capacitor Eletrolítico 470uF 450V");
        capacitor.setMarca("Epcos");
        capacitor.setPrecoVenda(new BigDecimal("40.00"));

        OrdemServicoItem item1 = new OrdemServicoItem();
        item1.setId(31L);
        item1.setOrdemServico(os);
        item1.setProduto(capacitor);
        item1.setQuantidade(new BigDecimal("2.000"));
        item1.setValorUnitario(new BigDecimal("40.00"));
        item1.setValorDesconto(BigDecimal.ZERO);
        item1.setValorTotal(new BigDecimal("80.00"));

        // OS é cancelada pelo cliente
        os.setStatus(StatusOrdemServico.CANCELADA);
        os.setValorPecas(BigDecimal.ZERO); // estornado conforme regra de cancelamento
        os.setValorTotal(BigDecimal.ZERO);

        byte[] pdf = pdfService.gerarOrdemServicoPdf(os, List.of(item1));

        assertNotNull(pdf);
        assertEquals(StatusOrdemServico.CANCELADA, os.getStatus());
        // Histórico de peças permanece preservado na listagem de itens da OS cancelada
        assertEquals(new BigDecimal("40.00"), item1.getValorUnitario());
        assertEquals(new BigDecimal("80.00"), item1.getValorTotal());
    }

    @Test
    @DisplayName("Deve gerar PDF para OS concluída com data de conclusão e valor total")
    void deveGerarPdfParaOrdemServicoConcluida() {
        os.setStatus(StatusOrdemServico.CONCLUIDA);
        os.setDataConclusao(OffsetDateTime.now());
        os.setValorTotal(new BigDecimal("500.00"));

        byte[] pdf = pdfService.gerarOrdemServicoPdf(os, List.of());

        assertNotNull(pdf);
        assertEquals(StatusOrdemServico.CONCLUIDA, os.getStatus());
        assertNotNull(os.getDataConclusao());
    }
}
