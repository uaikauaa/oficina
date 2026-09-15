package com.oficinagestao.ordem;

import com.oficinagestao.common.PageResponse;
import com.oficinagestao.ordem.dto.OrdemServicoCreateDTO;
import com.oficinagestao.ordem.dto.OrdemServicoResponseDTO;
import com.oficinagestao.ordem.dto.OrdemServicoStatusDTO;
import com.oficinagestao.ordem.dto.OrdemServicoUpdateDTO;
import com.oficinagestao.usuario.Usuario;
import com.oficinagestao.usuario.UsuarioRepository;
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
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import com.oficinagestao.ordem.dto.OrdemServicoItemCreateDTO;
import com.oficinagestao.ordem.dto.OrdemServicoItemResponseDTO;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;
import java.util.List;

@RestController
@Tag(name = "Ordens de Serviço", description = "Fluxo central de atendimento técnico para máquinas de solda e geradores de energia")
@SecurityRequirement(name = "cookieAuth")
@SecurityRequirement(name = "bearerAuth")
public class OrdemServicoController {

    private final OrdemServicoService ordemServicoService;
    private final OrdemServicoItemService ordemServicoItemService;
    private final UsuarioRepository usuarioRepository;

    public OrdemServicoController(
            OrdemServicoService ordemServicoService,
            OrdemServicoItemService ordemServicoItemService,
            UsuarioRepository usuarioRepository
    ) {
        this.ordemServicoService = ordemServicoService;
        this.ordemServicoItemService = ordemServicoItemService;
        this.usuarioRepository = usuarioRepository;
    }

    // =========================================================================
    // Endpoints globais: /api/ordens-servico
    // =========================================================================

    @PostMapping("/api/ordens-servico")
    @Operation(summary = "Abrir nova Ordem de Serviço", description = "Abre uma OS com status ABERTA vinculando um cliente e um equipamento do próprio cliente.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Ordem de Serviço criada com sucesso"),
            @ApiResponse(responseCode = "400", description = "Dados inválidos ou equipamento não pertence ao cliente"),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "404", description = "Cliente ou equipamento não encontrado"),
            @ApiResponse(responseCode = "409", description = "Número de OS já existente")
    })
    public ResponseEntity<OrdemServicoResponseDTO> criar(
            @Valid @RequestBody OrdemServicoCreateDTO dto,
            Authentication authentication,
            HttpServletRequest request
    ) {
        Long usuarioId = extrairUsuarioId(authentication);
        String ip = request != null ? request.getRemoteAddr() : "127.0.0.1";
        OrdemServicoResponseDTO response = ordemServicoService.criar(dto, usuarioId, ip);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/api/ordens-servico")
    @Operation(summary = "Listar Ordens de Serviço", description = "Retorna lista paginada de OS com filtros por termo, status e período.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Lista retornada com sucesso"),
            @ApiResponse(responseCode = "401", description = "Não autenticado")
    })
    public ResponseEntity<PageResponse<OrdemServicoResponseDTO>> listar(
            @Parameter(description = "Busca por número OS, cliente, equipamento ou número de série")
            @RequestParam(name = "termo", required = false) String termo,

            @Parameter(description = "Filtro por status")
            @RequestParam(name = "status", required = false) StatusOrdemServico status,

            @Parameter(description = "Data inicial de entrada (ISO-8601)")
            @RequestParam(name = "dataInicio", required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime dataInicio,

            @Parameter(description = "Data final de entrada (ISO-8601)")
            @RequestParam(name = "dataFim", required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime dataFim,

            @PageableDefault(size = 20, sort = "dataEntrada", direction = Sort.Direction.DESC)
            Pageable pageable
    ) {
        return ResponseEntity.ok(ordemServicoService.listar(termo, status, dataInicio, dataFim, pageable));
    }

    @GetMapping("/api/ordens-servico/{id}")
    @Operation(summary = "Buscar Ordem de Serviço por ID", description = "Retorna os detalhes completos da OS, cliente, equipamento e financeiro.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Ordem de Serviço encontrada"),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "404", description = "Ordem de Serviço não encontrada")
    })
    public ResponseEntity<OrdemServicoResponseDTO> buscarPorId(@PathVariable Long id) {
        return ResponseEntity.ok(ordemServicoService.buscarPorId(id));
    }

    @PutMapping("/api/ordens-servico/{id}")
    @Operation(summary = "Atualizar Ordem de Serviço", description = "Atualiza dados técnicos (diagnóstico, solução, testes) e valores financeiros.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Ordem de Serviço atualizada com sucesso"),
            @ApiResponse(responseCode = "400", description = "Dados inválidos ou OS concluída/cancelada"),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "404", description = "Ordem de Serviço não encontrada")
    })
    public ResponseEntity<OrdemServicoResponseDTO> atualizar(
            @PathVariable Long id,
            @Valid @RequestBody OrdemServicoUpdateDTO dto,
            Authentication authentication,
            HttpServletRequest request
    ) {
        Long usuarioId = extrairUsuarioId(authentication);
        String ip = request != null ? request.getRemoteAddr() : "127.0.0.1";
        return ResponseEntity.ok(ordemServicoService.atualizar(id, dto, usuarioId, ip));
    }

    @PatchMapping("/api/ordens-servico/{id}/status")
    @Operation(summary = "Alterar status da Ordem de Serviço", description = "Avança o ciclo de vida da OS, validando testes obrigatórios para PRONTA e conclusão automática.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Status atualizado com sucesso"),
            @ApiResponse(responseCode = "400", description = "Transição inválida ou ausência de testes de bancada"),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "404", description = "Ordem de Serviço não encontrada")
    })
    public ResponseEntity<OrdemServicoResponseDTO> alterarStatus(
            @PathVariable Long id,
            @Valid @RequestBody OrdemServicoStatusDTO dto,
            Authentication authentication,
            HttpServletRequest request
    ) {
        Long usuarioId = extrairUsuarioId(authentication);
        String ip = request != null ? request.getRemoteAddr() : "127.0.0.1";
        return ResponseEntity.ok(ordemServicoService.alterarStatus(id, dto, usuarioId, ip));
    }

    // =========================================================================
    // Endpoints aninhados: Histórico por Cliente e por Máquina
    // =========================================================================

    @GetMapping("/api/clientes/{clienteId}/ordens-servico")
    @Operation(summary = "Listar Ordens de Serviço do cliente", description = "Retorna o histórico de todas as OS abertas para um determinado cliente.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Histórico retornado com sucesso"),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "404", description = "Cliente não encontrado")
    })
    public ResponseEntity<PageResponse<OrdemServicoResponseDTO>> listarPorCliente(
            @PathVariable Long clienteId,
            @RequestParam(name = "status", required = false) StatusOrdemServico status,
            @PageableDefault(size = 20, sort = "dataEntrada", direction = Sort.Direction.DESC)
            Pageable pageable
    ) {
        return ResponseEntity.ok(ordemServicoService.listarPorCliente(clienteId, status, pageable));
    }

    @GetMapping("/api/maquinas/{maquinaId}/ordens-servico")
    @Operation(summary = "Listar histórico de Ordens de Serviço do equipamento", description = "Permite responder: 'Quantas vezes essa máquina já veio para a oficina e o que foi feito nela?'.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Histórico do equipamento retornado com sucesso"),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "404", description = "Equipamento não encontrado")
    })
    public ResponseEntity<PageResponse<OrdemServicoResponseDTO>> listarPorMaquina(
            @PathVariable Long maquinaId,
            @PageableDefault(size = 20, sort = "dataEntrada", direction = Sort.Direction.DESC)
            Pageable pageable
    ) {
        return ResponseEntity.ok(ordemServicoService.listarPorMaquina(maquinaId, pageable));
    }

    // =========================================================================
    // Endpoints de Peças Utilizadas na Ordem de Serviço
    // =========================================================================

    @GetMapping("/api/ordens-servico/{id}/itens")
    @Operation(summary = "Listar peças e serviços utilizados na Ordem de Serviço")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Lista de itens retornada com sucesso"),
            @ApiResponse(responseCode = "404", description = "Ordem de Serviço não encontrada")
    })
    public ResponseEntity<List<OrdemServicoItemResponseDTO>> listarItens(@PathVariable Long id) {
        return ResponseEntity.ok(ordemServicoItemService.listarItens(id));
    }

    @PostMapping("/api/ordens-servico/{id}/itens")
    @Operation(summary = "Adicionar peça à Ordem de Serviço", description = "Realiza baixa atômica no estoque com congelamento de preço histórico e recalculo da OS.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Peça adicionada à OS com sucesso"),
            @ApiResponse(responseCode = "400", description = "Estoque insuficiente ou OS em status terminal"),
            @ApiResponse(responseCode = "404", description = "OS ou produto não encontrado")
    })
    public ResponseEntity<OrdemServicoItemResponseDTO> adicionarPeca(
            @PathVariable Long id,
            @Valid @RequestBody OrdemServicoItemCreateDTO dto,
            Authentication authentication,
            HttpServletRequest request
    ) {
        Long usuarioId = extrairUsuarioId(authentication);
        OrdemServicoItemResponseDTO response = ordemServicoItemService.adicionarPeca(id, dto, usuarioId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @DeleteMapping("/api/ordens-servico/{id}/itens/{itemId}")
    @Operation(summary = "Remover peça da Ordem de Serviço", description = "Remove o item da OS e estorna a quantidade para o estoque.")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Item removido e estoque estornado"),
            @ApiResponse(responseCode = "400", description = "OS em status terminal"),
            @ApiResponse(responseCode = "404", description = "Item ou OS não encontrado")
    })
    public ResponseEntity<Void> removerItem(
            @PathVariable Long id,
            @PathVariable Long itemId,
            Authentication authentication,
            HttpServletRequest request
    ) {
        Long usuarioId = extrairUsuarioId(authentication);
        ordemServicoItemService.removerItem(id, itemId, usuarioId, request);
        return ResponseEntity.noContent().build();
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    private Long extrairUsuarioId(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            return null;
        }
        return usuarioRepository.findByEmail(authentication.getName())
                .map(Usuario::getId)
                .orElse(null);
    }
}
