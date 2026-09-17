package com.oficinagestao.controller;
import com.oficinagestao.repository.*;

import com.oficinagestao.entity.*;
import com.oficinagestao.dto.*;
import com.oficinagestao.service.*;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/clientes")
@Tag(name = "Clientes", description = "Gerenciamento cadastral de clientes (Pessoa FÃƒÂ­sica e Pessoa JurÃƒÂ­dica)")
@SecurityRequirement(name = "cookieAuth")
@SecurityRequirement(name = "bearerAuth")
public class ClienteController {

    private final ClienteService clienteService;
    private final OrdemServicoService ordemServicoService;
    private final UsuarioRepository usuarioRepository;

    public ClienteController(
            ClienteService clienteService,
            OrdemServicoService ordemServicoService,
            UsuarioRepository usuarioRepository
    ) {
        this.clienteService = clienteService;
        this.ordemServicoService = ordemServicoService;
        this.usuarioRepository = usuarioRepository;
    }

    @PostMapping
    @Operation(summary = "Cadastrar novo cliente", description = "Cadastra cliente Pessoa FÃƒÂ­sica ou JurÃƒÂ­dica com prevenÃƒÂ§ÃƒÂ£o contra duplicidade.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Cliente cadastrado com sucesso"),
            @ApiResponse(responseCode = "400", description = "Dados de entrada invÃƒÂ¡lidos"),
            @ApiResponse(responseCode = "401", description = "NÃƒÂ£o autenticado"),
            @ApiResponse(responseCode = "403", description = "Acesso negado"),
            @ApiResponse(responseCode = "409", description = "Conflito: CPF, CNPJ, telefone ou razÃƒÂ£o social jÃƒÂ¡ existente")
    })
    public ResponseEntity<ClienteResponseDTO> criar(
            @Valid @RequestBody ClienteCreateDTO dto,
            Authentication authentication,
            HttpServletRequest request
    ) {
        Long usuarioId = extrairUsuarioId(authentication);
        String ip = request != null ? request.getRemoteAddr() : "127.0.0.1";
        ClienteResponseDTO response = clienteService.criar(dto, usuarioId, ip);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    @Operation(summary = "Listar clientes paginados", description = "Pesquisa e pagina clientes por termo (nome, razÃƒÂ£o, documento, telefone, ID) e filtros opcionais.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Lista paginada de clientes"),
            @ApiResponse(responseCode = "401", description = "NÃƒÂ£o autenticado"),
            @ApiResponse(responseCode = "403", description = "Acesso negado")
    })
    public ResponseEntity<PageResponse<ClienteResponseDTO>> listar(
            @Parameter(description = "Termo de busca (Nome, RazÃƒÂ£o Social, Fantasia, CPF, CNPJ, Telefone ou ID)")
            @RequestParam(name = "termo", required = false) String termo,

            @Parameter(description = "Filtro por tipo de pessoa (FISICA ou JURIDICA)")
            @RequestParam(name = "tipoPessoa", required = false) TipoPessoa tipoPessoa,

            @Parameter(description = "Filtro por status ativo (true/false)")
            @RequestParam(name = "ativo", required = false) Boolean ativo,

            @PageableDefault(size = 10, sort = "nomeRazaoSocial", direction = Sort.Direction.ASC)
            Pageable pageable
    ) {
        PageResponse<ClienteResponseDTO> response = clienteService.listar(termo, tipoPessoa, ativo, pageable);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/contadores-status")
    @Operation(summary = "Obter contadores operacionais de clientes", description = "Retorna contadores de Total, PF, PJ, Ativos e Inativos para alimentar as pills do frontend.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Contadores retornados com sucesso"),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "403", description = "Acesso negado")
    })
    public ResponseEntity<ClienteContadoresStatusDTO> obterContadoresStatus() {
        return ResponseEntity.ok(clienteService.obterContadoresStatus());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Buscar cliente por ID", description = "Retorna os detalhes completos do cliente e seus endereÃƒÂ§os.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Cliente localizado com sucesso"),
            @ApiResponse(responseCode = "401", description = "NÃƒÂ£o autenticado"),
            @ApiResponse(responseCode = "403", description = "Acesso negado"),
            @ApiResponse(responseCode = "404", description = "Cliente nÃƒÂ£o encontrado")
    })
    public ResponseEntity<ClienteResponseDTO> buscarPorId(@PathVariable Long id) {
        ClienteResponseDTO response = clienteService.buscarPorId(id);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}/resumo")
    @Operation(summary = "Obter resumo e histórico consolidado do cliente", description = "Retorna contadores de equipamentos, ordens de serviço, status de OS abertas, última visita e valor acumulado.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Resumo retornado com sucesso"),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "404", description = "Cliente não encontrado")
    })
    public ResponseEntity<ClienteResumoDTO> obterResumo(@PathVariable Long id) {
        return ResponseEntity.ok(clienteService.obterResumo(id));
    }

    @GetMapping("/{id}/historico")
    @Operation(summary = "Consultar histórico de Ordens de Serviço do cliente", description = "Retorna lista paginada de todas as OS do cliente com detalhes e valores.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Histórico retornado com sucesso"),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "404", description = "Cliente não encontrado")
    })
    public ResponseEntity<PageResponse<OrdemServicoResponseDTO>> obterHistorico(
            @PathVariable Long id,
            @RequestParam(name = "status", required = false) StatusOrdemServico status,
            @PageableDefault(size = 20, sort = "dataEntrada", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        return ResponseEntity.ok(ordemServicoService.listarPorCliente(id, status, pageable));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Atualizar cliente", description = "Atualiza dados cadastrais e endereÃƒÂ§o de um cliente existente.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Cliente atualizado com sucesso"),
            @ApiResponse(responseCode = "400", description = "Dados de entrada invÃƒÂ¡lidos"),
            @ApiResponse(responseCode = "401", description = "NÃƒÂ£o autenticado"),
            @ApiResponse(responseCode = "403", description = "Acesso negado"),
            @ApiResponse(responseCode = "404", description = "Cliente nÃƒÂ£o encontrado"),
            @ApiResponse(responseCode = "409", description = "Conflito de duplicidade com outro cliente cadastrado")
    })
    public ResponseEntity<ClienteResponseDTO> atualizar(
            @PathVariable Long id,
            @Valid @RequestBody ClienteUpdateDTO dto,
            Authentication authentication,
            HttpServletRequest request
    ) {
        Long usuarioId = extrairUsuarioId(authentication);
        String ip = request != null ? request.getRemoteAddr() : "127.0.0.1";
        ClienteResponseDTO response = clienteService.atualizar(id, dto, usuarioId, ip);
        return ResponseEntity.ok(response);
    }

    @PatchMapping("/{id}/status")
    @Operation(summary = "Ativar ou inativar cliente", description = "Altera o status ativo do cliente de forma rÃƒÂ¡pida.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Status alterado com sucesso"),
            @ApiResponse(responseCode = "400", description = "ParÃƒÂ¢metro invÃƒÂ¡lido"),
            @ApiResponse(responseCode = "401", description = "NÃƒÂ£o autenticado"),
            @ApiResponse(responseCode = "403", description = "Acesso negado"),
            @ApiResponse(responseCode = "404", description = "Cliente nÃƒÂ£o encontrado")
    })
    public ResponseEntity<ClienteResponseDTO> alterarStatus(
            @PathVariable Long id,
            @Valid @RequestBody ClienteStatusDTO dto,
            Authentication authentication,
            HttpServletRequest request
    ) {
        Long usuarioId = extrairUsuarioId(authentication);
        String ip = request != null ? request.getRemoteAddr() : "127.0.0.1";
        ClienteResponseDTO response = clienteService.alterarStatus(id, dto.ativo(), usuarioId, ip);
        return ResponseEntity.ok(response);
    }

    private Long extrairUsuarioId(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            return null;
        }
        return usuarioRepository.findByEmail(authentication.getName())
                .map(Usuario::getId)
                .orElse(null);
    }
}
