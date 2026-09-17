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
        Page<Cliente> pageMock = new PageImpl<>(List.of(cliente));

        when(clienteRepository.pesquisar(eq("000.140.140-00"), eq("00014014000"), isNull(), isNull(), eq(pageable)))
                .thenReturn(pageMock);
        when(maquinaRepository.countByClienteId(any())).thenReturn(2L);

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
