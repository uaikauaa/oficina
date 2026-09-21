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
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;


@RestController
@RequestMapping("/api/fornecedores")
@Tag(name = "Fornecedores", description = "Gestão de fornecedores de peças e insumos para equipamentos técnicos")
@SecurityRequirement(name = "cookieAuth")
@SecurityRequirement(name = "bearerAuth")
public class FornecedorController {

    private final FornecedorService fornecedorService;
    private final UsuarioRepository usuarioRepository;

    public FornecedorController(FornecedorService fornecedorService, UsuarioRepository usuarioRepository) {
        this.fornecedorService = fornecedorService;
        this.usuarioRepository = usuarioRepository;
    }

    @PostMapping
    @Operation(summary = "Cadastrar novo fornecedor")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Fornecedor cadastrado com sucesso"),
            @ApiResponse(responseCode = "400", description = "Dados inválidos ou CNPJ já cadastrado")
    })
    public ResponseEntity<FornecedorResponseDTO> cadastrar(
            @Valid @RequestBody FornecedorCreateDTO dto,
            Authentication authentication,
            HttpServletRequest request
    ) {
        Long usuarioId = extrairUsuarioId(authentication);
        FornecedorResponseDTO response = fornecedorService.cadastrar(dto, usuarioId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    @Operation(summary = "Listar fornecedores com filtros e paginação")
    public ResponseEntity<PageResponse<FornecedorResponseDTO>> listar(
            @RequestParam(required = false) String termo,
            @RequestParam(required = false) Boolean ativo,
            @PageableDefault(size = 20, sort = "razaoSocial", direction = Sort.Direction.ASC) Pageable pageable
    ) {
        Page<FornecedorResponseDTO> page = fornecedorService.listar(termo, ativo, pageable);
        return ResponseEntity.ok(PageResponse.from(page));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Buscar fornecedor por ID")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Fornecedor localizado"),
            @ApiResponse(responseCode = "404", description = "Fornecedor não encontrado")
    })
    public ResponseEntity<FornecedorResponseDTO> buscarPorId(@PathVariable Long id) {
        return ResponseEntity.ok(fornecedorService.buscarPorId(id));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Atualizar dados do fornecedor")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Fornecedor atualizado com sucesso"),
            @ApiResponse(responseCode = "400", description = "Dados inválidos ou conflito de CNPJ"),
            @ApiResponse(responseCode = "404", description = "Fornecedor não encontrado")
    })
    public ResponseEntity<FornecedorResponseDTO> atualizar(
            @PathVariable Long id,
            @Valid @RequestBody FornecedorUpdateDTO dto,
            Authentication authentication,
            HttpServletRequest request
    ) {
        Long usuarioId = extrairUsuarioId(authentication);
        return ResponseEntity.ok(fornecedorService.atualizar(id, dto, usuarioId, request));
    }

    @PatchMapping("/{id}/status")
    @Operation(summary = "Ativar ou inativar fornecedor")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Status alterado com sucesso"),
            @ApiResponse(responseCode = "404", description = "Fornecedor não encontrado")
    })
    public ResponseEntity<FornecedorResponseDTO> alterarStatus(
            @PathVariable Long id,
            @Valid @RequestBody StatusUpdateDTO dto,
            Authentication authentication,
            HttpServletRequest request
    ) {
        Long usuarioId = extrairUsuarioId(authentication);
        return ResponseEntity.ok(fornecedorService.alterarStatus(id, dto.ativo(), usuarioId, request));
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
