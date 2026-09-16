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
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OrdemServicoServiceTest {

    @Mock
    private OrdemServicoRepository ordemServicoRepository;

    @Mock
    private ClienteRepository clienteRepository;

    @Mock
    private MaquinaRepository maquinaRepository;

    @Mock
    private AuditoriaService auditoriaService;

    @Mock
    private OrdemServicoItemRepository ordemServicoItemRepository;

    @Mock
    private ProdutoRepository produtoRepository;

    @Mock
    private EstoqueMovimentacaoRepository estoqueMovimentacaoRepository;

    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private PdfService pdfService;

    @InjectMocks
    private OrdemServicoService ordemServicoService;

    private Cliente clienteA;
    private Cliente clienteB;
    private Maquina maquinaClienteA;
    private Maquina maquinaClienteB;

    @BeforeEach
    void setUp() {
        clienteA = new Cliente();
        clienteA.setId(1L);
        clienteA.setNomeRazaoSocial("Cliente João da Silva");
        clienteA.setTipoPessoa(TipoPessoa.FISICA);
        clienteA.setCpfCnpj("111.222.333-44");
        clienteA.setCelular("(31) 98888-1111");

        clienteB = new Cliente();
        clienteB.setId(2L);
        clienteB.setNomeRazaoSocial("Cliente Maria Souza");
        clienteB.setTipoPessoa(TipoPessoa.FISICA);
        clienteB.setCpfCnpj("222.333.444-55");
        clienteB.setCelular("(31) 97777-2222");

        maquinaClienteA = new Maquina();
        maquinaClienteA.setId(10L);
        maquinaClienteA.setCliente(clienteA);
        maquinaClienteA.setTipoEquipamento(TipoEquipamento.MAQUINA_SOLDA);
        maquinaClienteA.setMarca("ESAB");
        maquinaClienteA.setModelo("Smashweld 450");
        maquinaClienteA.setNumeroSerie("ESAB-9988");
        maquinaClienteA.setAtivo(true);

        maquinaClienteB = new Maquina();
        maquinaClienteB.setId(20L);
        maquinaClienteB.setCliente(clienteB);
        maquinaClienteB.setTipoEquipamento(TipoEquipamento.GERADOR_ENERGIA);
        maquinaClienteB.setMarca("Toyama");
        maquinaClienteB.setModelo("TG8000");
        maquinaClienteB.setNumeroSerie("TOY-1234");
        maquinaClienteB.setAtivo(true);
    }

    // =========================================================================
    // 1. Criação de Ordem de Serviço
    // =========================================================================

    @Test
    @DisplayName("Deve criar Ordem de Serviço com sucesso vinculando cliente e seu equipamento")
    void deveCriarOrdemServicoComSucesso() {
        OrdemServicoCreateDTO dto = new OrdemServicoCreateDTO(
                1L, 10L, null, null, null,
                "Não liga ao acionar disjuntor principal", "150.0", "Acompanha tocha"
        );

        when(clienteRepository.findById(1L)).thenReturn(Optional.of(clienteA));
        when(maquinaRepository.findByIdWithCliente(10L)).thenReturn(Optional.of(maquinaClienteA));
        when(ordemServicoRepository.countByPrefixo(anyString())).thenReturn(0L);
        when(ordemServicoRepository.existsByNumeroOs(anyString())).thenReturn(false);
        when(ordemServicoRepository.save(any(OrdemServico.class))).thenAnswer(invocation -> {
            OrdemServico os = invocation.getArgument(0);
            os.setId(100L);
            return os;
        });

        OrdemServicoResponseDTO response = ordemServicoService.criar(dto, 99L, "127.0.0.1");

        assertNotNull(response);
        assertEquals(100L, response.id());
        assertTrue(response.numeroOs().startsWith("OS-"));
        assertEquals(1L, response.clienteId());
        assertEquals("Cliente João da Silva", response.clienteNome());
        assertEquals(10L, response.maquinaId());
        assertEquals("ESAB", response.maquinaMarca());
        assertEquals("Smashweld 450", response.maquinaModelo());
        assertEquals(StatusOrdemServico.ABERTA, response.status());
        assertEquals("Não liga ao acionar disjuntor principal", response.problemaRelatado());

        verify(auditoriaService).registrar(99L, "OrdemServico", "100", "INSERT", "127.0.0.1");
    }

    @Test
    @DisplayName("Deve criar OS com número customizado quando informado e não conflitante")
    void deveCriarOrdemServicoComNumeroCustomizado() {
        OrdemServicoCreateDTO dto = new OrdemServicoCreateDTO(
                1L, 10L, "OS-CUSTOM-001", null, null,
                "Ventilador travado", null, null
        );

        when(clienteRepository.findById(1L)).thenReturn(Optional.of(clienteA));
        when(maquinaRepository.findByIdWithCliente(10L)).thenReturn(Optional.of(maquinaClienteA));
        when(ordemServicoRepository.existsByNumeroOs("OS-CUSTOM-001")).thenReturn(false);
        when(ordemServicoRepository.save(any(OrdemServico.class))).thenAnswer(inv -> {
            OrdemServico os = inv.getArgument(0);
            os.setId(101L);
            return os;
        });

        OrdemServicoResponseDTO response = ordemServicoService.criar(dto, null, "127.0.0.1");

        assertNotNull(response);
        assertEquals("OS-CUSTOM-001", response.numeroOs());
    }

    @Test
    @DisplayName("Deve falhar ao criar OS quando cliente não existir")
    void naoDeveCriarOSSeClienteNaoExistir() {
        OrdemServicoCreateDTO dto = new OrdemServicoCreateDTO(
                999L, 10L, null, null, null,
                "Problema qualquer", null, null
        );

        when(clienteRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () ->
                ordemServicoService.criar(dto, null, "127.0.0.1")
        );
        verify(ordemServicoRepository, never()).save(any());
    }

    @Test
    @DisplayName("Deve falhar ao criar OS quando equipamento não existir")
    void naoDeveCriarOSSeEquipamentoNaoExistir() {
        OrdemServicoCreateDTO dto = new OrdemServicoCreateDTO(
                1L, 999L, null, null, null,
                "Problema qualquer", null, null
        );

        when(clienteRepository.findById(1L)).thenReturn(Optional.of(clienteA));
        when(maquinaRepository.findByIdWithCliente(999L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () ->
                ordemServicoService.criar(dto, null, "127.0.0.1")
        );
        verify(ordemServicoRepository, never()).save(any());
    }

    // =========================================================================
    // REGRA CRÍTICA: "Cliente A não pode abrir OS para equipamento do Cliente B"
    // =========================================================================

    @Test
    @DisplayName("REGRA CRÍTICA: Não deve permitir que Cliente A abra OS com equipamento de Cliente B")
    void naoDeveCriarOSSeEquipamentoPertencerAOutroCliente() {
        // Tentativa de vincular Cliente A (id=1) com maquinaClienteB (pertence a Cliente B, id=2)
        OrdemServicoCreateDTO dto = new OrdemServicoCreateDTO(
                1L, 20L, null, null, null,
                "Equipamento de outro cliente", null, null
        );

        when(clienteRepository.findById(1L)).thenReturn(Optional.of(clienteA));
        when(maquinaRepository.findByIdWithCliente(20L)).thenReturn(Optional.of(maquinaClienteB));

        BusinessException exception = assertThrows(BusinessException.class, () ->
                ordemServicoService.criar(dto, null, "127.0.0.1")
        );

        assertTrue(exception.getMessage().contains("não pertence ao cliente indicado"));
        verify(ordemServicoRepository, never()).save(any());
    }

    @Test
    @DisplayName("Não deve permitir criar OS com número customizado já existente")
    void naoDeveCriarOSSeNumeroOsJaExistir() {
        OrdemServicoCreateDTO dto = new OrdemServicoCreateDTO(
                1L, 10L, "OS-EXISTENTE-999", null, null,
                "Problema qualquer", null, null
        );

        when(clienteRepository.findById(1L)).thenReturn(Optional.of(clienteA));
        when(maquinaRepository.findByIdWithCliente(10L)).thenReturn(Optional.of(maquinaClienteA));
        when(ordemServicoRepository.existsByNumeroOs("OS-EXISTENTE-999")).thenReturn(true);

        assertThrows(ConflictException.class, () ->
                ordemServicoService.criar(dto, null, "127.0.0.1")
        );
        verify(ordemServicoRepository, never()).save(any());
    }

    // =========================================================================
    // 2. Consulta e Histórico
    // =========================================================================

    @Test
    @DisplayName("Deve buscar OS por ID com sucesso")
    void deveBuscarOrdemServicoPorId() {
        OrdemServico os = new OrdemServico();
        os.setId(50L);
        os.setNumeroOs("OS-2026-0050");
        os.setCliente(clienteA);
        os.setMaquina(maquinaClienteA);
        os.setStatus(StatusOrdemServico.ABERTA);
        os.setProblemaRelatado("Cabo rompido");

        when(ordemServicoRepository.findByIdWithClienteAndMaquina(50L)).thenReturn(Optional.of(os));

        OrdemServicoResponseDTO response = ordemServicoService.buscarPorId(50L);

        assertNotNull(response);
        assertEquals(50L, response.id());
        assertEquals("OS-2026-0050", response.numeroOs());
        assertEquals("Cliente João da Silva", response.clienteNome());
        assertEquals("Smashweld 450", response.maquinaModelo());
    }

    @Test
    @DisplayName("Deve falhar ao buscar OS inexistente")
    void naoDeveBuscarOSInexistente() {
        when(ordemServicoRepository.findByIdWithClienteAndMaquina(999L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () ->
                ordemServicoService.buscarPorId(999L)
        );
    }

    @Test
    @DisplayName("Deve listar histórico de Ordens de Serviço por cliente")
    void deveListarOrdensPorCliente() {
        when(clienteRepository.existsById(1L)).thenReturn(true);

        OrdemServico os = new OrdemServico();
        os.setId(1L);
        os.setNumeroOs("OS-2026-0001");
        os.setCliente(clienteA);
        os.setMaquina(maquinaClienteA);
        os.setStatus(StatusOrdemServico.ABERTA);
        os.setProblemaRelatado("Problema teste");

        Page<OrdemServico> page = new PageImpl<>(List.of(os));
        when(ordemServicoRepository.pesquisarPorCliente(eq(1L), isNull(), any(Pageable.class))).thenReturn(page);

        PageResponse<OrdemServicoResponseDTO> result =
                ordemServicoService.listarPorCliente(1L, null, PageRequest.of(0, 10));

        assertNotNull(result);
        assertEquals(1, result.content().size());
        assertEquals("OS-2026-0001", result.content().get(0).numeroOs());
    }

    @Test
    @DisplayName("Deve listar histórico de manutenções por máquina (preservação do histórico)")
    void deveListarOrdensPorMaquinaEPreservarHistorico() {
        when(maquinaRepository.existsById(10L)).thenReturn(true);

        OrdemServico os1 = new OrdemServico();
        os1.setId(1L);
        os1.setNumeroOs("OS-2025-0010");
        os1.setCliente(clienteA);
        os1.setMaquina(maquinaClienteA);
        os1.setStatus(StatusOrdemServico.CONCLUIDA);
        os1.setProblemaRelatado("Troca de diodos");

        OrdemServico os2 = new OrdemServico();
        os2.setId(2L);
        os2.setNumeroOs("OS-2026-0022");
        os2.setCliente(clienteA);
        os2.setMaquina(maquinaClienteA);
        os2.setStatus(StatusOrdemServico.ABERTA);
        os2.setProblemaRelatado("Revisão preventiva anual");

        Page<OrdemServico> page = new PageImpl<>(List.of(os1, os2));
        when(ordemServicoRepository.pesquisarPorMaquina(eq(10L), any(Pageable.class))).thenReturn(page);

        PageResponse<OrdemServicoResponseDTO> result =
                ordemServicoService.listarPorMaquina(10L, PageRequest.of(0, 10));

        assertNotNull(result);
        assertEquals(2, result.content().size());
        assertEquals("OS-2025-0010", result.content().get(0).numeroOs());
        assertEquals("OS-2026-0022", result.content().get(1).numeroOs());
    }

    // =========================================================================
    // 3. Atualização e Cálculo de Valores
    // =========================================================================

    @Test
    @DisplayName("Deve atualizar dados técnicos e valores calculando total corretamente")
    void deveAtualizarDadosTecnicosEValoresComSucesso() {
        OrdemServico os = new OrdemServico();
        os.setId(5L);
        os.setNumeroOs("OS-2026-0005");
        os.setCliente(clienteA);
        os.setMaquina(maquinaClienteA);
        os.setStatus(StatusOrdemServico.EM_DIAGNOSTICO);
        os.setProblemaRelatado("Sem corrente na saída");

        when(ordemServicoRepository.findByIdWithClienteAndMaquina(5L)).thenReturn(Optional.of(os));
        when(ordemServicoRepository.save(any(OrdemServico.class))).thenAnswer(inv -> inv.getArgument(0));

        OrdemServicoUpdateDTO updateDTO = new OrdemServicoUpdateDTO(
                "Sem corrente na saída (confirmado)",
                "IGBT estourado",
                "Substituição dos módulos IGBT e resistores de gate",
                null,
                "Orçamento aprovado via WhatsApp",
                null,
                new BigDecimal("300.00"), // Mão de obra
                new BigDecimal("450.00"), // Peças
                new BigDecimal("50.00"),  // Desconto
                null
        );

        OrdemServicoResponseDTO response = ordemServicoService.atualizar(5L, updateDTO, 1L, "127.0.0.1");

        assertNotNull(response);
        assertEquals("IGBT estourado", response.diagnostico());
        assertEquals(new BigDecimal("300.00"), response.valorMaoObra());
        assertEquals(new BigDecimal("450.00"), response.valorPecas());
        assertEquals(new BigDecimal("50.00"), response.valorDesconto());
        // Total = 300 + 450 - 50 = 700.00
        assertEquals(new BigDecimal("700.00"), response.valorTotal());
    }

    @Test
    @DisplayName("Não deve permitir atualizar OS com status CONCLUIDA")
    void naoDeveAtualizarOrdemServicoConcluida() {
        OrdemServico os = new OrdemServico();
        os.setId(6L);
        os.setStatus(StatusOrdemServico.CONCLUIDA);

        when(ordemServicoRepository.findByIdWithClienteAndMaquina(6L)).thenReturn(Optional.of(os));

        OrdemServicoUpdateDTO updateDTO = new OrdemServicoUpdateDTO(
                null, "Novo diagnóstico", null, null, null, null, null, null, null, null
        );

        BusinessException ex = assertThrows(BusinessException.class, () ->
                ordemServicoService.atualizar(6L, updateDTO, null, "127.0.0.1")
        );
        assertTrue(ex.getMessage().contains("concluída não pode ser alterada"));
    }

    @Test
    @DisplayName("Não deve permitir atualizar OS com status CANCELADA")
    void naoDeveAtualizarOrdemServicoCancelada() {
        OrdemServico os = new OrdemServico();
        os.setId(7L);
        os.setStatus(StatusOrdemServico.CANCELADA);

        when(ordemServicoRepository.findByIdWithClienteAndMaquina(7L)).thenReturn(Optional.of(os));

        OrdemServicoUpdateDTO updateDTO = new OrdemServicoUpdateDTO(
                null, null, null, null, null, null, null, null, null, null
        );

        BusinessException ex = assertThrows(BusinessException.class, () ->
                ordemServicoService.atualizar(7L, updateDTO, null, "127.0.0.1")
        );
        assertTrue(ex.getMessage().contains("cancelada não pode ser alterada"));
    }

    @Test
    @DisplayName("Não deve permitir atualizar com valores negativos")
    void naoDeveAtualizarComValoresNegativos() {
        OrdemServico os = new OrdemServico();
        os.setId(8L);
        os.setStatus(StatusOrdemServico.ABERTA);

        when(ordemServicoRepository.findByIdWithClienteAndMaquina(8L)).thenReturn(Optional.of(os));

        OrdemServicoUpdateDTO updateDTO = new OrdemServicoUpdateDTO(
                null, null, null, null, null, null,
                new BigDecimal("-50.00"), null, null, null
        );

        assertThrows(BusinessException.class, () ->
                ordemServicoService.atualizar(8L, updateDTO, null, "127.0.0.1")
        );
    }

    // =========================================================================
    // 4. Transições de Status e Testes de Bancada
    // =========================================================================

    @Test
    @DisplayName("Deve transicionar status coerentemente de ABERTA para EM_DIAGNOSTICO")
    void deveTransicionarStatusComSucesso() {
        OrdemServico os = new OrdemServico();
        os.setId(15L);
        os.setNumeroOs("OS-2026-0015");
        os.setCliente(clienteA);
        os.setMaquina(maquinaClienteA);
        os.setStatus(StatusOrdemServico.ABERTA);

        when(ordemServicoRepository.findByIdWithClienteAndMaquina(15L)).thenReturn(Optional.of(os));
        when(ordemServicoRepository.save(any(OrdemServico.class))).thenAnswer(inv -> inv.getArgument(0));

        OrdemServicoStatusDTO statusDTO = new OrdemServicoStatusDTO(
                StatusOrdemServico.EM_DIAGNOSTICO, null, "Equipamento colocado na bancada 2"
        );

        OrdemServicoResponseDTO response = ordemServicoService.alterarStatus(15L, statusDTO, 1L, "127.0.0.1");

        assertNotNull(response);
        assertEquals(StatusOrdemServico.EM_DIAGNOSTICO, response.status());
    }

    @Test
    @DisplayName("Não deve permitir transição para PRONTA sem registro de testes técnicos")
    void naoDeveTransicionarParaProntaSemTestesTecnicos() {
        OrdemServico os = new OrdemServico();
        os.setId(16L);
        os.setStatus(StatusOrdemServico.EM_MANUTENCAO);
        os.setTestesRealizados(null); // Sem testes

        when(ordemServicoRepository.findByIdWithClienteAndMaquina(16L)).thenReturn(Optional.of(os));

        OrdemServicoStatusDTO statusDTO = new OrdemServicoStatusDTO(
                StatusOrdemServico.PRONTA, null, null
        );

        BusinessException ex = assertThrows(BusinessException.class, () ->
                ordemServicoService.alterarStatus(16L, statusDTO, null, "127.0.0.1")
        );

        assertTrue(ex.getMessage().contains("obrigatório registrar os testes técnicos"));
    }

    @Test
    @DisplayName("Deve permitir transição para PRONTA quando testes forem informados no payload")
    void deveTransicionarParaProntaComTestesTecnicos() {
        OrdemServico os = new OrdemServico();
        os.setId(17L);
        os.setNumeroOs("OS-2026-0017");
        os.setCliente(clienteA);
        os.setMaquina(maquinaClienteA);
        os.setStatus(StatusOrdemServico.EM_MANUTENCAO);

        when(ordemServicoRepository.findByIdWithClienteAndMaquina(17L)).thenReturn(Optional.of(os));
        when(ordemServicoRepository.save(any(OrdemServico.class))).thenAnswer(inv -> inv.getArgument(0));

        OrdemServicoStatusDTO statusDTO = new OrdemServicoStatusDTO(
                StatusOrdemServico.PRONTA,
                "Teste de solda MIG com arame 1.0mm sob 220A durante 20 min sem aquecimento",
                "Máquina liberada para entrega"
        );

        OrdemServicoResponseDTO response = ordemServicoService.alterarStatus(17L, statusDTO, 1L, "127.0.0.1");

        assertNotNull(response);
        assertEquals(StatusOrdemServico.PRONTA, response.status());
        assertNotNull(response.testesRealizados());
    }

    @Test
    @DisplayName("Deve concluir OS e preencher automaticamente data de conclusão")
    void deveConcluirOrdemServicoERegistrarDataConclusao() {
        OrdemServico os = new OrdemServico();
        os.setId(18L);
        os.setNumeroOs("OS-2026-0018");
        os.setCliente(clienteA);
        os.setMaquina(maquinaClienteA);
        os.setStatus(StatusOrdemServico.PRONTA);
        os.setTestesRealizados("Teste OK");

        when(ordemServicoRepository.findByIdWithClienteAndMaquina(18L)).thenReturn(Optional.of(os));
        when(ordemServicoRepository.save(any(OrdemServico.class))).thenAnswer(inv -> inv.getArgument(0));

        OrdemServicoStatusDTO statusDTO = new OrdemServicoStatusDTO(
                StatusOrdemServico.CONCLUIDA, null, "Equipamento retirado pelo cliente"
        );

        OrdemServicoResponseDTO response = ordemServicoService.alterarStatus(18L, statusDTO, 1L, "127.0.0.1");

        assertNotNull(response);
        assertEquals(StatusOrdemServico.CONCLUIDA, response.status());
        assertNotNull(response.dataConclusao());
    }

    @Test
    @DisplayName("Deve cancelar OS a partir de qualquer status não terminal")
    void deveCancelarOrdemServicoComSucesso() {
        OrdemServico os = new OrdemServico();
        os.setId(19L);
        os.setNumeroOs("OS-2026-0019");
        os.setCliente(clienteA);
        os.setMaquina(maquinaClienteA);
        os.setStatus(StatusOrdemServico.AGUARDANDO_APROVACAO);

        when(ordemServicoRepository.findByIdWithClienteAndMaquina(19L)).thenReturn(Optional.of(os));
        when(ordemServicoRepository.save(any(OrdemServico.class))).thenAnswer(inv -> inv.getArgument(0));

        OrdemServicoStatusDTO statusDTO = new OrdemServicoStatusDTO(
                StatusOrdemServico.CANCELADA, null, "Cliente achou orçamento inviável"
        );

        OrdemServicoResponseDTO response = ordemServicoService.alterarStatus(19L, statusDTO, 1L, "127.0.0.1");

        assertNotNull(response);
        assertEquals(StatusOrdemServico.CANCELADA, response.status());
    }

    @Test
    @DisplayName("Não deve permitir alterar status de OS já CONCLUIDA")
    void naoDeveAlterarStatusDeOrdemConcluida() {
        OrdemServico os = new OrdemServico();
        os.setId(20L);
        os.setStatus(StatusOrdemServico.CONCLUIDA);

        when(ordemServicoRepository.findByIdWithClienteAndMaquina(20L)).thenReturn(Optional.of(os));

        OrdemServicoStatusDTO statusDTO = new OrdemServicoStatusDTO(
                StatusOrdemServico.EM_MANUTENCAO, null, null
        );

        assertThrows(BusinessException.class, () ->
                ordemServicoService.alterarStatus(20L, statusDTO, null, "127.0.0.1")
        );
    }

    @Test
    @DisplayName("BUG-001 (P0): Deve estornar peças fisicamente para o estoque com movimentação DEVOLUCAO ao cancelar OS")
    void deveEstornarPecasParaEstoqueAoCancelarOrdemServico() {
        OrdemServico os = new OrdemServico();
        os.setId(50L);
        os.setNumeroOs("OS-2026-0050");
        os.setCliente(clienteA);
        os.setMaquina(maquinaClienteA);
        os.setStatus(StatusOrdemServico.EM_MANUTENCAO);
        os.setValorPecas(BigDecimal.valueOf(100.00));
        os.setValorTotal(BigDecimal.valueOf(200.00));

        Produto produto = new Produto();
        produto.setId(101L);
        produto.setNome("Diodo de Potência");
        produto.setPrecoVenda(BigDecimal.valueOf(50.00));
        produto.setEstoqueAtual(BigDecimal.valueOf(8.00));

        OrdemServicoItem itemPeca = new OrdemServicoItem();
        itemPeca.setId(501L);
        itemPeca.setOrdemServico(os);
        itemPeca.setProduto(produto);
        itemPeca.setTipoItem(TipoItemOrdemServico.PECA);
        itemPeca.setQuantidade(BigDecimal.valueOf(2.00));
        itemPeca.setValorUnitario(BigDecimal.valueOf(50.00));
        itemPeca.setValorTotal(BigDecimal.valueOf(100.00));

        Usuario usuario = new Usuario();
        usuario.setId(1L);
        usuario.setNome("Técnico Responsável");

        when(ordemServicoRepository.findByIdWithClienteAndMaquina(50L)).thenReturn(Optional.of(os));
        when(ordemServicoItemRepository.findByOrdemServicoIdComProduto(50L)).thenReturn(List.of(itemPeca));
        when(produtoRepository.findByIdWithLock(101L)).thenReturn(Optional.of(produto));
        when(usuarioRepository.findById(1L)).thenReturn(Optional.of(usuario));
        when(ordemServicoRepository.save(any(OrdemServico.class))).thenAnswer(inv -> inv.getArgument(0));

        OrdemServicoStatusDTO statusDTO = new OrdemServicoStatusDTO(
                StatusOrdemServico.CANCELADA, null, "Cancelamento solicitado pelo cliente"
        );

        OrdemServicoResponseDTO response = ordemServicoService.alterarStatus(50L, statusDTO, 1L, "127.0.0.1");

        assertNotNull(response);
        assertEquals(StatusOrdemServico.CANCELADA, response.status());
        // Saldo físico anterior (8) + estorno (2) = 10
        assertEquals(0, BigDecimal.valueOf(10.00).compareTo(produto.getEstoqueAtual()));
        verify(produtoRepository).save(produto);
        verify(estoqueMovimentacaoRepository).save(argThat(mov ->
                mov.getTipoMovimentacao() == TipoMovimentacaoEstoque.DEVOLUCAO &&
                mov.getQuantidade().compareTo(BigDecimal.valueOf(2.00)) == 0 &&
                mov.getQuantidadeAnterior().compareTo(BigDecimal.valueOf(8.00)) == 0 &&
                mov.getQuantidadePosterior().compareTo(BigDecimal.valueOf(10.00)) == 0
        ));
    }

    @Test
    @DisplayName("BUG-002 (P1): Não deve permitir alterar valorPecas manualmente quando OS possui itens de peças lançados")
    void naoDevePermitirAlterarValorPecasManualmenteQuandoOsPossuiItens() {
        OrdemServico os = new OrdemServico();
        os.setId(60L);
        os.setNumeroOs("OS-2026-0060");
        os.setCliente(clienteA);
        os.setMaquina(maquinaClienteA);
        os.setStatus(StatusOrdemServico.EM_MANUTENCAO);
        os.setValorPecas(BigDecimal.valueOf(100.00));

        when(ordemServicoRepository.findByIdWithClienteAndMaquina(60L)).thenReturn(Optional.of(os));
        when(ordemServicoItemRepository.existsByOrdemServicoIdAndTipoItem(60L, TipoItemOrdemServico.PECA)).thenReturn(true);

        OrdemServicoUpdateDTO updateDTO = new OrdemServicoUpdateDTO(
                null, null, null, null, null, null,
                BigDecimal.valueOf(80.00), BigDecimal.valueOf(150.00), BigDecimal.ZERO, null
        );

        BusinessException ex = assertThrows(BusinessException.class, () ->
                ordemServicoService.atualizar(60L, updateDTO, 1L, "127.0.0.1")
        );

        assertTrue(ex.getMessage().contains("recalculado automaticamente"));
    }

    @Test
    @DisplayName("RISK-003: Não deve permitir desconto superior ao subtotal da OS")
    void naoDevePermitirDescontoMaiorQueSubtotal() {
        OrdemServico os = new OrdemServico();
        os.setId(70L);
        os.setNumeroOs("OS-2026-0070");
        os.setCliente(clienteA);
        os.setMaquina(maquinaClienteA);
        os.setStatus(StatusOrdemServico.EM_MANUTENCAO);
        os.setValorMaoObra(BigDecimal.valueOf(50.00));
        os.setValorPecas(BigDecimal.valueOf(50.00));

        when(ordemServicoRepository.findByIdWithClienteAndMaquina(70L)).thenReturn(Optional.of(os));

        OrdemServicoUpdateDTO updateDTO = new OrdemServicoUpdateDTO(
                null, null, null, null, null, null,
                BigDecimal.valueOf(50.00), BigDecimal.valueOf(50.00), BigDecimal.valueOf(150.00), null
        );

        BusinessException ex = assertThrows(BusinessException.class, () ->
                ordemServicoService.atualizar(70L, updateDTO, 1L, "127.0.0.1")
        );

        assertTrue(ex.getMessage().contains("não pode ser superior ao subtotal"));
    }

    @Test
    @DisplayName("BUG-006: Não deve aceitar horímetro negativo")
    void naoDeveAceitarHorimetroNegativo() {
        OrdemServico os = new OrdemServico();
        os.setId(80L);
        os.setNumeroOs("OS-2026-0080");
        os.setCliente(clienteA);
        os.setMaquina(maquinaClienteA);
        os.setStatus(StatusOrdemServico.ABERTA);

        when(ordemServicoRepository.findByIdWithClienteAndMaquina(80L)).thenReturn(Optional.of(os));

        OrdemServicoUpdateDTO updateDTO = new OrdemServicoUpdateDTO(
                null, null, null, null, null, "-15.5",
                BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, null
        );

        BusinessException ex = assertThrows(BusinessException.class, () ->
                ordemServicoService.atualizar(80L, updateDTO, 1L, "127.0.0.1")
        );

        assertTrue(ex.getMessage().contains("não pode ser negativo"));
    }
}
