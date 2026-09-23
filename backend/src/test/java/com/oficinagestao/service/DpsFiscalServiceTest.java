package com.oficinagestao.service;

import com.oficinagestao.dto.DpsFiscalCreateDTO;
import com.oficinagestao.dto.DpsFiscalResponseDTO;
import com.oficinagestao.entity.*;
import com.oficinagestao.exception.BusinessException;
import com.oficinagestao.exception.ResourceNotFoundException;
import com.oficinagestao.repository.ClienteRepository;
import com.oficinagestao.repository.DpsFiscalRepository;
import com.oficinagestao.repository.DpsNumeracaoRepository;
import com.oficinagestao.repository.OrdemServicoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DpsFiscalServiceTest {

    @Mock
    private DpsFiscalRepository dpsFiscalRepository;

    @Mock
    private DpsNumeracaoRepository dpsNumeracaoRepository;

    @Mock
    private OrdemServicoRepository ordemServicoRepository;

    @Mock
    private ClienteRepository clienteRepository;

    @Mock
    private ConfiguracaoOficinaService configuracaoOficinaService;

    @Mock
    private AuditoriaService auditoriaService;

    @InjectMocks
    private DpsFiscalService dpsFiscalService;

    private Cliente clienteMock;
    private OrdemServico osMock;
    private ConfiguracaoOficina prestadorMock;
    private DpsNumeracao numeracaoMock;

    @BeforeEach
    void setUp() {
        clienteMock = new Cliente();
        clienteMock.setId(10L);
        clienteMock.setTipoPessoa(TipoPessoa.JURIDICA);
        clienteMock.setNomeRazaoSocial("Cliente Teste LTDA");
        clienteMock.setCpfCnpj("12345678000190");
        clienteMock.setEmail("contato@cliente.com");
        clienteMock.setCodigoIbge("3534708");

        Endereco enderecoMock = new Endereco();
        enderecoMock.setLogradouro("Rua das Flores");
        enderecoMock.setNumero("123");
        enderecoMock.setBairro("Centro");
        enderecoMock.setCidade("Ourinhos");
        enderecoMock.setEstado("SP");
        enderecoMock.setCep("19900-000");
        enderecoMock.setTipoEndereco(TipoEndereco.PRINCIPAL);
        clienteMock.adicionarEndereco(enderecoMock);

        osMock = new OrdemServico();
        osMock.setId(100L);
        osMock.setNumeroOs("OS-2026-0001");
        osMock.setCliente(clienteMock);
        osMock.setValorMaoObra(new BigDecimal("350.00"));
        osMock.setValorTotal(new BigDecimal("500.00"));
        osMock.setProblemaRelatado("Inversora não liga");
        osMock.setSolucaoAplicada("Substituição de diodos e testes de carga");

        prestadorMock = new ConfiguracaoOficina();
        prestadorMock.setNomeEmpresarial("45.076.507 BRUNO SOARES RODRIGUES");
        prestadorMock.setNomeFantasia("Bruno Soldas");
        prestadorMock.setCnpj("45.076.507/0001-67");
        prestadorMock.setInscricaoMunicipal(null); // Explicitamente null
        prestadorMock.setRegimeTributario("Simples Nacional / MEI");
        prestadorMock.setCodigoTributacaoServico("14.01.01");
        prestadorMock.setMunicipio("Ourinhos");
        prestadorMock.setUf("SP");
        prestadorMock.setCodigoIbge("35.34708");

        numeracaoMock = new DpsNumeracao("1", 4L);
    }

    @Test
    @DisplayName("Deve preparar DPS com sucesso, gerando snapshots e numeração sequencial")
    void devePrepararDpsComSucesso() {
        DpsFiscalCreateDTO dto = new DpsFiscalCreateDTO(100L, "1", null);

        when(ordemServicoRepository.findById(100L)).thenReturn(Optional.of(osMock));
        when(clienteRepository.findByIdWithEnderecos(10L)).thenReturn(Optional.of(clienteMock));
        when(configuracaoOficinaService.obterEntidade()).thenReturn(prestadorMock);
        when(dpsNumeracaoRepository.findBySerieWithLock("1")).thenReturn(Optional.of(numeracaoMock));
        when(dpsFiscalRepository.save(any(DpsFiscal.class))).thenAnswer(invocation -> {
            DpsFiscal d = invocation.getArgument(0);
            d.setId(1L);
            return d;
        });

        DpsFiscalResponseDTO response = dpsFiscalService.prepararDps(dto, 1L, "127.0.0.1");

        assertNotNull(response);
        assertEquals("1", response.serie());
        assertEquals(5L, response.numero()); // 4 + 1
        assertEquals(StatusDpsFiscal.PREPARADA, response.status());
        assertEquals(new BigDecimal("350.00"), response.valorServico());
        assertEquals("14.01.01", response.codigoTributacaoServico());

        // Validação do snapshot do prestador
        assertEquals("45.076.507/0001-67", response.prestadorCnpj());
        assertEquals("Bruno Soldas", response.prestadorNomeFantasia());
        assertNull(response.prestadorInscricaoMunicipal()); // Inscrição Municipal null preservada!

        // Validação do snapshot do tomador
        assertEquals("Cliente Teste LTDA", response.tomadorRazaoSocial());
        assertEquals("12345678000190", response.tomadorCpfCnpj());
        assertEquals("3534708", response.tomadorCodigoIbge());

        // Verificação do incremento da numeração
        assertEquals(5L, numeracaoMock.getUltimoNumero());
        verify(dpsNumeracaoRepository).save(numeracaoMock);
        verify(auditoriaService).registrar(eq(1L), eq("DpsFiscal"), eq("1"), eq("INSERT"), eq("127.0.0.1"));
    }

    @Test
    @DisplayName("Deve preparar DPS com cliente que não possui código IBGE cadastrado (aceitar nulo)")
    void devePrepararDpsComClienteSemCodigoIbge() {
        clienteMock.setCodigoIbge(null);
        DpsFiscalCreateDTO dto = new DpsFiscalCreateDTO(100L, null, "Serviço de solda especializado");

        when(ordemServicoRepository.findById(100L)).thenReturn(Optional.of(osMock));
        when(clienteRepository.findByIdWithEnderecos(10L)).thenReturn(Optional.of(clienteMock));
        when(configuracaoOficinaService.obterEntidade()).thenReturn(prestadorMock);
        when(dpsNumeracaoRepository.findBySerieWithLock("1")).thenReturn(Optional.of(numeracaoMock));
        when(dpsFiscalRepository.save(any(DpsFiscal.class))).thenAnswer(invocation -> invocation.getArgument(0));

        DpsFiscalResponseDTO response = dpsFiscalService.prepararDps(dto, 2L, "192.168.1.50");

        assertNotNull(response);
        assertNull(response.tomadorCodigoIbge());
        assertEquals("Serviço de solda especializado", response.descricaoServico());
    }

    @Test
    @DisplayName("Deve falhar ao tentar preparar DPS para Ordem de Serviço inexistente")
    void deveFalharParaOsInexistente() {
        DpsFiscalCreateDTO dto = new DpsFiscalCreateDTO(999L, "1", null);
        when(ordemServicoRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () ->
                dpsFiscalService.prepararDps(dto, 1L, "127.0.0.1")
        );
        verify(dpsFiscalRepository, never()).save(any());
    }

    @Test
    @DisplayName("Deve falhar ao tentar preparar DPS para Ordem de Serviço sem valor de serviço")
    void deveFalharParaOsSemValorDeServico() {
        osMock.setValorMaoObra(BigDecimal.ZERO);
        osMock.setValorTotal(BigDecimal.ZERO);
        DpsFiscalCreateDTO dto = new DpsFiscalCreateDTO(100L, "1", null);

        when(ordemServicoRepository.findById(100L)).thenReturn(Optional.of(osMock));
        when(clienteRepository.findByIdWithEnderecos(10L)).thenReturn(Optional.of(clienteMock));
        when(configuracaoOficinaService.obterEntidade()).thenReturn(prestadorMock);

        assertThrows(BusinessException.class, () ->
                dpsFiscalService.prepararDps(dto, 1L, "127.0.0.1")
        );
        verify(dpsFiscalRepository, never()).save(any());
    }

    @Test
    @DisplayName("Deve obter DPS existente por ID")
    void deveObterPorId() {
        DpsFiscal dps = new DpsFiscal();
        dps.setId(15L);
        dps.setSerie("1");
        dps.setNumero(101L);
        dps.setStatus(StatusDpsFiscal.PREPARADA);
        dps.setOrdemServico(osMock);
        dps.setCliente(clienteMock);
        dps.setValorServico(new BigDecimal("200.00"));
        dps.setCodigoTributacaoServico("14.01.01");
        dps.setDescricaoServico("Reparo elétrico");

        when(dpsFiscalRepository.findById(15L)).thenReturn(Optional.of(dps));

        DpsFiscalResponseDTO dto = dpsFiscalService.obterPorId(15L);

        assertNotNull(dto);
        assertEquals(15L, dto.id());
        assertEquals("1", dto.serie());
        assertEquals(101L, dto.numero());
    }

    @Test
    @DisplayName("Deve obter DPS vinculada a uma Ordem de Serviço")
    void deveObterPorOrdemServicoId() {
        DpsFiscal dps = new DpsFiscal();
        dps.setId(20L);
        dps.setSerie("1");
        dps.setNumero(102L);
        dps.setStatus(StatusDpsFiscal.PREPARADA);
        dps.setOrdemServico(osMock);
        dps.setCliente(clienteMock);
        dps.setValorServico(new BigDecimal("450.00"));
        dps.setCodigoTributacaoServico("14.01.01");
        dps.setDescricaoServico("Rebobinamento");

        when(dpsFiscalRepository.findTopByOrdemServicoIdOrderByDataEmissaoDesc(100L)).thenReturn(Optional.of(dps));

        DpsFiscalResponseDTO dto = dpsFiscalService.obterPorOrdemServicoId(100L);

        assertNotNull(dto);
        assertEquals(20L, dto.id());
        assertEquals(100L, dto.ordemServicoId());
    }
}
