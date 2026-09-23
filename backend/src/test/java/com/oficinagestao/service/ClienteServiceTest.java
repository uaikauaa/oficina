package com.oficinagestao.service;

import com.oficinagestao.dto.ClienteContadoresStatusDTO;
import com.oficinagestao.dto.ClienteResponseDTO;
import com.oficinagestao.dto.PageResponse;
import com.oficinagestao.entity.Cliente;
import com.oficinagestao.entity.TipoPessoa;
import com.oficinagestao.repository.ClienteRepository;
import com.oficinagestao.repository.MaquinaRepository;
import com.oficinagestao.repository.OrdemServicoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ClienteServiceTest {

    @Mock
    private ClienteRepository clienteRepository;

    @Mock
    private AuditoriaService auditoriaService;

    @Mock
    private MaquinaRepository maquinaRepository;

    @Mock
    private OrdemServicoRepository ordemServicoRepository;

    private ClienteService clienteService;

    @BeforeEach
    void setUp() {
        clienteService = new ClienteService(
                clienteRepository,
                auditoriaService,
                maquinaRepository,
                ordemServicoRepository
        );
    }

    @Test
    @DisplayName("Deve obter contadores operacionais de status e tipo de cliente com sucesso")
    void deveObterContadoresStatusComSucesso() {
        ClienteContadoresStatusDTO contadoresEsperados = new ClienteContadoresStatusDTO(15L, 10L, 5L, 14L, 1L);
        when(clienteRepository.obterContadoresStatus()).thenReturn(contadoresEsperados);

        ClienteContadoresStatusDTO resultado = clienteService.obterContadoresStatus();

        assertNotNull(resultado);
        assertEquals(15L, resultado.total());
        assertEquals(10L, resultado.pessoaFisica());
        assertEquals(5L, resultado.pessoaJuridica());
        assertEquals(14L, resultado.ativos());
        assertEquals(1L, resultado.inativos());
        verify(clienteRepository, times(1)).obterContadoresStatus();
    }

    @Test
    @DisplayName("Deve normalizar CPF com máscara e passar termoDigitos correto para o repository")
    void deveNormalizarCpfComMascaraNaBusca() {
        String cpfMascarado = "000.140.140-00";
        Pageable pageable = PageRequest.of(0, 15);

        Cliente cliente = new Cliente(TipoPessoa.FISICA, "João da Silva", null, "00014014000", null, null, null, null, null);
        org.springframework.test.util.ReflectionTestUtils.setField(cliente, "id", 1L);
        Page<Cliente> pageMock = new PageImpl<>(List.of(cliente));

        when(clienteRepository.pesquisar(eq("000.140.140-00"), eq("00014014000"), isNull(), isNull(), eq(pageable)))
                .thenReturn(pageMock);
        when(maquinaRepository.countByClienteIds(List.of(1L))).thenReturn(List.<Object[]>of(new Object[]{1L, 2L}));
        when(clienteRepository.findEnderecosByClienteIds(List.of(1L))).thenReturn(java.util.Collections.emptyList());

        PageResponse<ClienteResponseDTO> response = clienteService.listar(cpfMascarado, null, null, pageable);

        assertNotNull(response);
        assertEquals(1, response.content().size());
        assertEquals("João da Silva", response.content().get(0).nomeRazaoSocial());
        assertEquals(2L, response.content().get(0).totalEquipamentos());

        ArgumentCaptor<String> termoCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> digitosCaptor = ArgumentCaptor.forClass(String.class);

        verify(clienteRepository).pesquisar(termoCaptor.capture(), digitosCaptor.capture(), isNull(), isNull(), eq(pageable));
        assertEquals("000.140.140-00", termoCaptor.getValue());
        assertEquals("00014014000", digitosCaptor.getValue());
        verify(maquinaRepository, never()).countByClienteId(any());
    }

    @Test
    @DisplayName("Deve listar múltiplos clientes eliminando N+1 via consultas em lote para equipamentos e endereços")
    void deveListarMultiplosClientesEliminandoNPlus1() {
        Pageable pageable = PageRequest.of(0, 10);

        Cliente c1 = new Cliente(TipoPessoa.FISICA, "Cliente Um", null, "11111111111", null, null, null, null, null);
        org.springframework.test.util.ReflectionTestUtils.setField(c1, "id", 10L);

        Cliente c2 = new Cliente(TipoPessoa.JURIDICA, "Cliente Dois LTDA", null, "22222222000122", null, null, null, null, null);
        org.springframework.test.util.ReflectionTestUtils.setField(c2, "id", 20L);

        com.oficinagestao.entity.Endereco endC1 = new com.oficinagestao.entity.Endereco("30000000", "Rua A", "100", null, "Bairro A", "Belo Horizonte", "MG", com.oficinagestao.entity.TipoEndereco.PRINCIPAL);
        endC1.setCliente(c1);

        Page<Cliente> pageMock = new PageImpl<>(List.of(c1, c2), pageable, 2);

        when(clienteRepository.pesquisar(isNull(), isNull(), isNull(), isNull(), eq(pageable)))
                .thenReturn(pageMock);
        when(maquinaRepository.countByClienteIds(List.of(10L, 20L)))
                .thenReturn(List.<Object[]>of(new Object[]{10L, 3L}, new Object[]{20L, 1L}));
        when(clienteRepository.findEnderecosByClienteIds(List.of(10L, 20L)))
                .thenReturn(List.of(endC1));

        PageResponse<ClienteResponseDTO> response = clienteService.listar(null, null, null, pageable);

        assertNotNull(response);
        assertEquals(2, response.content().size());

        ClienteResponseDTO dto1 = response.content().get(0);
        assertEquals(10L, dto1.id());
        assertEquals("Cliente Um", dto1.nomeRazaoSocial());
        assertEquals(3L, dto1.totalEquipamentos());
        assertEquals(1, dto1.enderecos().size());
        assertEquals("Rua A", dto1.enderecos().get(0).logradouro());

        ClienteResponseDTO dto2 = response.content().get(1);
        assertEquals(20L, dto2.id());
        assertEquals("Cliente Dois LTDA", dto2.nomeRazaoSocial());
        assertEquals(1L, dto2.totalEquipamentos());
        assertTrue(dto2.enderecos().isEmpty());

        // Verificação crucial de ausência de N+1:
        verify(maquinaRepository, times(1)).countByClienteIds(List.of(10L, 20L));
        verify(clienteRepository, times(1)).findEnderecosByClienteIds(List.of(10L, 20L));
        verify(maquinaRepository, never()).countByClienteId(any());
    }

    @Test
    @DisplayName("Deve retornar página vazia sem executar queries de lote quando não houver clientes")
    void deveRetornarPaginaVaziaSemExecutarQueriesLote() {
        Pageable pageable = PageRequest.of(0, 10);
        Page<Cliente> pageMock = Page.empty(pageable);

        when(clienteRepository.pesquisar(isNull(), isNull(), isNull(), isNull(), eq(pageable)))
                .thenReturn(pageMock);

        PageResponse<ClienteResponseDTO> response = clienteService.listar(null, null, null, pageable);

        assertNotNull(response);
        assertTrue(response.content().isEmpty());
        assertEquals(0, response.totalElements());
        verify(maquinaRepository, never()).countByClienteIds(any());
        verify(clienteRepository, never()).findEnderecosByClienteIds(any());
        verify(maquinaRepository, never()).countByClienteId(any());
    }

    @Test
    @DisplayName("Deve listar clientes filtrando por status ativo ou inativo")
    void deveListarClientesFiltrandoPorStatusAtivoOuInativo() {
        Pageable pageable = PageRequest.of(0, 10);
        Page<Cliente> pageMock = Page.empty(pageable);

        when(clienteRepository.pesquisar(isNull(), isNull(), isNull(), eq(true), eq(pageable)))
                .thenReturn(pageMock);
        when(clienteRepository.pesquisar(isNull(), isNull(), isNull(), eq(false), eq(pageable)))
                .thenReturn(pageMock);

        PageResponse<ClienteResponseDTO> ativos = clienteService.listar(null, null, true, pageable);
        PageResponse<ClienteResponseDTO> inativos = clienteService.listar(null, null, false, pageable);

        assertNotNull(ativos);
        assertNotNull(inativos);
        verify(clienteRepository).pesquisar(isNull(), isNull(), isNull(), eq(true), eq(pageable));
        verify(clienteRepository).pesquisar(isNull(), isNull(), isNull(), eq(false), eq(pageable));
    }

    @Test
    @DisplayName("Deve normalizar telefone com máscara e passar termoDigitos correto para o repository")
    void deveNormalizarTelefoneComMascaraNaBusca() {
        String telefoneMascarado = "(31) 99999-0000";
        Pageable pageable = PageRequest.of(0, 15);

        Cliente cliente = new Cliente(TipoPessoa.FISICA, "Maria Souza", null, null, null, null, "31999990000", null, null);
        Page<Cliente> pageMock = new PageImpl<>(List.of(cliente));

        when(clienteRepository.pesquisar(eq("(31) 99999-0000"), eq("31999990000"), isNull(), isNull(), eq(pageable)))
                .thenReturn(pageMock);

        PageResponse<ClienteResponseDTO> response = clienteService.listar(telefoneMascarado, null, null, pageable);

        assertNotNull(response);
        assertEquals(1, response.content().size());
        assertEquals("Maria Souza", response.content().get(0).nomeRazaoSocial());

        verify(clienteRepository).pesquisar(eq("(31) 99999-0000"), eq("31999990000"), isNull(), isNull(), eq(pageable));
    }

    @Test
    @DisplayName("Deve buscar por nome sem alterar termo e com termoDigitos nulo")
    void deveBuscarPorNomeSemDigitos() {
        String nome = "Metalúrgica Aço Forte";
        Pageable pageable = PageRequest.of(0, 15);

        Cliente cliente = new Cliente(TipoPessoa.JURIDICA, "Metalúrgica Aço Forte LTDA", "Aço Forte", "12345678000199", null, null, null, null, null);
        Page<Cliente> pageMock = new PageImpl<>(List.of(cliente));

        when(clienteRepository.pesquisar(eq("Metalúrgica Aço Forte"), isNull(), isNull(), isNull(), eq(pageable)))
                .thenReturn(pageMock);

        PageResponse<ClienteResponseDTO> response = clienteService.listar(nome, null, null, pageable);

        assertNotNull(response);
        assertEquals(1, response.content().size());
        assertEquals("Metalúrgica Aço Forte LTDA", response.content().get(0).nomeRazaoSocial());

        verify(clienteRepository).pesquisar(eq("Metalúrgica Aço Forte"), isNull(), isNull(), isNull(), eq(pageable));
    }

    @Test
    @DisplayName("Deve testar a função utilitária apenasDigitos")
    void deveTestarApenasDigitos() {
        assertNull(ClienteService.apenasDigitos(null));
        assertNull(ClienteService.apenasDigitos(""));
        assertNull(ClienteService.apenasDigitos("   "));
        assertNull(ClienteService.apenasDigitos("abc"));
        assertEquals("00014014000", ClienteService.apenasDigitos("000.140.140-00"));
        assertEquals("31999990000", ClienteService.apenasDigitos("(31) 99999-0000"));
        assertEquals("12345678000199", ClienteService.apenasDigitos("12.345.678/0001-99"));
    }
}
