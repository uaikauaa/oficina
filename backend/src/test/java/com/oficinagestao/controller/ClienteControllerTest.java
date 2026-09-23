package com.oficinagestao.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.oficinagestao.dto.*;
import com.oficinagestao.entity.*;
import com.oficinagestao.repository.*;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ClienteControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private ClienteRepository clienteRepository;

    @Test
    @DisplayName("Requisição não autenticada para /api/clientes deve retornar 401 Unauthorized")
    void deveRetornar401QuandoNaoAutenticado() throws Exception {
        mockMvc.perform(get("/api/clientes"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.error").value("UNAUTHORIZED"));
    }

    @Test
    @DisplayName("Criar cliente Pessoa Física com sucesso deve retornar 201 Created")
    @WithMockUser(username = "admin@oficina.com", authorities = {"ROLE_ADMIN"})
    void deveCriarClientePessoaFisicaComSucesso() throws Exception {
        EnderecoDTO endereco = new EnderecoDTO(
                null,
                "30130-100",
                "Av. Afonso Pena",
                "1500",
                "Sala 402",
                "Centro",
                "Belo Horizonte",
                "MG",
                TipoEndereco.PRINCIPAL
        );

        ClienteCreateDTO dto = new ClienteCreateDTO(
                TipoPessoa.FISICA,
                "João da Silva Soldas",
                null,
                "11144477735",
                "MG-12.345.678",
                "3133334444",
                "31999998888",
                "joao.silva@email.com",
                "Cliente com inversoras de solda MIG",
                endereco
        );

        mockMvc.perform(post("/api/clientes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.tipoPessoa").value("FISICA"))
                .andExpect(jsonPath("$.nomeRazaoSocial").value("João da Silva Soldas"))
                .andExpect(jsonPath("$.cpfCnpj").value("11144477735"))
                .andExpect(jsonPath("$.telefone").value("3133334444"))
                .andExpect(jsonPath("$.ativo").value(true))
                .andExpect(jsonPath("$.enderecos", hasSize(1)))
                .andExpect(jsonPath("$.enderecos[0].cidade").value("Belo Horizonte"))
                .andExpect(jsonPath("$.totalEquipamentos").value(0));
    }

    @Test
    @DisplayName("Criar cliente Pessoa Jurídica com sucesso deve retornar 201 Created")
    @WithMockUser(username = "admin@oficina.com", authorities = {"ROLE_ADMIN"})
    void deveCriarClientePessoaJuridicaComSucesso() throws Exception {
        EnderecoDTO endereco = new EnderecoDTO(
                null,
                "32210-000",
                "Rua Rio Comprido",
                "200",
                "Galpão B",
                "Cinco",
                "Contagem",
                "MG",
                TipoEndereco.PRINCIPAL
        );

        ClienteCreateDTO dto = new ClienteCreateDTO(
                TipoPessoa.JURIDICA,
                "Metalúrgica Aço Forte LTDA",
                "Aço Forte Geradores",
                "99887766000155",
                "0621234560089",
                "3133987654",
                "31988887777",
                "contato@acoforte.com.br",
                "Possui frota de 5 geradores a diesel",
                endereco
        );

        mockMvc.perform(post("/api/clientes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.tipoPessoa").value("JURIDICA"))
                .andExpect(jsonPath("$.nomeRazaoSocial").value("Metalúrgica Aço Forte LTDA"))
                .andExpect(jsonPath("$.nomeFantasia").value("Aço Forte Geradores"))
                .andExpect(jsonPath("$.cpfCnpj").value("99887766000155"))
                .andExpect(jsonPath("$.ativo").value(true))
                .andExpect(jsonPath("$.enderecos", hasSize(1)));
    }

    @Test
    @DisplayName("Criar cliente com CPF duplicado deve retornar 409 Conflict")
    @WithMockUser(username = "admin@oficina.com", authorities = {"ROLE_ADMIN"})
    void deveRetornar409QuandoCpfDuplicado() throws Exception {
        Cliente cliente = new Cliente(
                TipoPessoa.FISICA,
                "Carlos Eduardo",
                null,
                "22233344455",
                null,
                "3132111111",
                null,
                "carlos@email.com",
                null
        );
        clienteRepository.save(cliente);

        ClienteCreateDTO duplicado = new ClienteCreateDTO(
                TipoPessoa.FISICA,
                "Carlos Outro Nome",
                null,
                "22233344455",
                null,
                "3132222222",
                null,
                "outro@email.com",
                null,
                null
        );

        mockMvc.perform(post("/api/clientes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(duplicado)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.message").value("Já existe um cliente cadastrado com este CPF/CNPJ."));
    }

    @Test
    @DisplayName("Criar cliente com CNPJ duplicado deve retornar 409 Conflict")
    @WithMockUser(username = "admin@oficina.com", authorities = {"ROLE_ADMIN"})
    void deveRetornar409QuandoCnpjDuplicado() throws Exception {
        Cliente cliente = new Cliente(
                TipoPessoa.JURIDICA,
                "Empresa Alfa LTDA",
                null,
                "99888777000166",
                null,
                "3135551111",
                null,
                "alfa@email.com",
                null
        );
        clienteRepository.save(cliente);

        ClienteCreateDTO duplicado = new ClienteCreateDTO(
                TipoPessoa.JURIDICA,
                "Empresa Beta LTDA",
                null,
                "99888777000166",
                null,
                "3135552222",
                null,
                "beta@email.com",
                null,
                null
        );

        mockMvc.perform(post("/api/clientes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(duplicado)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.message").value("Já existe um cliente cadastrado com este CPF/CNPJ."));
    }

    @Test
    @DisplayName("Criar cliente com telefone duplicado deve retornar 409 Conflict")
    @WithMockUser(username = "admin@oficina.com", authorities = {"ROLE_ADMIN"})
    void deveRetornar409QuandoTelefoneDuplicado() throws Exception {
        Cliente cliente = new Cliente(
                TipoPessoa.FISICA,
                "Marcos Vinicius",
                null,
                "77788899900",
                null,
                "3134445555",
                null,
                "marcos@email.com",
                null
        );
        clienteRepository.save(cliente);

        ClienteCreateDTO duplicado = new ClienteCreateDTO(
                TipoPessoa.FISICA,
                "Outro Cliente",
                null,
                "12312312312",
                null,
                "3134445555",
                null,
                "outro.cliente@email.com",
                null,
                null
        );

        mockMvc.perform(post("/api/clientes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(duplicado)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.message").value("Já existe um cliente cadastrado com este Telefone/Celular."));
    }

    @Test
    @DisplayName("Validação de campos obrigatórios ao criar cliente deve retornar 400 Bad Request")
    @WithMockUser(username = "admin@oficina.com", authorities = {"ROLE_ADMIN"})
    void deveRetornar400QuandoCamposObrigatoriosAusentes() throws Exception {
        ClienteCreateDTO invalido = new ClienteCreateDTO(
                null, // Tipo obrigatório
                "",   // Nome obrigatório
                null,
                null,
                null,
                null,
                null,
                "email-invalido", // Formato de e-mail inválido
                null,
                null
        );

        mockMvc.perform(post("/api/clientes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalido)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.details").isNotEmpty());
    }

    @Test
    @DisplayName("Buscar cliente por ID inexistente deve retornar 404 Not Found")
    @WithMockUser(username = "admin@oficina.com", authorities = {"ROLE_ADMIN"})
    void deveRetornar404QuandoClienteInexistente() throws Exception {
        mockMvc.perform(get("/api/clientes/{id}", 999999L))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.message").value(containsString("Cliente não encontrado")));
    }

    @Test
    @DisplayName("Buscar cliente por ID existente deve retornar 200 OK")
    @WithMockUser(username = "admin@oficina.com", authorities = {"ROLE_ADMIN"})
    void deveBuscarClientePorIdComSucesso() throws Exception {
        Cliente cliente = new Cliente(
                TipoPessoa.FISICA,
                "Rodrigo Martins",
                null,
                "33344455566",
                null,
                "3138887777",
                null,
                "rodrigo@email.com",
                "Observação técnica"
        );
        Cliente salvo = clienteRepository.save(cliente);

        mockMvc.perform(get("/api/clientes/{id}", salvo.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(salvo.getId()))
                .andExpect(jsonPath("$.nomeRazaoSocial").value("Rodrigo Martins"))
                .andExpect(jsonPath("$.cpfCnpj").value("33344455566"));
    }

    @Test
    @DisplayName("Listar clientes com busca e paginação deve retornar 200 OK e PageResponse")
    @WithMockUser(username = "admin@oficina.com", authorities = {"ROLE_ADMIN"})
    void deveListarClientesComPaginacaoEBusca() throws Exception {
        Cliente c1 = new Cliente(TipoPessoa.FISICA, "Bruno Soldador", null, "10101010101", null, "31911112222", null, "bruno@email.com", null);
        Cliente c2 = new Cliente(TipoPessoa.JURIDICA, "Eletro Mecânica Bruno LTDA", "Bruno Eletro", "20202020000120", null, "31922223333", null, "contato@brunoeletro.com", null);
        clienteRepository.save(c1);
        clienteRepository.save(c2);

        mockMvc.perform(get("/api/clientes")
                        .param("termo", "Bruno")
                        .param("page", "0")
                        .param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(greaterThanOrEqualTo(2))))
                .andExpect(jsonPath("$.totalElements", greaterThanOrEqualTo(2)))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(10));
    }

    @Test
    @DisplayName("Editar cliente com sucesso deve retornar 200 OK")
    @WithMockUser(username = "admin@oficina.com", authorities = {"ROLE_ADMIN"})
    void deveEditarClienteComSucesso() throws Exception {
        Cliente cliente = new Cliente(
                TipoPessoa.FISICA,
                "Fernando Silva",
                null,
                "55566677788",
                null,
                "3137778888",
                null,
                "fernando@email.com",
                null
        );
        Cliente salvo = clienteRepository.save(cliente);

        ClienteUpdateDTO updateDTO = new ClienteUpdateDTO(
                TipoPessoa.FISICA,
                "Fernando Silva Atualizado",
                "Silva Soldas",
                "55566677788",
                "MG-99.888.777",
                "3137778888",
                "31998887766",
                "fernando.novo@email.com",
                true,
                "Observação atualizada",
                new EnderecoDTO(null, "30110-000", "Rua da Bahia", "100", null, "Centro", "Belo Horizonte", "MG", TipoEndereco.PRINCIPAL)
        );

        mockMvc.perform(put("/api/clientes/{id}", salvo.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateDTO)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nomeRazaoSocial").value("Fernando Silva Atualizado"))
                .andExpect(jsonPath("$.nomeFantasia").value("Silva Soldas"))
                .andExpect(jsonPath("$.email").value("fernando.novo@email.com"))
                .andExpect(jsonPath("$.enderecos", hasSize(1)))
                .andExpect(jsonPath("$.enderecos[0].logradouro").value("Rua da Bahia"));
    }

    @Test
    @DisplayName("Inativar e ativar cliente via PATCH deve alterar status com sucesso")
    @WithMockUser(username = "admin@oficina.com", authorities = {"ROLE_ADMIN"})
    void deveInativarEAtivarCliente() throws Exception {
        Cliente cliente = new Cliente(
                TipoPessoa.FISICA,
                "Lucas Ferreira",
                null,
                "44455566677",
                null,
                "3139990000",
                null,
                "lucas@email.com",
                null
        );
        Cliente salvo = clienteRepository.save(cliente);

        // Inativar
        mockMvc.perform(patch("/api/clientes/{id}/status", salvo.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new StatusUpdateDTO(false))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ativo").value(false));

        // Reativar
        mockMvc.perform(patch("/api/clientes/{id}/status", salvo.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new StatusUpdateDTO(true))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ativo").value(true));
    }

    @Test
    @DisplayName("BUG-003: Deve rejeitar cliente com CPF duplicado mesmo que um esteja formatado e outro apenas números")
    @WithMockUser(username = "admin@oficina.com", authorities = {"ROLE_ADMIN"})
    void deveRejeitarCpfDuplicadoMesmoComMascaraDiferente() throws Exception {
        ClienteCreateDTO cliente1 = new ClienteCreateDTO(
                TipoPessoa.FISICA,
                "Cliente Original",
                null,
                "112.233.445-56",
                null,
                "(31) 98888-1111",
                null,
                "original@email.com",
                null,
                null
        );

        mockMvc.perform(post("/api/clientes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(cliente1)))
                .andExpect(status().isCreated());

        ClienteCreateDTO cliente2 = new ClienteCreateDTO(
                TipoPessoa.FISICA,
                "Cliente Duplicado Sem Pontos",
                null,
                "11223344556",
                null,
                "(31) 98888-2222",
                null,
                "duplicado@email.com",
                null,
                null
        );

        mockMvc.perform(post("/api/clientes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(cliente2)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("CONFLICT"));
    }

    @Test
    @DisplayName("BUG-003: Deve rejeitar CPF com todos os dígitos iguais")
    @WithMockUser(username = "admin@oficina.com", authorities = {"ROLE_ADMIN"})
    void deveRejeitarCpfComTodosDigitosIguais() throws Exception {
        ClienteCreateDTO cliente = new ClienteCreateDTO(
                TipoPessoa.FISICA,
                "Cliente Invalido",
                null,
                "111.111.111-11",
                null,
                null,
                null,
                null,
                null,
                null
        );

        mockMvc.perform(post("/api/clientes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(cliente)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("BUSINESS_ERROR"));
    }

    @Test
    @DisplayName("BUG-003: Deve rejeitar CPF com quantidade de dígitos incorreta")
    @WithMockUser(username = "admin@oficina.com", authorities = {"ROLE_ADMIN"})
    void deveRejeitarCpfComTamanhoInvalido() throws Exception {
        ClienteCreateDTO cliente = new ClienteCreateDTO(
                TipoPessoa.FISICA,
                "Cliente Invalido Tamanho",
                null,
                "123.456",
                null,
                null,
                null,
                null,
                null,
                null
        );

        mockMvc.perform(post("/api/clientes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(cliente)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("BUSINESS_ERROR"));
    }
}
