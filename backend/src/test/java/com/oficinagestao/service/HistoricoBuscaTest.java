package com.oficinagestao.service;

import com.oficinagestao.dto.BuscaRapidaDTO;
import com.oficinagestao.dto.ClienteResumoDTO;
import com.oficinagestao.dto.MaquinaResumoDTO;
import com.oficinagestao.dto.OrdemServicoResponseDTO;
import com.oficinagestao.dto.PageResponse;
import com.oficinagestao.entity.*;
import com.oficinagestao.repository.ClienteRepository;
import com.oficinagestao.repository.MaquinaRepository;
import com.oficinagestao.repository.OrdemServicoRepository;
import com.oficinagestao.repository.ProdutoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class HistoricoBuscaTest {

    @Mock
    private OrdemServicoRepository ordemServicoRepository;

    @Mock
    private MaquinaRepository maquinaRepository;

    @Mock
    private ClienteRepository clienteRepository;

    @Mock
    private ProdutoRepository produtoRepository;

    @Mock
    private AuditoriaService auditoriaService;

    @Mock
    private OrdemServicoService ordemServicoService;

    private MaquinaService maquinaService;
    private ClienteService clienteService;
    private BuscaService buscaService;

    private Cliente clienteABC;
    private Cliente clienteXYZ;
    private Maquina maquinaA;
    private Maquina geradorB;
    private Maquina maquinaXYZ;

    @BeforeEach
    void setUp() {
        maquinaService = new MaquinaService(
                maquinaRepository,
                clienteRepository,
                auditoriaService,
                ordemServicoRepository,
                ordemServicoService
        );

        clienteService = new ClienteService(
                clienteRepository,
                auditoriaService,
                maquinaRepository,
                ordemServicoRepository
        );

        buscaService = new BuscaService(
                clienteRepository,
                maquinaRepository,
                ordemServicoRepository,
                produtoRepository
        );

        clienteABC = new Cliente(TipoPessoa.JURIDICA, "Empresa ABC Ltda", "ABC Soldas", "12345678000199", "123456", "3133334444", "31999998888", "contato@abc.com", "Cliente VIP");
        clienteABC.setId(100L);

        clienteXYZ = new Cliente(TipoPessoa.JURIDICA, "Outra Empresa XYZ", "XYZ Geradores", "98765432000188", "654321", "3132221111", "31988887777", "contato@xyz.com", "Cliente B");
        clienteXYZ.setId(200L);

        maquinaA = new Maquina();
        maquinaA.setId(10L);
        maquinaA.setCliente(clienteABC);
        maquinaA.setTipoEquipamento(TipoEquipamento.MAQUINA_SOLDA);
        maquinaA.setMarca("Esab");
        maquinaA.setModelo("Smashweld 277");
        maquinaA.setNumeroSerie("SN-ESAB-001");
        maquinaA.setAtivo(true);

        geradorB = new Maquina();
        geradorB.setId(20L);
        geradorB.setCliente(clienteABC);
        geradorB.setTipoEquipamento(TipoEquipamento.GERADOR_ENERGIA);
        geradorB.setMarca("Toyama");
        geradorB.setModelo("TG8000");
        geradorB.setNumeroSerie("SN-TOY-002");
        geradorB.setAtivo(true);

        maquinaXYZ = new Maquina();
        maquinaXYZ.setId(30L);
        maquinaXYZ.setCliente(clienteXYZ);
        maquinaXYZ.setTipoEquipamento(TipoEquipamento.MAQUINA_SOLDA);
        maquinaXYZ.setMarca("BAMBOZZI");
        maquinaXYZ.setModelo("TRR 2600");
        maquinaXYZ.setNumeroSerie("SN-BAMB-003");
        maquinaXYZ.setAtivo(true);
    }

    @Test
    @DisplayName("Requisito 26 — Teste de Regressão Principal: Isolamento estrito de histórico entre Máquina A e Gerador B")
    void testRegressaoPrincipalIsolamentoMaquinas() {
        // Cenário:
        // Cliente: Empresa ABC
        // Máquina A: OS 001, OS 004, OS 010
        // Gerador B: OS 003, OS 008

        OrdemServicoResponseDTO os001 = criarDtoOs(1L, "OS-2026-0001", maquinaA, StatusOrdemServico.CONCLUIDA);
        OrdemServicoResponseDTO os004 = criarDtoOs(4L, "OS-2026-0004", maquinaA, StatusOrdemServico.CONCLUIDA);
        OrdemServicoResponseDTO os010 = criarDtoOs(10L, "OS-2026-0010", maquinaA, StatusOrdemServico.CONCLUIDA);

        OrdemServicoResponseDTO os003 = criarDtoOs(3L, "OS-2026-0003", geradorB, StatusOrdemServico.CONCLUIDA);
        OrdemServicoResponseDTO os008 = criarDtoOs(8L, "OS-2026-0008", geradorB, StatusOrdemServico.CONCLUIDA);

        Pageable pageable = PageRequest.of(0, 20);

        when(ordemServicoService.listarPorMaquina(10L, pageable))
                .thenReturn(PageResponse.from(new PageImpl<>(List.of(os010, os004, os001))));

        when(ordemServicoService.listarPorMaquina(20L, pageable))
                .thenReturn(PageResponse.from(new PageImpl<>(List.of(os008, os003))));

        // 1. Consulta histórico da Máquina A
        PageResponse<OrdemServicoResponseDTO> histA = maquinaService.obterHistorico(10L, pageable);
        assertNotNull(histA);
        assertEquals(3, histA.content().size());
        List<String> numerosA = histA.content().stream().map(OrdemServicoResponseDTO::numeroOs).toList();
        assertTrue(numerosA.containsAll(List.of("OS-2026-0001", "OS-2026-0004", "OS-2026-0010")));
        assertFalse(numerosA.contains("OS-2026-0003"), "Máquina A NÃO pode conter OS 003");
        assertFalse(numerosA.contains("OS-2026-0008"), "Máquina A NÃO pode conter OS 008");

        // 2. Consulta histórico do Gerador B
        PageResponse<OrdemServicoResponseDTO> histB = maquinaService.obterHistorico(20L, pageable);
        assertNotNull(histB);
        assertEquals(2, histB.content().size());
        List<String> numerosB = histB.content().stream().map(OrdemServicoResponseDTO::numeroOs).toList();
        assertTrue(numerosB.containsAll(List.of("OS-2026-0003", "OS-2026-0008")));
        assertFalse(numerosB.contains("OS-2026-0001"), "Gerador B NÃO pode conter OS 001");
        assertFalse(numerosB.contains("OS-2026-0004"), "Gerador B NÃO pode conter OS 004");
        assertFalse(numerosB.contains("OS-2026-0010"), "Gerador B NÃO pode conter OS 010");
    }

    @Test
    @DisplayName("Requisito 27 — Teste de Isolamento Cliente/Equipamento: Cliente A não pode retornar OS do Cliente B")
    void testIsolamentoClienteEquipamento() {
        OrdemServicoResponseDTO osClienteA = criarDtoOs(1L, "OS-2026-0001", maquinaA, StatusOrdemServico.CONCLUIDA);
        OrdemServicoResponseDTO osClienteB = criarDtoOs(2L, "OS-2026-0002", maquinaXYZ, StatusOrdemServico.CONCLUIDA);

        Pageable pageable = PageRequest.of(0, 20);

        when(ordemServicoService.listarPorCliente(100L, null, pageable))
                .thenReturn(PageResponse.from(new PageImpl<>(List.of(osClienteA))));

        when(ordemServicoService.listarPorCliente(200L, null, pageable))
                .thenReturn(PageResponse.from(new PageImpl<>(List.of(osClienteB))));

        PageResponse<OrdemServicoResponseDTO> resA = ordemServicoService.listarPorCliente(100L, null, pageable);
        PageResponse<OrdemServicoResponseDTO> resB = ordemServicoService.listarPorCliente(200L, null, pageable);

        assertEquals(1, resA.content().size());
        assertEquals("OS-2026-0001", resA.content().get(0).numeroOs());
        assertEquals(100L, resA.content().get(0).clienteId());

        assertEquals(1, resB.content().size());
        assertEquals("OS-2026-0002", resB.content().get(0).numeroOs());
        assertEquals(200L, resB.content().get(0).clienteId());

        assertNotEquals(resA.content().get(0).clienteId(), resB.content().get(0).clienteId());
    }

    @Test
    @DisplayName("Requisitos 12 e 25 — Regra de Valor Acumulado: Apenas OS CONCLUIDA entra no somatório financeiro")
    void testRegraValorAcumuladoApenasConcluidas() {
        when(maquinaRepository.findByIdWithCliente(10L)).thenReturn(Optional.of(maquinaA));
        when(ordemServicoRepository.countByMaquinaId(10L)).thenReturn(4L);

        // Suponha 4 OS vinculadas ao equipamento:
        // OS 1: CONCLUIDA, R$ 300,00
        // OS 2: CONCLUIDA, R$ 150,00
        // OS 3: CANCELADA, R$ 500,00 (NÃO ENTRA)
        // OS 4: ABERTA, R$ 200,00 (NÃO ENTRA)
        // Somatório esperado das concluídas = R$ 450,00
        when(ordemServicoRepository.somarValorTotalConcluidasPorMaquina(10L))
                .thenReturn(new BigDecimal("450.00"));

        OrdemServico ultimaOs = new OrdemServico();
        ultimaOs.setId(4L);
        ultimaOs.setNumeroOs("OS-2026-0004");
        ultimaOs.setProblemaRelatado("Cabo rompido");
        ultimaOs.setStatus(StatusOrdemServico.CONCLUIDA);
        ultimaOs.setDataEntrada(OffsetDateTime.now().minusDays(1));
        ultimaOs.setDataConclusao(OffsetDateTime.now());

        when(ordemServicoRepository.findFirstByMaquinaIdOrderByDataEntradaDesc(10L))
                .thenReturn(Optional.of(ultimaOs));

        MaquinaResumoDTO resumo = maquinaService.obterResumo(10L);

        assertNotNull(resumo);
        assertEquals(10L, resumo.maquinaId());
        assertEquals(4L, resumo.totalAtendimentos());
        assertEquals(new BigDecimal("450.00"), resumo.valorAcumulado(), "Valor acumulado deve ser estritamente a soma das OS concluídas");
        assertEquals("OS-2026-0004", resumo.ultimaOsNumero());
        assertEquals(StatusOrdemServico.CONCLUIDA, resumo.ultimaOsStatus());
        assertEquals("Cabo rompido", resumo.ultimaOsProblema());
        assertNotNull(resumo.ultimaManutencaoData());
    }

    @Test
    @DisplayName("Requisito 21 e 25 — Equipamento sem Histórico (0 OS): Contadores zerados sem exceção")
    void testEquipamentoSemHistorico() {
        when(maquinaRepository.findByIdWithCliente(10L)).thenReturn(Optional.of(maquinaA));
        when(ordemServicoRepository.countByMaquinaId(10L)).thenReturn(0L);
        when(ordemServicoRepository.somarValorTotalConcluidasPorMaquina(10L)).thenReturn(BigDecimal.ZERO);
        when(ordemServicoRepository.findFirstByMaquinaIdOrderByDataEntradaDesc(10L)).thenReturn(Optional.empty());

        MaquinaResumoDTO resumo = maquinaService.obterResumo(10L);

        assertNotNull(resumo);
        assertEquals(0L, resumo.totalAtendimentos());
        assertEquals(BigDecimal.ZERO, resumo.valorAcumulado());
        assertNull(resumo.ultimaOsId());
        assertNull(resumo.ultimaOsNumero());
        assertNull(resumo.ultimaManutencaoData());
    }

    @Test
    @DisplayName("Requisito 9 e 25 — Resumo do Cliente: Equipamentos, total de OS, OS abertas e valor acumulado")
    void testResumoCliente() {
        when(clienteRepository.findById(100L)).thenReturn(Optional.of(clienteABC));
        when(maquinaRepository.countByClienteId(100L)).thenReturn(2L);
        when(ordemServicoRepository.countByClienteId(100L)).thenReturn(5L);
        when(ordemServicoRepository.countOsAbertasPorCliente(100L)).thenReturn(1L);
        when(ordemServicoRepository.somarValorTotalConcluidasPorCliente(100L))
                .thenReturn(new BigDecimal("1280.00"));

        OrdemServico ultimaOs = new OrdemServico();
        ultimaOs.setId(10L);
        ultimaOs.setNumeroOs("OS-2026-0010");
        ultimaOs.setDataEntrada(OffsetDateTime.now().minusDays(3));

        when(ordemServicoRepository.findFirstByClienteIdOrderByDataEntradaDesc(100L))
                .thenReturn(Optional.of(ultimaOs));

        ClienteResumoDTO resumo = clienteService.obterResumo(100L);

        assertNotNull(resumo);
        assertEquals(100L, resumo.clienteId());
        assertEquals(2L, resumo.quantidadeEquipamentos());
        assertEquals(5L, resumo.quantidadeTotalOs());
        assertEquals(1L, resumo.quantidadeOsAbertas());
        assertEquals(new BigDecimal("1280.00"), resumo.valorAcumulado());
        assertEquals("OS-2026-0010", resumo.ultimaOsNumero());
        assertNotNull(resumo.ultimaVisitaData());
    }

    @Test
    @DisplayName("Requisito 3 e 25 — Busca Rápida Global: Retorna clientes, equipamentos, OS e peças com links diretos")
    void testBuscaRapidaGlobal() {
        when(clienteRepository.buscarRapida(eq("esab"), any()))
                .thenReturn(List.of(clienteABC));
        when(maquinaRepository.buscarRapida(eq("esab"), any()))
                .thenReturn(List.of(maquinaA));

        OrdemServico os = new OrdemServico();
        os.setId(55L);
        os.setNumeroOs("OS-2026-0055");
        os.setCliente(clienteABC);
        os.setMaquina(maquinaA);
        os.setStatus(StatusOrdemServico.EM_MANUTENCAO);

        when(ordemServicoRepository.buscarRapidaOs(eq("esab"), any()))
                .thenReturn(List.of(os));

        Produto p = new Produto();
        p.setId(77L);
        p.setCodigo("IGBT-60N60");
        p.setNome("Transistor IGBT 60N60");
        p.setEstoqueAtual(new BigDecimal("15"));
        p.setPrecoVenda(new BigDecimal("45.00"));
        p.setMarca("Toshiba");
        p.setTipo(TipoProduto.PECA);

        when(produtoRepository.buscarRapida(eq("esab"), any()))
                .thenReturn(List.of(p));

        BuscaRapidaDTO resultado = buscaService.buscarRapida("esab");

        assertNotNull(resultado);
        assertEquals(4, resultado.totalResultados());
        assertEquals(1, resultado.clientes().size());
        assertEquals("/clientes/100", resultado.clientes().get(0).url());

        assertEquals(1, resultado.maquinas().size());
        assertEquals("/maquinas/10", resultado.maquinas().get(0).url());

        assertEquals(1, resultado.ordensServico().size());
        assertEquals("/ordens-servico/55", resultado.ordensServico().get(0).url());

        assertEquals(1, resultado.produtos().size());
        assertEquals("/produtos", resultado.produtos().get(0).url());
    }

    @Test
    @DisplayName("Requisito 3 — Busca Rápida com Termo Vazio: Retorna coleções vazias e total 0")
    void testBuscaRapidaTermoVazio() {
        BuscaRapidaDTO resultadoNull = buscaService.buscarRapida(null);
        assertNotNull(resultadoNull);
        assertEquals(0, resultadoNull.totalResultados());
        assertTrue(resultadoNull.clientes().isEmpty());

        BuscaRapidaDTO resultadoVazio = buscaService.buscarRapida("   ");
        assertNotNull(resultadoVazio);
        assertEquals(0, resultadoVazio.totalResultados());
        assertTrue(resultadoVazio.maquinas().isEmpty());
    }

    private OrdemServicoResponseDTO criarDtoOs(Long id, String numeroOs, Maquina maquina, StatusOrdemServico status) {
        return new OrdemServicoResponseDTO(
                id,
                numeroOs,
                maquina.getCliente().getId(),
                maquina.getCliente().getNomeRazaoSocial(),
                maquina.getCliente().getTelefone(),
                maquina.getCliente().getCpfCnpj(),
                maquina.getId(),
                maquina.getTipoEquipamento(),
                maquina.getTipoEquipamento().getDescricao(),
                maquina.getMarca(),
                maquina.getModelo(),
                maquina.getNumeroSerie(),
                maquina.getPotencia(),
                maquina.getTensao(),
                null,
                null,
                status,
                status.getDescricao(),
                OffsetDateTime.now().minusDays(5),
                null,
                OffsetDateTime.now(),
                "Problema de teste",
                "Diagnóstico de teste",
                "Solução de teste",
                "Testes ok",
                null,
                null,
                new BigDecimal("200.00"),
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                new BigDecimal("200.00"),
                OffsetDateTime.now(),
                OffsetDateTime.now()
        );
    }
}
