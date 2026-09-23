package com.oficinagestao.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.oficinagestao.dto.DpsFiscalCreateDTO;
import com.oficinagestao.dto.DpsFiscalResponseDTO;
import com.oficinagestao.entity.StatusDpsFiscal;
import com.oficinagestao.service.DpsFiscalService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class DpsFiscalControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private DpsFiscalService dpsFiscalService;

    private DpsFiscalResponseDTO criarDpsResponseExemplo() {
        return new DpsFiscalResponseDTO(
                1L,
                100L,
                "OS-2026-0001",
                10L,
                "1",
                1L,
                StatusDpsFiscal.PREPARADA,
                OffsetDateTime.now(),
                new BigDecimal("350.00"),
                "14.01.01",
                "Serviço de solda e reparo elétrico",
                "Ourinhos",
                "35.34708",
                "45.076.507/0001-67",
                "45.076.507 BRUNO SOARES RODRIGUES",
                "Bruno Soldas",
                null,
                "Simples Nacional / MEI",
                "Avenida Jacinto Ferreira de Sá",
                "1538",
                "Vila Sandano",
                "19.914-080",
                "Ourinhos",
                "SP",
                "35.34708",
                "JURIDICA",
                "12345678000190",
                "Cliente Teste LTDA",
                "Cliente Teste",
                null,
                "contato@cliente.com",
                "(14) 99999-8888",
                "Rua Teste",
                "10",
                null,
                "Centro",
                "Ourinhos",
                "SP",
                "19900-000",
                "3534708",
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                1L,
                OffsetDateTime.now(),
                OffsetDateTime.now()
        );
    }

    @Test
    @DisplayName("Requisição não autenticada para /api/dps/preparar deve retornar 401 Unauthorized")
    void deveRetornar401QuandoNaoAutenticado() throws Exception {
        DpsFiscalCreateDTO dto = new DpsFiscalCreateDTO(100L, "1", null);

        mockMvc.perform(post("/api/dps/preparar")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Usuário sem ROLE_ADMIN tentando preparar DPS deve receber 403 Forbidden")
    @WithMockUser(username = "mecanico@oficina.com", authorities = {"ROLE_MECANICO"})
    void deveRetornar403QuandoNaoForAdmin() throws Exception {
        DpsFiscalCreateDTO dto = new DpsFiscalCreateDTO(100L, "1", null);

        mockMvc.perform(post("/api/dps/preparar")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Administrador com ROLE_ADMIN preparando DPS com sucesso deve receber 201 Created")
    @WithMockUser(username = "admin@oficina.com", authorities = {"ROLE_ADMIN"})
    void devePrepararDpsComSucessoParaAdmin() throws Exception {
        DpsFiscalCreateDTO dto = new DpsFiscalCreateDTO(100L, "1", "Reparo técnico");
        DpsFiscalResponseDTO response = criarDpsResponseExemplo();

        when(dpsFiscalService.prepararDps(any(DpsFiscalCreateDTO.class), any(), any())).thenReturn(response);

        mockMvc.perform(post("/api/dps/preparar")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.serie").value("1"))
                .andExpect(jsonPath("$.numero").value(1))
                .andExpect(jsonPath("$.status").value("PREPARADA"))
                .andExpect(jsonPath("$.prestadorNomeFantasia").value("Bruno Soldas"))
                .andExpect(jsonPath("$.tomadorCodigoIbge").value("3534708"));
    }

    @Test
    @DisplayName("Administrador consultando DPS por ID deve receber 200 OK")
    @WithMockUser(username = "admin@oficina.com", authorities = {"ROLE_ADMIN"})
    void deveObterDpsPorIdParaAdmin() throws Exception {
        DpsFiscalResponseDTO response = criarDpsResponseExemplo();
        when(dpsFiscalService.obterPorId(1L)).thenReturn(response);

        mockMvc.perform(get("/api/dps/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.numeroOs").value("OS-2026-0001"));
    }

    @Test
    @DisplayName("Administrador consultando DPS por ID da OS deve receber 200 OK")
    @WithMockUser(username = "admin@oficina.com", authorities = {"ROLE_ADMIN"})
    void deveObterDpsPorOrdemServicoIdParaAdmin() throws Exception {
        DpsFiscalResponseDTO response = criarDpsResponseExemplo();
        when(dpsFiscalService.obterPorOrdemServicoId(100L)).thenReturn(response);

        mockMvc.perform(get("/api/dps/os/100"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ordemServicoId").value(100))
                .andExpect(jsonPath("$.status").value("PREPARADA"));
    }
}
