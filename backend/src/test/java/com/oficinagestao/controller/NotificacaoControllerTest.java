package com.oficinagestao.controller;

import com.oficinagestao.dto.NotificacaoResponseDTO;
import com.oficinagestao.dto.NotificacoesResumoDTO;
import com.oficinagestao.entity.TipoNotificacao;
import com.oficinagestao.exception.ResourceNotFoundException;
import com.oficinagestao.service.NotificacaoService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.OffsetDateTime;
import java.util.List;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class NotificacaoControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private NotificacaoService notificacaoService;

    @Test
    @DisplayName("GET /api/notificacoes sem autenticação deve retornar 401 Unauthorized")
    void deveRetornar401SemAutenticacao() throws Exception {
        mockMvc.perform(get("/api/notificacoes"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(authorities = "ROLE_ADMIN")
    @DisplayName("GET /api/notificacoes autenticado deve retornar 200 OK com resumo")
    void deveRetornar200ComResumoQuandoAutenticado() throws Exception {
        NotificacaoResponseDTO notifDto = new NotificacaoResponseDTO(
                1L,
                TipoNotificacao.OS_AGUARDANDO_APROVACAO,
                "Aguardando Aprovação: OS OS-2026-0001",
                "A OS aguarda aprovação",
                false,
                OffsetDateTime.now(),
                null,
                "ORDEM_SERVICO",
                10L,
                "/ordens-servico?busca=OS-2026-0001"
        );
        NotificacoesResumoDTO resumo = new NotificacoesResumoDTO(1, 1, List.of(notifDto));

        when(notificacaoService.listarRecentes()).thenReturn(resumo);

        mockMvc.perform(get("/api/notificacoes"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.naoLidas").value(1))
                .andExpect(jsonPath("$.notificacoes[0].id").value(1))
                .andExpect(jsonPath("$.notificacoes[0].tipo").value("OS_AGUARDANDO_APROVACAO"))
                .andExpect(jsonPath("$.notificacoes[0].titulo").value("Aguardando Aprovação: OS OS-2026-0001"));
    }

    @Test
    @WithMockUser(authorities = "ROLE_ADMIN")
    @DisplayName("PATCH /api/notificacoes/{id}/ler deve marcar notificação como lida e retornar 200 OK")
    void deveMarcarComoLidaViaPatch() throws Exception {
        NotificacaoResponseDTO lidaDto = new NotificacaoResponseDTO(
                1L,
                TipoNotificacao.OS_AGUARDANDO_APROVACAO,
                "Aguardando Aprovação: OS OS-2026-0001",
                "A OS aguarda aprovação",
                true,
                OffsetDateTime.now(),
                OffsetDateTime.now(),
                "ORDEM_SERVICO",
                10L,
                "/ordens-servico?busca=OS-2026-0001"
        );

        when(notificacaoService.marcarComoLida(1L)).thenReturn(lidaDto);

        mockMvc.perform(patch("/api/notificacoes/1/ler"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.lida").value(true));

        verify(notificacaoService).marcarComoLida(1L);
    }

    @Test
    @WithMockUser(authorities = "ROLE_ADMIN")
    @DisplayName("PUT /api/notificacoes/{id}/ler deve marcar notificação como lida e retornar 200 OK")
    void deveMarcarComoLidaViaPut() throws Exception {
        NotificacaoResponseDTO lidaDto = new NotificacaoResponseDTO(
                1L,
                TipoNotificacao.OS_AGUARDANDO_APROVACAO,
                "Aguardando Aprovação: OS OS-2026-0001",
                "A OS aguarda aprovação",
                true,
                OffsetDateTime.now(),
                OffsetDateTime.now(),
                "ORDEM_SERVICO",
                10L,
                "/ordens-servico?busca=OS-2026-0001"
        );

        when(notificacaoService.marcarComoLida(1L)).thenReturn(lidaDto);

        mockMvc.perform(put("/api/notificacoes/1/ler"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.lida").value(true));

        verify(notificacaoService).marcarComoLida(1L);
    }

    @Test
    @WithMockUser(authorities = "ROLE_ADMIN")
    @DisplayName("PATCH /api/notificacoes/{id}/ler com ID inexistente deve retornar 404")
    void deveRetornar404AoMarcarInexistente() throws Exception {
        when(notificacaoService.marcarComoLida(999L)).thenThrow(new ResourceNotFoundException("Notificação não encontrada"));

        mockMvc.perform(patch("/api/notificacoes/999/ler"))
                .andExpect(status().isNotFound());
    }

    @Test
    @WithMockUser(authorities = "ROLE_ADMIN")
    @DisplayName("PATCH /api/notificacoes/ler-todas deve marcar todas e retornar 204 No Content")
    void deveMarcarTodasComoLidasViaPatch() throws Exception {
        mockMvc.perform(patch("/api/notificacoes/ler-todas"))
                .andExpect(status().isNoContent());

        verify(notificacaoService).marcarTodasComoLidas();
    }

    @Test
    @WithMockUser(authorities = "ROLE_ADMIN")
    @DisplayName("PUT /api/notificacoes/ler-todas deve marcar todas e retornar 204 No Content")
    void deveMarcarTodasComoLidasViaPut() throws Exception {
        mockMvc.perform(put("/api/notificacoes/ler-todas"))
                .andExpect(status().isNoContent());

        verify(notificacaoService).marcarTodasComoLidas();
    }
}
