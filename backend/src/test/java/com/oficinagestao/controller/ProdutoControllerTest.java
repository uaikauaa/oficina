package com.oficinagestao.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.oficinagestao.dto.StatusUpdateDTO;
import com.oficinagestao.entity.Produto;
import com.oficinagestao.entity.TipoProduto;
import com.oficinagestao.repository.ProdutoRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ProdutoControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private ProdutoRepository produtoRepository;

    private Produto criarProdutoTeste(String codigo, String nome, TipoProduto tipo, boolean ativo) {
        Produto p = new Produto();
        p.setCodigo(codigo);
        p.setNome(nome);
        p.setTipo(tipo);
        p.setUnidadeMedida("UN");
        p.setPrecoCusto(BigDecimal.valueOf(25.0));
        p.setPrecoVenda(BigDecimal.valueOf(50.0));
        p.setEstoqueAtual(BigDecimal.valueOf(10.0));
        p.setEstoqueMinimo(BigDecimal.valueOf(2.0));
        p.setAtivo(ativo);
        return produtoRepository.save(p);
    }

    @Test
    @DisplayName("Requisição não autenticada para /api/produtos deve retornar 401")
    void deveRetornar401QuandoNaoAutenticado() throws Exception {
        mockMvc.perform(get("/api/produtos"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.error").value("UNAUTHORIZED"));
    }

    @Test
    @DisplayName("GET /api/produtos com enum inválido deve retornar 400 Bad Request (UX-006)")
    @WithMockUser(username = "admin@oficina.com", authorities = {"ROLE_ADMIN"})
    void deveRetornar400QuandoEnumInvalidoNaUrl() throws Exception {
        mockMvc.perform(get("/api/produtos").param("tipo", "ENUM_INEXISTENTE"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.error").value("BAD_REQUEST"))
                .andExpect(jsonPath("$.message").value(containsString("Parâmetro 'tipo' com valor inválido: 'ENUM_INEXISTENTE'")));
    }

    @Test
    @DisplayName("GET /api/produtos/{id} com ID não numérico deve retornar 400 Bad Request (UX-006)")
    @WithMockUser(username = "admin@oficina.com", authorities = {"ROLE_ADMIN"})
    void deveRetornar400QuandoIdNaoNumerico() throws Exception {
        mockMvc.perform(get("/api/produtos/id-invalido"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.error").value("BAD_REQUEST"))
                .andExpect(jsonPath("$.message").value(containsString("Parâmetro 'id' com valor inválido")));
    }

    @Test
    @DisplayName("PATCH /api/produtos/{id}/status com payload correto deve inativar produto com sucesso (UX-006)")
    @WithMockUser(username = "admin@oficina.com", authorities = {"ROLE_ADMIN"})
    void deveInativarProdutoComSucesso() throws Exception {
        Produto p = criarProdutoTeste("TEST-P01", "Diodo Rápido 60A", TipoProduto.PECA, true);

        StatusUpdateDTO dto = new StatusUpdateDTO(false);

        mockMvc.perform(patch("/api/produtos/" + p.getId() + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(p.getId()))
                .andExpect(jsonPath("$.ativo").value(false));
    }

    @Test
    @DisplayName("PATCH /api/produtos/{id}/status com payload correto deve reativar produto com sucesso (UX-006)")
    @WithMockUser(username = "admin@oficina.com", authorities = {"ROLE_ADMIN"})
    void deveReativarProdutoComSucesso() throws Exception {
        Produto p = criarProdutoTeste("TEST-P02", "IGBT 1200V", TipoProduto.PECA, false);

        StatusUpdateDTO dto = new StatusUpdateDTO(true);

        mockMvc.perform(patch("/api/produtos/" + p.getId() + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(p.getId()))
                .andExpect(jsonPath("$.ativo").value(true));
    }

    @Test
    @DisplayName("PATCH /api/produtos/{id}/status sem corpo deve retornar 400 Bad Request (contrato preservado)")
    @WithMockUser(username = "admin@oficina.com", authorities = {"ROLE_ADMIN"})
    void deveRetornar400QuandoPatchStatusSemCorpo() throws Exception {
        Produto p = criarProdutoTeste("TEST-P03", "Bico Tocha TIG", TipoProduto.CONSUMIVEL, true);

        mockMvc.perform(patch("/api/produtos/" + p.getId() + "/status")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.error").value("BAD_REQUEST"))
                .andExpect(jsonPath("$.message").value(containsString("Corpo da requisição ausente ou malformado")));
    }
}
