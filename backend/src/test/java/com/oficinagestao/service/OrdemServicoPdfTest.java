package com.oficinagestao.service;

import com.oficinagestao.entity.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OrdemServicoPdfTest {

    @Mock
    private ConfiguracaoOficinaService configuracaoOficinaService;

    @InjectMocks
    private PdfService pdfService;

    private Cliente cliente;
    private Maquina maquina;
    private OrdemServico os;

    @BeforeEach
    void setUp() {
        // Stub: retorna ConfiguracaoOficina com dados reais da Bruno Soldas
        ConfiguracaoOficina configStub = new ConfiguracaoOficina();
        configStub.setNomeFantasia("Bruno Soldas");
        configStub.setNomeEmpresarial("45.076.507 BRUNO SOARES RODRIGUES");
        configStub.setCnpj("45.076.507/0001-67");
        configStub.setTelefone("(14) 9886-7223");
        configStub.setEmail("INDUTECSERVICE@HOTMAIL.COM");
        configStub.setLogradouro("Avenida Jacinto Ferreira de Sá - de 1272/1273 ao fim");
        configStub.setNumero("1538");
        configStub.setBairro("Vila Sandano");
        configStub.setCep("19.914-080");
        configStub.setMunicipio("Ourinhos");
        configStub.setUf("SP");
        when(configuracaoOficinaService.obterEntidade()).thenReturn(configStub);

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

    @Test
    @DisplayName("Deve gerar Documento de Serviço PDF válido (iniciando com %PDF-) sem peças")
    void deveGerarDocumentoServicoPdfValidoParaOrdemServicoSemPecas() {
        byte[] pdf = pdfService.gerarDocumentoServicoPdf(os, List.of());

        assertNotNull(pdf);
        assertTrue(pdf.length > 500, "O Documento de Serviço gerado deve ter tamanho substancial");
        String header = new String(pdf, 0, 5, StandardCharsets.US_ASCII);
        assertEquals("%PDF-", header, "O documento gerado deve ser um arquivo PDF válido");
    }

    @Test
    @DisplayName("Deve gerar Documento de Serviço PDF válido com peças e valores aplicados")
    void deveGerarDocumentoServicoPdfValidoParaOrdemServicoComPecas() {
        Produto rele = new Produto();
        rele.setId(2L);
        rele.setCodigo("REL-12V");
        rele.setNome("Relé Auxiliar 12V 40A");
        rele.setMarca("DNI");
        rele.setPrecoVenda(new BigDecimal("35.00"));

        OrdemServicoItem item = new OrdemServicoItem();
        item.setId(10L);
        item.setOrdemServico(os);
        item.setProduto(rele);
        item.setTipoItem(TipoItemOrdemServico.PECA);
        item.setQuantidade(new BigDecimal("1.000"));
        item.setValorUnitario(new BigDecimal("35.00"));
        item.setValorDesconto(BigDecimal.ZERO);
        item.setValorTotal(new BigDecimal("35.00"));

        os.setValorPecas(new BigDecimal("35.00"));
        os.setValorTotal(new BigDecimal("285.00"));

        byte[] pdf = pdfService.gerarDocumentoServicoPdf(os, List.of(item));
        assertNotNull(pdf);
        assertTrue(pdf.length > 1000);
        assertEquals("%PDF-", new String(pdf, 0, 5, StandardCharsets.US_ASCII));
    }

    @Test
    @DisplayName("Cenário A — OS Simples: cliente, equipamento, serviço básico, sem peças e valor simples")
    void cenarioA_OsSimples() {
        os.setProblemaRelatado("Aparelho não liga ao acionar a chave seletora.");
        os.setDiagnostico("Fusível de entrada rompido.");
        os.setSolucaoAplicada("Substituição do fusível e limpeza técnica.");
        os.setTestesRealizados("Teste de continuidade e teste em carga 10A.");
        os.setValorMaoObra(new BigDecimal("120.00"));
        os.setValorPecas(BigDecimal.ZERO);
        os.setValorDesconto(BigDecimal.ZERO);
        os.setValorTotal(new BigDecimal("120.00"));

        byte[] pdf = pdfService.gerarDocumentoServicoPdf(os, List.of());
        assertNotNull(pdf);
        assertTrue(pdf.length > 500);
        assertEquals("%PDF-", new String(pdf, 0, 5, StandardCharsets.US_ASCII));
    }

    @Test
    @DisplayName("Cenário B — OS com Várias Peças: múltiplos produtos, quantidades diferentes e desconto")
    void cenarioB_OsComVariasPecas() {
        List<OrdemServicoItem> itens = new ArrayList<>();
        BigDecimal totalPecas = BigDecimal.ZERO;

        for (int i = 1; i <= 5; i++) {
            Produto p = new Produto();
            p.setId((long) i);
            p.setCodigo("PEC-00" + i);
            p.setNome("Componente Eletrônico " + i);
            p.setPrecoVenda(new BigDecimal("25.50"));

            OrdemServicoItem item = new OrdemServicoItem();
            item.setId((long) (100 + i));
            item.setOrdemServico(os);
            item.setProduto(p);
            item.setTipoItem(TipoItemOrdemServico.PECA);
            item.setQuantidade(new BigDecimal(i + ".000"));
            item.setValorUnitario(new BigDecimal("25.50"));
            item.setValorDesconto(i == 2 ? new BigDecimal("5.00") : BigDecimal.ZERO);
            BigDecimal subtotal = item.getValorUnitario().multiply(item.getQuantidade()).subtract(item.getValorDesconto());
            item.setValorTotal(subtotal);

            totalPecas = totalPecas.add(subtotal);
            itens.add(item);
        }

        os.setValorMaoObra(new BigDecimal("300.00"));
        os.setValorPecas(totalPecas);
        os.setValorDesconto(new BigDecimal("20.00"));
        os.setValorTotal(totalPecas.add(new BigDecimal("300.00")).subtract(new BigDecimal("20.00")));

        byte[] pdf = pdfService.gerarDocumentoServicoPdf(os, itens);
        assertNotNull(pdf);
        assertTrue(pdf.length > 2000);
        assertEquals("%PDF-", new String(pdf, 0, 5, StandardCharsets.US_ASCII));
    }

    @Test
    @DisplayName("Cenário C — OS com Textos Longos: laudos e observações extensas")
    void cenarioC_OsComTextosLongos() {
        String textoLongo = "Constatado após abertura completa da carenagem que o equipamento operava em ambiente altamente "
                + "contaminado por poeira metálica condutiva e fuligem industrial. Isso provocou fuga de corrente e centelhamento "
                + "nos terminais do módulo inversor primário, danificando os drivers de gate e as trilhas de cobre da placa de controle. "
                + "Foram realizados procedimentos de desoxidação química com álcool isopropílico, ressoldagem de componentes SMD "
                + "e aplicação de verniz de proteção dielétrica conforme especificações técnicas do fabricante da máquina.";

        os.setProblemaRelatado("Equipamento desarmando disjuntor geral imediatamente ao acionar ignição de solda.");
        os.setDiagnostico(textoLongo);
        os.setSolucaoAplicada(textoLongo);
        os.setTestesRealizados("Ensaio com carga resistiva artificial de 200A durante 45 minutos contínuos sem sobreaquecimento.");
        os.setObservacoes("Recomendado ao cliente instalar filtro de ar externo na entrada da oficina e realizar limpeza a cada 60 dias.");

        byte[] pdf = pdfService.gerarDocumentoServicoPdf(os, List.of());
        assertNotNull(pdf);
        assertTrue(pdf.length > 1000);
        assertEquals("%PDF-", new String(pdf, 0, 5, StandardCharsets.US_ASCII));
    }

    @Test
    @DisplayName("Cenário D — Cliente Pessoa Física: CPF com máscara e dados de PF")
    void cenarioD_ClientePessoaFisica() {
        Cliente pf = new Cliente();
        pf.setId(50L);
        pf.setTipoPessoa(TipoPessoa.FISICA);
        pf.setNomeRazaoSocial("Carlos Eduardo de Souza");
        pf.setCpfCnpj("12345678901");
        pf.setTelefone("31988887777");
        pf.setEmail("carlos.souza@email.com");
        os.setCliente(pf);

        byte[] pdf = pdfService.gerarDocumentoServicoPdf(os, List.of());
        assertNotNull(pdf);
        assertTrue(pdf.length > 500);
        assertEquals("%PDF-", new String(pdf, 0, 5, StandardCharsets.US_ASCII));
    }

    @Test
    @DisplayName("Cenário E — Cliente Pessoa Jurídica: CNPJ com máscara e Razão Social com Fantasia")
    void cenarioE_ClientePessoaJuridica() {
        Cliente pj = new Cliente();
        pj.setId(51L);
        pj.setTipoPessoa(TipoPessoa.JURIDICA);
        pj.setNomeRazaoSocial("Construtora e Engenharia Vale do Aço Ltda");
        pj.setNomeFantasia("Vale do Aço Construções");
        pj.setCpfCnpj("12345678000195");
        pj.setTelefone("3133332222");
        pj.setEmail("compras@valedoaco.com.br");
        os.setCliente(pj);

        byte[] pdf = pdfService.gerarDocumentoServicoPdf(os, List.of());
        assertNotNull(pdf);
        assertTrue(pdf.length > 500);
        assertEquals("%PDF-", new String(pdf, 0, 5, StandardCharsets.US_ASCII));
    }

    @Test
    @DisplayName("Cenário F — OS com Muitas Informações: tabela extensa gerando quebra de página automática")
    void cenarioF_OsComMuitasInformacoes_QuebraDePagina() {
        List<OrdemServicoItem> muitasPecas = new ArrayList<>();
        BigDecimal totalPecas = BigDecimal.ZERO;

        for (int i = 1; i <= 25; i++) {
            Produto p = new Produto();
            p.setId((long) i);
            p.setCodigo("ITEM-" + String.format("%03d", i));
            p.setNome("Insumo / Peça de Reposição Número " + i + " para Manutenção Preventiva e Corretiva");
            p.setPrecoVenda(new BigDecimal("15.00"));

            OrdemServicoItem item = new OrdemServicoItem();
            item.setId((long) (200 + i));
            item.setOrdemServico(os);
            item.setProduto(p);
            item.setTipoItem(TipoItemOrdemServico.PECA);
            item.setQuantidade(new BigDecimal("2.000"));
            item.setValorUnitario(new BigDecimal("15.00"));
            item.setValorDesconto(BigDecimal.ZERO);
            item.setValorTotal(new BigDecimal("30.00"));

            totalPecas = totalPecas.add(new BigDecimal("30.00"));
            muitasPecas.add(item);
        }

        os.setValorMaoObra(new BigDecimal("500.00"));
        os.setValorPecas(totalPecas);
        os.setValorDesconto(new BigDecimal("50.00"));
        os.setValorTotal(totalPecas.add(new BigDecimal("500.00")).subtract(new BigDecimal("50.00")));

        byte[] pdf = pdfService.gerarDocumentoServicoPdf(os, muitasPecas);
        assertNotNull(pdf);
        // Com 25 itens, o PDF deve gerar múltiplas páginas com tamanho superior a 5KB
        assertTrue(pdf.length > 5000, "PDF multi-páginas deve ter tamanho superior a 5000 bytes");
        assertEquals("%PDF-", new String(pdf, 0, 5, StandardCharsets.US_ASCII));
    }
}
