package com.oficinagestao.controller;

import com.oficinagestao.dto.CategoriaCreateDTO;
import com.oficinagestao.dto.CategoriaResponseDTO;
import com.oficinagestao.dto.CategoriaUpdateDTO;
import com.oficinagestao.dto.PageResponse;
import com.oficinagestao.dto.StatusUpdateDTO;
import com.oficinagestao.security.SecurityUtils;
import com.oficinagestao.service.CategoriaService;
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

import java.util.List;

@RestController
@RequestMapping("/api/categorias")
@Tag(name = "Categorias", description = "Gestão de categorias de peças e insumos para máquinas de solda e geradores")
@SecurityRequirement(name = "cookieAuth")
@SecurityRequirement(name = "bearerAuth")
public class CategoriaController {

    private final CategoriaService categoriaService;

    public CategoriaController(CategoriaService categoriaService) {
        this.categoriaService = categoriaService;
    }

    @PostMapping
    @Operation(summary = "Cadastrar nova categoria técnica")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Categoria cadastrada com sucesso"),
            @ApiResponse(responseCode = "400", description = "Dados inválidos"),
            @ApiResponse(responseCode = "409", description = "Nome de categoria já existente")
    })
    public ResponseEntity<CategoriaResponseDTO> cadastrar(
            @Valid @RequestBody CategoriaCreateDTO dto,
            Authentication authentication,
            HttpServletRequest request
    ) {
        Long usuarioId = SecurityUtils.extractUserId(authentication);
        CategoriaResponseDTO response = categoriaService.cadastrar(dto, usuarioId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    @Operation(summary = "Listar categorias com filtros e paginação")
    public ResponseEntity<PageResponse<CategoriaResponseDTO>> listar(
            @RequestParam(required = false) String termo,
            @RequestParam(required = false) Boolean ativo,
            @PageableDefault(size = 20, sort = "nome", direction = Sort.Direction.ASC) Pageable pageable
    ) {
        Page<CategoriaResponseDTO> page = categoriaService.listar(termo, ativo, pageable);
        return ResponseEntity.ok(PageResponse.from(page));
    }

    @GetMapping("/ativas")
    @Operation(summary = "Listar todas as categorias ativas (para seleção em formulários)")
    public ResponseEntity<List<CategoriaResponseDTO>> listarAtivas() {
        return ResponseEntity.ok(categoriaService.listarAtivas());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Buscar categoria por ID")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Categoria encontrada"),
            @ApiResponse(responseCode = "404", description = "Categoria não encontrada")
    })
    public ResponseEntity<CategoriaResponseDTO> buscarPorId(@PathVariable Long id) {
        return ResponseEntity.ok(categoriaService.buscarPorId(id));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Atualizar dados da categoria")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Categoria atualizada com sucesso"),
            @ApiResponse(responseCode = "400", description = "Dados inválidos"),
            @ApiResponse(responseCode = "404", description = "Categoria não encontrada"),
            @ApiResponse(responseCode = "409", description = "Nome já em uso por outra categoria")
    })
    public ResponseEntity<CategoriaResponseDTO> atualizar(
            @PathVariable Long id,
            @Valid @RequestBody CategoriaUpdateDTO dto,
            Authentication authentication,
            HttpServletRequest request
    ) {
        Long usuarioId = SecurityUtils.extractUserId(authentication);
        return ResponseEntity.ok(categoriaService.atualizar(id, dto, usuarioId, request));
    }

    @PatchMapping("/{id}/status")
    @Operation(summary = "Ativar ou inativar categoria")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Status alterado com sucesso"),
            @ApiResponse(responseCode = "404", description = "Categoria não encontrada")
    })
    public ResponseEntity<CategoriaResponseDTO> alterarStatus(
            @PathVariable Long id,
            @Valid @RequestBody StatusUpdateDTO dto,
            Authentication authentication,
            HttpServletRequest request
    ) {
        Long usuarioId = SecurityUtils.extractUserId(authentication);
        return ResponseEntity.ok(categoriaService.alterarStatus(id, dto.ativo(), usuarioId, request));
    }
}
