package com.oficinagestao.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.oficinagestao.entity.ConfiguracaoOficina;
import com.oficinagestao.exception.ConfiguracaoOficinaIndisponivelException;
import com.oficinagestao.exception.GlobalExceptionHandler;
import com.oficinagestao.repository.ConfiguracaoOficinaRepository;
import com.oficinagestao.service.ConfiguracaoOficinaService;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** MVC standalone: real controller/service/advice, mocked persistence; no security-chain claim. */
class ConfiguracaoOficinaHttpIsolationTest {
    private static final String MESSAGE = "A configuração da oficina está indisponível. Solicite a recuperação administrativa dos dados.";
    private final ConfiguracaoOficinaRepository repository = mock(ConfiguracaoOficinaRepository.class);
    private final MockMvc mvc = MockMvcBuilders.standaloneSetup(
            new ConfiguracaoOficinaController(new ConfiguracaoOficinaService(repository)))
            .setControllerAdvice(new GlobalExceptionHandler()).build();

    @Test
    void missingGetReturnsSanitized503WithoutCreatingData() throws Exception {
        when(repository.findAll(any(Pageable.class))).thenReturn(Page.empty());

        mvc.perform(get("/api/configuracao-oficina"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.status").value(503))
                .andExpect(jsonPath("$.error").value("OFICINA_CONFIG_MISSING"))
                .andExpect(jsonPath("$.message").value(MESSAGE))
                .andExpect(jsonPath("$.path").value("/api/configuracao-oficina"))
                .andExpect(jsonPath("$.timestamp").isNotEmpty())
                .andExpect(jsonPath("$.details").doesNotExist())
                .andExpect(jsonPath("$.stackTrace").doesNotExist());

        verifyReadOnlyAccess();
    }

    @Test
    void missingPutReturns503WithoutCreatingData() throws Exception {
        when(repository.findAll(any(Pageable.class))).thenReturn(Page.empty());

        mvc.perform(put("/api/configuracao-oficina")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nomeFantasia\":\"Oficina Sintética\"}"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.error").value("OFICINA_CONFIG_MISSING"))
                .andExpect(jsonPath("$.message").value(MESSAGE));

        verifyReadOnlyAccess();
    }

    @Test
    void duplicateRecordReturnsDistinctIntegrityError() throws Exception {
        when(repository.findAll(any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(new ConfiguracaoOficina(), new ConfiguracaoOficina())));

        mvc.perform(get("/api/configuracao-oficina"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.error").value("OFICINA_CONFIG_INTEGRITY_ERROR"))
                .andExpect(jsonPath("$.message").value(MESSAGE));

        verifyReadOnlyAccess();
    }

    @Test
    void handlerDoesNotExposeInternalCauseOrQueryParameters() throws Exception {
        var error = new ConfiguracaoOficinaIndisponivelException();
        error.initCause(new IllegalStateException("SYNTHETIC_PRIVATE_DETAIL"));
        var request = new MockHttpServletRequest("GET", "/api/configuracao-oficina");
        request.setQueryString("private=SYNTHETIC_QUERY_DETAIL");

        var response = new GlobalExceptionHandler().handleConfiguracaoOficinaIndisponivel(error, request);

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, response.getStatusCode());
        assertEquals("no-store", response.getHeaders().getCacheControl());
        assertNotNull(response.getBody());
        assertEquals(MESSAGE, response.getBody().message());
        var json = new ObjectMapper().findAndRegisterModules().valueToTree(response.getBody());
        assertEquals(5, json.size());
        assertFalse(json.toString().contains("SYNTHETIC_PRIVATE_DETAIL"));
        assertFalse(json.toString().contains("SYNTHETIC_QUERY_DETAIL"));
        assertFalse(json.has("stackTrace"));
        assertFalse(json.has("cause"));
        assertFalse(json.has("cnpj"));
        assertFalse(json.has("responsavel"));
        verifyNoInteractions(repository);
    }

    private void verifyReadOnlyAccess() {
        verify(repository).findAll(any(Pageable.class));
        verify(repository, never()).save(any());
        verifyNoMoreInteractions(repository);
    }
}
