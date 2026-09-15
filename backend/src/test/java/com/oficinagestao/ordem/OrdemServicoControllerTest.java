package com.oficinagestao.ordem;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.oficinagestao.cliente.Cliente;
import com.oficinagestao.cliente.ClienteRepository;
import com.oficinagestao.cliente.TipoPessoa;
import com.oficinagestao.maquina.Maquina;
import com.oficinagestao.maquina.MaquinaRepository;
import com.oficinagestao.maquina.TipoEquipamento;
import com.oficinagestao.ordem.dto.OrdemServicoCreateDTO;
import com.oficinagestao.ordem.dto.OrdemServicoStatusDTO;
import com.oficinagestao.ordem.dto.OrdemServicoUpdateDTO;
import org.junit.jupiter.api.BeforeEach;
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

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class OrdemServicoControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private ClienteRepository clienteRepository;

    @Autowired
    private MaquinaRepository maquinaRepository;

    @Autowired
    private OrdemServicoRepository ordemServicoRepository;

    private Cliente cliente1;
    private Cliente cliente2;
    private Maquina maquinaCliente1;
    private Maquina maquinaCliente2;

    @BeforeEach
    void setUp() {
        cliente1 = new Cliente();
        cliente1.setTipoPessoa(TipoPessoa.FISICA);
        cliente1.setNomeRazaoSocial("João Soldador");
        cliente1.setCpfCnpj("999.888.777-66");
        cliente1.setCelular("(31) 98765-4321");
        cliente1.setAtivo(true);
        cliente1 = clienteRepository.save(cliente1);

        cliente2 = new Cliente();
        cliente2.setTipoPessoa(TipoPessoa.JURIDICA);
        cliente2.setNomeRazaoSocial("Construtora ABC Ltda");
        cliente2.setCpfCnpj("11.222.333/0001-44");
        cliente2.setCelular("(31) 97654-3210");
        cliente2.setAtivo(true);
        cliente2 = clienteRepository.save(cliente2);

        maquinaCliente1 = new Maquina();
        maquinaCliente1.setCliente(cliente1);
        maquinaCliente1.setTipoEquipamento(TipoEquipamento.MAQUINA_SOLDA);
        maquinaCliente1.setMarca("ESAB");
        maquinaCliente1.setModelo("Conarco 400");
        maquinaCliente1.setNumeroSerie("SN-ESAB-400");
        maquinaCliente1.setAtivo(true);
        maquinaCliente1 = maquinaRepository.save(maquinaCliente1);

        maquinaCliente2 = new Maquina();
        maquinaCliente2.setCliente(cliente2);
        maquinaCliente2.setTipoEquipamento(TipoEquipamento.GERADOR_ENERGIA);
        maquinaCliente2.setMarca("Branco");
        maquinaCliente2.setModelo("B4T-6500");
        maquinaCliente2.setNumeroSerie("SN-BRANCO-6500");
        maquinaCliente2.setAtivo(true);
        maquinaCliente2 = maquinaRepository.save(maquinaCliente2);
    }

    @Test
    @DisplayName("Requisição não autenticada para /api/ordens-servico deve retornar 401 Unauthorized")
    void deveRetornar401QuandoNaoAutenticado() throws Exception {
        mockMvc.perform(get("/api/ordens-servico"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.error").value("UNAUTHORIZED"));
    }

    @Test
    @DisplayName("Criar OS com sucesso deve retornar 201 Created")
    @WithMockUser(username = "admin@oficina.com", authorities = {"ROLE_ADMIN"})
    void deveCriarOrdemServicoComSucesso() throws Exception {
        OrdemServicoCreateDTO dto = new OrdemServicoCreateDTO(
                cliente1.getId(),
                maquinaCliente1.getId(),
                null,
                null,
                null,
                "Equipamento falhando em corrente alta",
                "250.0",
                "Entregue com suporte"
        );

        mockMvc.perform(post("/api/ordens-servico")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.numeroOs", startsWith("OS-")))
                .andExpect(jsonPath("$.clienteId").value(cliente1.getId()))
                .andExpect(jsonPath("$.clienteNome").value("João Soldador"))
                .andExpect(jsonPath("$.maquinaId").value(maquinaCliente1.getId()))
                .andExpect(jsonPath("$.maquinaMarca").value("ESAB"))
                .andExpect(jsonPath("$.status").value("ABERTA"))
                .andExpect(jsonPath("$.statusDescricao").value("Aberta"))
                .andExpect(jsonPath("$.problemaRelatado").value("Equipamento falhando em corrente alta"));
    }

    @Test
    @DisplayName("Tentar criar OS vinculando equipamento de outro cliente deve retornar 400 Bad Request com mensagem explicativa")
    @WithMockUser(username = "admin@oficina.com", authorities = {"ROLE_ADMIN"})
    void naoDevePermitirOSComEquipamentoDeOutroCliente() throws Exception {
        // Tentativa inválida: cliente1 com maquinaCliente2 (pertence ao cliente2)
        OrdemServicoCreateDTO dto = new OrdemServicoCreateDTO(
                cliente1.getId(),
                maquinaCliente2.getId(),
                null,
                null,
                null,
                "Tentativa indevida de abertura",
                null,
                null
        );

        mockMvc.perform(post("/api/ordens-servico")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.message", containsString("não pertence ao cliente indicado")));
    }

    @Test
    @DisplayName("Listar Ordens de Serviço autenticado deve retornar 200 OK e PageResponse")
    @WithMockUser(username = "admin@oficina.com", authorities = {"ROLE_ADMIN"})
    void deveListarOrdensServico() throws Exception {
        // Cria uma OS prévia
        OrdemServico os = new OrdemServico();
        os.setNumeroOs("OS-TEST-001");
        os.setCliente(cliente1);
        os.setMaquina(maquinaCliente1);
        os.setProblemaRelatado("Teste listagem");
        os.setStatus(StatusOrdemServico.ABERTA);
        ordemServicoRepository.save(os);

        mockMvc.perform(get("/api/ordens-servico")
                        .param("termo", "ESAB"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$.totalElements", greaterThanOrEqualTo(1)));
    }

    @Test
    @DisplayName("Buscar OS por ID existente deve retornar 200 OK")
    @WithMockUser(username = "admin@oficina.com", authorities = {"ROLE_ADMIN"})
    void deveBuscarOrdemPorId() throws Exception {
        OrdemServico os = new OrdemServico();
        os.setNumeroOs("OS-TEST-002");
        os.setCliente(cliente1);
        os.setMaquina(maquinaCliente1);
        os.setProblemaRelatado("Teste busca");
        os.setStatus(StatusOrdemServico.ABERTA);
        OrdemServico salva = ordemServicoRepository.save(os);

        mockMvc.perform(get("/api/ordens-servico/{id}", salva.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(salva.getId()))
                .andExpect(jsonPath("$.numeroOs").value("OS-TEST-002"));
    }

    @Test
    @DisplayName("Atualizar OS existente deve retornar 200 OK com valores recalculados")
    @WithMockUser(username = "admin@oficina.com", authorities = {"ROLE_ADMIN"})
    void deveAtualizarOrdemServico() throws Exception {
        OrdemServico os = new OrdemServico();
        os.setNumeroOs("OS-TEST-003");
        os.setCliente(cliente1);
        os.setMaquina(maquinaCliente1);
        os.setProblemaRelatado("Teste update");
        os.setStatus(StatusOrdemServico.ABERTA);
        OrdemServico salva = ordemServicoRepository.save(os);

        OrdemServicoUpdateDTO updateDTO = new OrdemServicoUpdateDTO(
                "Problema atualizado",
                "Capacitores estufados",
                "Troca do banco de capacitores",
                null,
                "Observação de bancada",
                null,
                new BigDecimal("200.00"),
                new BigDecimal("350.00"),
                new BigDecimal("50.00"),
                null
        );

        mockMvc.perform(put("/api/ordens-servico/{id}", salva.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateDTO)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.diagnostico").value("Capacitores estufados"))
                .andExpect(jsonPath("$.valorMaoObra").value(200.00))
                .andExpect(jsonPath("$.valorPecas").value(350.00))
                .andExpect(jsonPath("$.valorDesconto").value(50.00))
                .andExpect(jsonPath("$.valorTotal").value(500.00)); // 200 + 350 - 50 = 500
    }

    @Test
    @DisplayName("Avançar status da OS para PRONTA com testes técnicos deve retornar 200 OK")
    @WithMockUser(username = "admin@oficina.com", authorities = {"ROLE_ADMIN"})
    void deveAvançarStatusParaProntaComTestes() throws Exception {
        OrdemServico os = new OrdemServico();
        os.setNumeroOs("OS-TEST-004");
        os.setCliente(cliente1);
        os.setMaquina(maquinaCliente1);
        os.setProblemaRelatado("Teste status");
        os.setStatus(StatusOrdemServico.EM_MANUTENCAO);
        OrdemServico salva = ordemServicoRepository.save(os);

        OrdemServicoStatusDTO statusDTO = new OrdemServicoStatusDTO(
                StatusOrdemServico.PRONTA,
                "Teste de soldagem sob 180A por 15 minutos sem interrupção térmica.",
                "Equipamento pronto para retirada"
        );

        mockMvc.perform(patch("/api/ordens-servico/{id}/status", salva.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(statusDTO)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PRONTA"))
                .andExpect(jsonPath("$.testesRealizados", containsString("Teste de soldagem sob 180A")));
    }

    @Test
    @DisplayName("Consultar histórico de OS por cliente deve retornar 200 OK")
    @WithMockUser(username = "admin@oficina.com", authorities = {"ROLE_ADMIN"})
    void deveListarHistoricoPorCliente() throws Exception {
        OrdemServico os = new OrdemServico();
        os.setNumeroOs("OS-CLI-001");
        os.setCliente(cliente1);
        os.setMaquina(maquinaCliente1);
        os.setProblemaRelatado("OS do cliente 1");
        os.setStatus(StatusOrdemServico.ABERTA);
        ordemServicoRepository.save(os);

        mockMvc.perform(get("/api/clientes/{clienteId}/ordens-servico", cliente1.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$.content[0].clienteId").value(cliente1.getId()));
    }

    @Test
    @DisplayName("Consultar histórico de OS por equipamento deve retornar 200 OK")
    @WithMockUser(username = "admin@oficina.com", authorities = {"ROLE_ADMIN"})
    void deveListarHistoricoPorMaquina() throws Exception {
        OrdemServico os = new OrdemServico();
        os.setNumeroOs("OS-MAQ-001");
        os.setCliente(cliente1);
        os.setMaquina(maquinaCliente1);
        os.setProblemaRelatado("Histórico da máquina");
        os.setStatus(StatusOrdemServico.ABERTA);
        ordemServicoRepository.save(os);

        mockMvc.perform(get("/api/maquinas/{maquinaId}/ordens-servico", maquinaCliente1.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$.content[0].maquinaId").value(maquinaCliente1.getId()));
    }
}
