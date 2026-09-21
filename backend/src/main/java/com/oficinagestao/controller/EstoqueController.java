package com.oficinagestao.controller;
import com.oficinagestao.repository.*;

import com.oficinagestao.entity.*;
import com.oficinagestao.dto.*;
import com.oficinagestao.service.*;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;

@RestController
@RequestMapping("/api/estoque")
@Tag(name = "Estoque", description = "Controle físico de estoque, saldos e histórico de movimentações")
@SecurityRequirement(name = "cookieAuth")
@SecurityRequirement(name = "bearerAuth")
public class EstoqueController {

    private final EstoqueService estoqueService;
    private final UsuarioRepository usuarioRepository;

    public EstoqueController(EstoqueService estoqueService, UsuarioRepository usuarioRepository) {
        this.estoqueService = estoqueService;
        this.usuarioRepository = usuarioRepository;
    }

    @GetMapping("/resumo")
    @Operation(summary = "Obter indicadores e resumo geral de estoque")
    public ResponseEntity<EstoqueResumoDTO> obterResumo() {
        return ResponseEntity.ok(estoqueService.obterResumoEstoque());
    }

    @PostMapping("/movimentar")
    @Operation(summary = "Registrar movimentação manual de estoque (Entrada, Saída, Ajuste)")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Movimentação registrada com sucesso"),
            @ApiResponse(responseCode = "400", description = "Dados inválidos ou estoque insuficiente"),
            @ApiResponse(responseCode = "404", description = "Produto não encontrado")
    })
    public ResponseEntity<EstoqueMovimentacaoResponseDTO> movimentar(
            @Valid @RequestBody MovimentacaoManualDTO dto,
            Authentication authentication,
            HttpServletRequest request
    ) {
        Long usuarioId = extrairUsuarioId(authentication);
        EstoqueMovimentacaoResponseDTO response = estoqueService.registrarMovimentacaoManual(dto, usuarioId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/entrada")
    @Operation(summary = "Registrar entrada de peças/produtos no estoque")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Entrada registrada com sucesso"),
            @ApiResponse(responseCode = "400", description = "Dados inválidos"),
            @ApiResponse(responseCode = "404", description = "Produto não encontrado")
    })
    public ResponseEntity<EstoqueMovimentacaoResponseDTO> registrarEntrada(
            @Valid @RequestBody EstoqueEntradaDTO dto,
            Authentication authentication,
            HttpServletRequest request
    ) {
        Long usuarioId = extrairUsuarioId(authentication);
        MovimentacaoManualDTO movDTO = new MovimentacaoManualDTO(
                dto.produtoId(),
                TipoMovimentacaoEstoque.ENTRADA,
                dto.quantidade(),
                dto.valorUnitario(),
                dto.motivo()
        );
        EstoqueMovimentacaoResponseDTO response = estoqueService.registrarMovimentacaoManual(movDTO, usuarioId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/saida")
    @Operation(summary = "Registrar saída manual de peças/produtos do estoque")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Saída registrada com sucesso"),
            @ApiResponse(responseCode = "400", description = "Dados inválidos ou estoque insuficiente"),
            @ApiResponse(responseCode = "404", description = "Produto não encontrado")
    })
    public ResponseEntity<EstoqueMovimentacaoResponseDTO> registrarSaida(
            @Valid @RequestBody EstoqueSaidaDTO dto,
            Authentication authentication,
            HttpServletRequest request
    ) {
        Long usuarioId = extrairUsuarioId(authentication);
        MovimentacaoManualDTO movDTO = new MovimentacaoManualDTO(
                dto.produtoId(),
                TipoMovimentacaoEstoque.SAIDA,
                dto.quantidade(),
                null,
                dto.motivo()
        );
        EstoqueMovimentacaoResponseDTO response = estoqueService.registrarMovimentacaoManual(movDTO, usuarioId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/ajuste")
    @Operation(summary = "Registrar ajuste de inventário (positivo ou negativo) no estoque")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Ajuste registrado com sucesso"),
            @ApiResponse(responseCode = "400", description = "Dados inválidos ou saldo insuficiente para ajuste negativo"),
            @ApiResponse(responseCode = "404", description = "Produto não encontrado")
    })
    public ResponseEntity<EstoqueMovimentacaoResponseDTO> registrarAjuste(
            @Valid @RequestBody EstoqueAjusteDTO dto,
            Authentication authentication,
            HttpServletRequest request
    ) {
        Long usuarioId = extrairUsuarioId(authentication);
        MovimentacaoManualDTO movDTO = new MovimentacaoManualDTO(
                dto.produtoId(),
                dto.tipoMovimentacao(),
                dto.quantidade(),
                null,
                dto.motivo()
        );
        EstoqueMovimentacaoResponseDTO response = estoqueService.registrarMovimentacaoManual(movDTO, usuarioId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/movimentacoes")
    @Operation(summary = "Consultar histórico de movimentações de estoque com filtros e paginação")
    public ResponseEntity<PageResponse<EstoqueMovimentacaoResponseDTO>> listarMovimentacoes(
            @RequestParam(required = false) Long produtoId,
            @RequestParam(required = false) TipoMovimentacaoEstoque tipo,
            @RequestParam(required = false) OffsetDateTime dataInicio,
            @RequestParam(required = false) OffsetDateTime dataFim,
            @RequestParam(required = false) String numeroOs,
            @RequestParam(required = false) String termo,
            @PageableDefault(size = 20, sort = "dataMovimentacao", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        Page<EstoqueMovimentacaoResponseDTO> page = estoqueService.listarMovimentacoes(
                produtoId,
                tipo,
                dataInicio,
                dataFim,
                numeroOs,
                termo,
                pageable
        );
        return ResponseEntity.ok(PageResponse.from(page));
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
