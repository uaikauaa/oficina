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
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
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
@Tag(name = "Ordens de ServiÃƒÂ§o", description = "Fluxo central de atendimento tÃƒÂ©cnico para mÃƒÂ¡quinas de solda e geradores de energia")
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
    @Operation(summary = "Abrir nova Ordem de ServiÃƒÂ§o", description = "Abre uma OS com status ABERTA vinculando um cliente e um equipamento do prÃƒÂ³prio cliente.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Ordem de ServiÃƒÂ§o criada com sucesso"),
            @ApiResponse(responseCode = "400", description = "Dados invÃƒÂ¡lidos ou equipamento nÃƒÂ£o pertence ao cliente"),
            @ApiResponse(responseCode = "401", description = "NÃƒÂ£o autenticado"),
            @ApiResponse(responseCode = "404", description = "Cliente ou equipamento nÃƒÂ£o encontrado"),
            @ApiResponse(responseCode = "409", description = "NÃƒÂºmero de OS jÃƒÂ¡ existente")
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
    @Operation(summary = "Listar Ordens de ServiÃƒÂ§o", description = "Retorna lista paginada de OS com filtros por termo, status e perÃƒÂ­odo.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Lista retornada com sucesso"),
            @ApiResponse(responseCode = "401", description = "NÃƒÂ£o autenticado")
    })
    public ResponseEntity<PageResponse<OrdemServicoResponseDTO>> listar(
            @Parameter(description = "Busca por nÃƒÂºmero OS, cliente, equipamento ou nÃƒÂºmero de sÃƒÂ©rie")
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

    @GetMapping("/api/ordens-servico/contadores-dashboard")
    @Operation(summary = "Obter contadores de Ordens de Serviço para o painel de atenção da Dashboard")
    public ResponseEntity<OrdemServicoContadoresDashboardDTO> obterContadoresDashboard() {
        return ResponseEntity.ok(ordemServicoService.obterContadoresDashboard());
    }

    @GetMapping("/api/ordens-servico/{id}")
    @Operation(summary = "Buscar Ordem de ServiÃƒÂ§o por ID", description = "Retorna os detalhes completos da OS, cliente, equipamento e financeiro.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Ordem de ServiÃƒÂ§o encontrada"),
            @ApiResponse(responseCode = "401", description = "NÃƒÂ£o autenticado"),
            @ApiResponse(responseCode = "404", description = "Ordem de ServiÃƒÂ§o nÃƒÂ£o encontrada")
    })
    public ResponseEntity<OrdemServicoResponseDTO> buscarPorId(@PathVariable Long id) {
        return ResponseEntity.ok(ordemServicoService.buscarPorId(id));
    }

    @GetMapping(value = "/api/ordens-servico/{id}/pdf", produces = "application/pdf")
    @Operation(summary = "Gerar PDF oficial da Ordem de Serviço",
            description = "Gera o documento PDF vetorial A4 formatado para impressão ou entrega ao cliente com preços históricos congelados.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "PDF gerado com sucesso"),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "404", description = "Ordem de Serviço não encontrada")
    })
    public ResponseEntity<byte[]> gerarPdf(@PathVariable Long id) {
        byte[] pdfBytes = ordemServicoService.gerarPdf(id);
        OrdemServicoResponseDTO os = ordemServicoService.buscarPorId(id);
        String filename = "OS-" + (os.numeroOs() != null ? os.numeroOs() : id) + ".pdf";

        return ResponseEntity.ok()
                .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename + "\"")
                .header(org.springframework.http.HttpHeaders.CONTENT_TYPE, "application/pdf")
                .body(pdfBytes);
    }

    @PutMapping("/api/ordens-servico/{id}")
    @Operation(summary = "Atualizar Ordem de ServiÃƒÂ§o", description = "Atualiza dados tÃƒÂ©cnicos (diagnÃƒÂ³stico, soluÃƒÂ§ÃƒÂ£o, testes) e valores financeiros.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Ordem de ServiÃƒÂ§o atualizada com sucesso"),
            @ApiResponse(responseCode = "400", description = "Dados invÃƒÂ¡lidos ou OS concluÃƒÂ­da/cancelada"),
            @ApiResponse(responseCode = "401", description = "NÃƒÂ£o autenticado"),
            @ApiResponse(responseCode = "404", description = "Ordem de ServiÃƒÂ§o nÃƒÂ£o encontrada")
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
    @Operation(summary = "Alterar status da Ordem de ServiÃƒÂ§o", description = "AvanÃƒÂ§a o ciclo de vida da OS, validando testes obrigatÃƒÂ³rios para PRONTA e conclusÃƒÂ£o automÃƒÂ¡tica.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Status atualizado com sucesso"),
            @ApiResponse(responseCode = "400", description = "TransiÃƒÂ§ÃƒÂ£o invÃƒÂ¡lida ou ausÃƒÂªncia de testes de bancada"),
            @ApiResponse(responseCode = "401", description = "NÃƒÂ£o autenticado"),
            @ApiResponse(responseCode = "404", description = "Ordem de ServiÃƒÂ§o nÃƒÂ£o encontrada")
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
    // Endpoints aninhados: HistÃƒÂ³rico por Cliente e por MÃƒÂ¡quina
    // =========================================================================

    @GetMapping("/api/clientes/{clienteId}/ordens-servico")
    @Operation(summary = "Listar Ordens de ServiÃƒÂ§o do cliente", description = "Retorna o histÃƒÂ³rico de todas as OS abertas para um determinado cliente.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "HistÃƒÂ³rico retornado com sucesso"),
            @ApiResponse(responseCode = "401", description = "NÃƒÂ£o autenticado"),
            @ApiResponse(responseCode = "404", description = "Cliente nÃƒÂ£o encontrado")
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
    @Operation(summary = "Listar histÃƒÂ³rico de Ordens de ServiÃƒÂ§o do equipamento", description = "Permite responder: 'Quantas vezes essa mÃƒÂ¡quina jÃƒÂ¡ veio para a oficina e o que foi feito nela?'.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "HistÃƒÂ³rico do equipamento retornado com sucesso"),
            @ApiResponse(responseCode = "401", description = "NÃƒÂ£o autenticado"),
            @ApiResponse(responseCode = "404", description = "Equipamento nÃƒÂ£o encontrado")
    })
    public ResponseEntity<PageResponse<OrdemServicoResponseDTO>> listarPorMaquina(
            @PathVariable Long maquinaId,
            @PageableDefault(size = 20, sort = "dataEntrada", direction = Sort.Direction.DESC)
            Pageable pageable
    ) {
        return ResponseEntity.ok(ordemServicoService.listarPorMaquina(maquinaId, pageable));
    }

    // =========================================================================
    // Endpoints de PeÃƒÂ§as Utilizadas na Ordem de ServiÃƒÂ§o
    // =========================================================================

    @GetMapping("/api/ordens-servico/{id}/itens")
    @Operation(summary = "Listar peÃƒÂ§as e serviÃƒÂ§os utilizados na Ordem de ServiÃƒÂ§o")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Lista de itens retornada com sucesso"),
            @ApiResponse(responseCode = "404", description = "Ordem de ServiÃƒÂ§o nÃƒÂ£o encontrada")
    })
    public ResponseEntity<List<OrdemServicoItemResponseDTO>> listarItens(@PathVariable Long id) {
        return ResponseEntity.ok(ordemServicoItemService.listarItens(id));
    }

    @PostMapping("/api/ordens-servico/{id}/itens")
    @Operation(summary = "Adicionar peÃƒÂ§a ÃƒÂ  Ordem de ServiÃƒÂ§o", description = "Realiza baixa atÃƒÂ´mica no estoque com congelamento de preÃƒÂ§o histÃƒÂ³rico e recalculo da OS.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "PeÃƒÂ§a adicionada ÃƒÂ  OS com sucesso"),
            @ApiResponse(responseCode = "400", description = "Estoque insuficiente ou OS em status terminal"),
            @ApiResponse(responseCode = "404", description = "OS ou produto nÃƒÂ£o encontrado")
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
    @Operation(summary = "Remover peÃƒÂ§a da Ordem de ServiÃƒÂ§o", description = "Remove o item da OS e estorna a quantidade para o estoque.")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Item removido e estoque estornado"),
            @ApiResponse(responseCode = "400", description = "OS em status terminal"),
            @ApiResponse(responseCode = "404", description = "Item ou OS nÃƒÂ£o encontrado")
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
