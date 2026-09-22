package com.oficinagestao.service;

import com.oficinagestao.dto.*;
import com.oficinagestao.entity.*;
import com.oficinagestao.exception.BusinessException;
import com.oficinagestao.repository.*;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Teste de Smoke da Release 1.0.0 — Validação do Ciclo de Vida da Operação Piloto:
 * 1. Criar cliente: "CLIENTE TESTE RELEASE"
 * 2. Criar equipamento: "GERADOR TESTE RELEASE"
 * 3. Criar produto/peça: "PEÇA TESTE RELEASE" (estoque inicial = 1)
 * 4. Criar Ordem de Serviço
 * 5. Adicionar a peça teste na OS: verificar estoque de 1 para 0
 * 6. Tentar adicionar mais 1 unidade da mesma peça: verificar bloqueio por estoque insuficiente
 * 7. Avançar status: testes de bancada -> PRONTA -> CONCLUIDA
 * 8. Gerar PDF da OS: verificar integridade dos dados e bytes do PDF
 * 9. Consultar relatório financeiro/operacional: verificar contabilização da OS concluída
 */
@ExtendWith(MockitoExtension.class)
class ReleaseSmokeTest {

    @Mock
    private ClienteRepository clienteRepository;

    @Mock
    private MaquinaRepository maquinaRepository;

    @Mock
    private ProdutoRepository produtoRepository;

    @Mock
    private OrdemServicoRepository ordemServicoRepository;

    @Mock
    private OrdemServicoItemRepository ordemServicoItemRepository;

    @Mock
    private EstoqueMovimentacaoRepository estoqueMovimentacaoRepository;

    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private ConfiguracaoOficinaService configuracaoOficinaService;

    @Mock
    private AuditoriaService auditoriaService;

    @InjectMocks
    private OrdemServicoItemService ordemServicoItemService;

    @InjectMocks
    private OrdemServicoService ordemServicoService;

    @Test
    @DisplayName("Smoke Test Release 1.0.0: Ciclo completo Cliente -> Gerador -> Peça -> OS -> Baixa Estoque -> Bloqueio Saldo -> Bancada -> Conclusão -> PDF -> Relatório")
    void smokeTestFluxoCompletoRelease100() {
        // 1. Cliente Teste Release
        Cliente cliente = new Cliente();
        cliente.setId(101L);
        cliente.setNomeRazaoSocial("CLIENTE TESTE RELEASE");
        cliente.setCpfCnpj("11.222.333/0001-44");
        cliente.setTelefone("(31) 3456-7890");

        Endereco endereco = new Endereco();
        endereco.setLogradouro("Rua do Piloto");
        endereco.setNumero("100");
        endereco.setBairro("Centro");
        endereco.setCidade("Belo Horizonte");
        endereco.setEstado("MG");
        cliente.setEnderecos(List.of(endereco));

        // 2. Equipamento Teste Release (Gerador de Energia)
        Maquina gerador = new Maquina();
        gerador.setId(201L);
        gerador.setCliente(cliente);
        gerador.setTipoEquipamento(TipoEquipamento.GERADOR_ENERGIA);
        gerador.setMarca("TOYAMA");
        gerador.setModelo("GERADOR TESTE RELEASE TG8000");
        gerador.setNumeroSerie("GER-REL-100-01");
        gerador.setTensao("220V Monofásico / 110V");
        gerador.setPotencia("8.0 kVA");
        gerador.setObservacoes("Combustível: Gasolina");
        gerador.setHorimetro(new BigDecimal("250.0"));

        // 3. Produto Teste Release (Estoque inicial = 1)
        Produto peca = new Produto();
        peca.setId(301L);
        peca.setCodigo("AVR-TOY-8K");
        peca.setNome("PEÇA TESTE RELEASE - Regulador AVR 8kVA");
        peca.setTipo(TipoProduto.PECA);
        peca.setPrecoCusto(new BigDecimal("120.00"));
        peca.setPrecoVenda(new BigDecimal("250.00"));
        peca.setEstoqueAtual(new BigDecimal("1.000"));
        peca.setEstoqueMinimo(new BigDecimal("1.000"));
        peca.setAtivo(true);

        // 4. Ordem de Serviço
        OrdemServico os = new OrdemServico();
        os.setId(501L);
        os.setNumeroOs("OS-PILOTO-001");
        os.setCliente(cliente);
        os.setMaquina(gerador);
        os.setStatus(StatusOrdemServico.ABERTA);
        os.setDataEntrada(OffsetDateTime.now().minusDays(1));
        os.setProblemaRelatado("Sem geração de tensão nas tomadas auxiliares");
        os.setValorMaoObra(new BigDecimal("180.00"));
        os.setValorPecas(BigDecimal.ZERO);
        os.setValorDesconto(BigDecimal.ZERO);
        os.setValorTotal(new BigDecimal("180.00"));

        when(ordemServicoRepository.findById(501L)).thenReturn(Optional.of(os));
        when(ordemServicoRepository.findByIdWithClienteAndMaquina(501L)).thenReturn(Optional.of(os));
        when(produtoRepository.findByIdWithLock(301L)).thenReturn(Optional.of(peca));
        when(produtoRepository.save(any(Produto.class))).thenAnswer(inv -> inv.getArgument(0));
        when(ordemServicoItemRepository.save(any(OrdemServicoItem.class))).thenAnswer(inv -> {
            OrdemServicoItem item = inv.getArgument(0);
            item.setId(901L);
            return item;
        });
        when(ordemServicoRepository.save(any(OrdemServico.class))).thenAnswer(inv -> inv.getArgument(0));

        // 5. Adicionar a peça teste na OS: verificar se estoque foi de 1 para 0
        OrdemServicoItemCreateDTO itemDTO = new OrdemServicoItemCreateDTO(301L, new BigDecimal("1.000"), BigDecimal.ZERO, "Substituição do regulador AVR");
        OrdemServicoItemResponseDTO itemCriado = ordemServicoItemService.adicionarPeca(501L, itemDTO, 1L, null);

        assertNotNull(itemCriado);
        assertEquals(new BigDecimal("0.000"), peca.getEstoqueAtual(), "O estoque físico deve ser reduzido de 1 para 0");
        verify(estoqueMovimentacaoRepository, times(1)).save(any(EstoqueMovimentacao.class));

        // Atualizar lista de itens da OS para simular o estado na entidade
        OrdemServicoItem itemSalvo = new OrdemServicoItem();
        itemSalvo.setId(901L);
        itemSalvo.setOrdemServico(os);
        itemSalvo.setProduto(peca);
        itemSalvo.setTipoItem(TipoItemOrdemServico.PECA);
        itemSalvo.setQuantidade(new BigDecimal("1.000"));
        itemSalvo.setValorUnitario(new BigDecimal("250.00"));
        itemSalvo.setValorDesconto(BigDecimal.ZERO);
        itemSalvo.setValorTotal(new BigDecimal("250.00"));
        List<OrdemServicoItem> itensOs = new ArrayList<>(List.of(itemSalvo));

        // 6. Tentar adicionar mais 1 unidade da mesma peça na OS: verificar se bloqueia (estoque insuficiente)
        BusinessException exEstoque = assertThrows(BusinessException.class, () ->
                ordemServicoItemService.adicionarPeca(501L, itemDTO, 1L, null)
        );
        assertTrue(exEstoque.getMessage().contains("Estoque insuficiente"), "Deve bloquear adição quando saldo for 0");

        // 7. Avançar status da OS: ABERTA -> EM_DIAGNOSTICO -> EM_MANUTENCAO -> PRONTA (com testes bancada) -> CONCLUIDA
        // ABERTA -> EM_DIAGNOSTICO
        ordemServicoService.alterarStatus(501L, new OrdemServicoStatusDTO(StatusOrdemServico.EM_DIAGNOSTICO, null, "Início do diagnóstico"), 1L, "127.0.0.1");
        assertEquals(StatusOrdemServico.EM_DIAGNOSTICO, os.getStatus());

        // EM_DIAGNOSTICO -> EM_MANUTENCAO
        ordemServicoService.alterarStatus(501L, new OrdemServicoStatusDTO(StatusOrdemServico.EM_MANUTENCAO, null, "Início da troca de peças"), 1L, "127.0.0.1");
        assertEquals(StatusOrdemServico.EM_MANUTENCAO, os.getStatus());

        // Tentar avançar para PRONTA sem testes de bancada -> deve falhar
        BusinessException exSemTestes = assertThrows(BusinessException.class, () ->
                ordemServicoService.alterarStatus(501L, new OrdemServicoStatusDTO(StatusOrdemServico.PRONTA, "", null), 1L, "127.0.0.1")
        );
        assertTrue(exSemTestes.getMessage().contains("testes técnicos realizados na bancada"));

        // Avançar para PRONTA com testes de bancada preenchidos
        String testesBancada = "Teste de carga: 7.5 kVA sob carga resistiva por 40 min. Tensão mantida em 220V estável. Frequência 60.1 Hz. Sem oscilações de rotação.";
        ordemServicoService.alterarStatus(501L, new OrdemServicoStatusDTO(StatusOrdemServico.PRONTA, testesBancada, "Testes aprovados na bancada"), 1L, "127.0.0.1");
        assertEquals(StatusOrdemServico.PRONTA, os.getStatus());
        assertEquals(testesBancada, os.getTestesRealizados());

        // Avançar para CONCLUIDA
        ordemServicoService.alterarStatus(501L, new OrdemServicoStatusDTO(StatusOrdemServico.CONCLUIDA, null, "Equipamento retirado pelo cliente"), 1L, "127.0.0.1");
        assertEquals(StatusOrdemServico.CONCLUIDA, os.getStatus());
        assertNotNull(os.getDataConclusao(), "Data de conclusão deve ser preenchida ao concluir");

        // 8. Gerar PDF da OS e verificar integridade
        ConfiguracaoOficina configStub = new ConfiguracaoOficina();
        configStub.setNomeFantasia("Bruno Soldas");
        configStub.setCnpj("45.076.507/0001-67");
        configStub.setTelefone("(14) 9886-7223");
        configStub.setEmail("INDUTECSERVICE@HOTMAIL.COM");
        configStub.setMunicipio("Ourinhos");
        configStub.setUf("SP");
        when(configuracaoOficinaService.obterEntidade()).thenReturn(configStub);

        PdfService pdfService = new PdfService();
        org.springframework.test.util.ReflectionTestUtils.setField(pdfService, "configuracaoOficinaService", configuracaoOficinaService);
        byte[] pdfBytes = pdfService.gerarOrdemServicoPdf(os, itensOs);
        assertNotNull(pdfBytes);
        assertTrue(pdfBytes.length > 500, "O PDF gerado deve conter cabeçalho, dados e rodapé válidos");
        String pdfHeader = new String(pdfBytes, 0, Math.min(pdfBytes.length, 10));
        assertTrue(pdfHeader.startsWith("%PDF"), "Arquivo deve iniciar com assinatura padrão PDF");

        // 9. Relatório Financeiro: verificar totalizadores
        RelatorioService relatorioService = new RelatorioService(
                ordemServicoRepository,
                produtoRepository,
                estoqueMovimentacaoRepository,
                ordemServicoItemRepository,
                clienteRepository,
                maquinaRepository,
                ordemServicoService,
                mock(EstoqueService.class)
        );

        when(ordemServicoRepository.contarPorPeriodoEStatus(null, null, null)).thenReturn(1L);
        when(ordemServicoRepository.contarPorPeriodoEStatus(null, null, StatusOrdemServico.CONCLUIDA)).thenReturn(1L);
        when(ordemServicoRepository.contarAbertasPorPeriodo(null, null)).thenReturn(0L);
        when(ordemServicoRepository.contarPorPeriodoEStatus(null, null, StatusOrdemServico.CANCELADA)).thenReturn(0L);
        when(ordemServicoRepository.somarValorConcluidasPorPeriodo(null, null)).thenReturn(new BigDecimal("430.00")); // Mão de obra (180) + Peça (250)
        when(ordemServicoRepository.pesquisarGlobal(null, null, null, null, PageRequest.of(0, 10)))
                .thenReturn(new PageImpl<>(List.of(os)));

        RelatorioOsResponseDTO relatorioOs = relatorioService.obterRelatorioOsPorPeriodo(null, null, null, PageRequest.of(0, 10));
        assertNotNull(relatorioOs);
        assertEquals(new BigDecimal("430.00"), relatorioOs.resumo().valorTotalConcluidas());
        assertEquals(1L, relatorioOs.resumo().concluidas());
        assertEquals(1L, relatorioOs.resumo().totalOs());
        assertEquals(0L, relatorioOs.resumo().abertas());
    }
}
