package com.oficinagestao.service;

import com.oficinagestao.controller.OrdemServicoController;
import com.oficinagestao.entity.OrdemServico;
import com.oficinagestao.exception.ConfiguracaoOficinaIndisponivelException;
import com.oficinagestao.exception.GlobalExceptionHandler;
import com.oficinagestao.repository.ClienteRepository;
import com.oficinagestao.repository.ConfiguracaoOficinaRepository;
import com.oficinagestao.repository.EstoqueMovimentacaoRepository;
import com.oficinagestao.repository.MaquinaRepository;
import com.oficinagestao.repository.OrdemServicoItemRepository;
import com.oficinagestao.repository.OrdemServicoRepository;
import com.oficinagestao.repository.ProdutoRepository;
import com.oficinagestao.repository.UsuarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Real document consumers with mocked repositories; no Spring application or datasource. */
class PdfConfiguracaoOficinaIsolationTest {
    private final ConfiguracaoOficinaRepository configRepository = mock(ConfiguracaoOficinaRepository.class);
    private final PdfService pdfService = new PdfService();

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(pdfService, "configuracaoOficinaService",
                new ConfiguracaoOficinaService(configRepository));
        when(configRepository.findAll(any(Pageable.class))).thenReturn(Page.empty());
    }

    @ParameterizedTest
    @ValueSource(strings = { "pdf", "documento-servico", "recibo" })
    void missingConfigurationStopsBeforeReadingDocumentData(String documentType) {
        OrdemServico os = mock(OrdemServico.class);

        var error = assertThrows(ConfiguracaoOficinaIndisponivelException.class, () -> {
            switch (documentType) {
                case "pdf" -> pdfService.gerarOrdemServicoPdf(os, List.of());
                case "documento-servico" -> pdfService.gerarDocumentoServicoPdf(os, List.of());
                case "recibo" -> pdfService.gerarReciboOsPdf(os, List.of());
                default -> fail("Unexpected document type");
            }
        });

        assertEquals("OFICINA_CONFIG_MISSING", error.getCode());
        verifyNoInteractions(os);
        verifyConfigWasOnlyRead();
    }

    @ParameterizedTest
    @ValueSource(strings = { "pdf", "documento-servico", "recibo" })
    void documentEndpointReturnsJson503EvenWhenClientAcceptsPdfWithoutPriorWrites(String documentType) throws Exception {
        var osRepository = mock(OrdemServicoRepository.class);
        var itemsRepository = mock(OrdemServicoItemRepository.class);
        var clients = mock(ClienteRepository.class);
        var machines = mock(MaquinaRepository.class);
        var audit = mock(AuditoriaService.class);
        var products = mock(ProdutoRepository.class);
        var movements = mock(EstoqueMovimentacaoRepository.class);
        var users = mock(UsuarioRepository.class);
        var notifications = mock(NotificacaoService.class);
        var itemService = mock(OrdemServicoItemService.class);
        OrdemServico os = new OrdemServico();
        os.setId(91L);
        os.setNumeroOs("OS-SINTETICA-91");
        when(osRepository.findByIdWithClienteAndMaquina(91L)).thenReturn(Optional.of(os));
        when(itemsRepository.findByOrdemServicoIdComProduto(91L)).thenReturn(List.of());
        var service = new OrdemServicoService(osRepository, clients, machines, audit, itemsRepository,
                products, movements, users, pdfService, notifications);
        var mvc = MockMvcBuilders.standaloneSetup(new OrdemServicoController(service, itemService))
                .setControllerAdvice(new GlobalExceptionHandler()).build();

        mvc.perform(get("/api/ordens-servico/91/" + documentType).accept(MediaType.APPLICATION_PDF))
                .andExpect(status().isServiceUnavailable())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(header().doesNotExist("Content-Disposition"))
                .andExpect(jsonPath("$.status").value(503))
                .andExpect(jsonPath("$.error").value("OFICINA_CONFIG_MISSING"))
                .andExpect(jsonPath("$.message").value(ConfiguracaoOficinaIndisponivelException.PUBLIC_MESSAGE))
                .andExpect(jsonPath("$.stackTrace").doesNotExist());

        verifyConfigWasOnlyRead();
        verify(osRepository).findByIdWithClienteAndMaquina(91L);
        verify(itemsRepository).findByOrdemServicoIdComProduto(91L);
        verifyNoMoreInteractions(osRepository, itemsRepository);
        verifyNoInteractions(clients, machines, audit, products, movements, users, notifications, itemService);
    }

    private void verifyConfigWasOnlyRead() {
        verify(configRepository).findAll(any(Pageable.class));
        verify(configRepository, never()).save(any());
        verifyNoMoreInteractions(configRepository);
    }
}
