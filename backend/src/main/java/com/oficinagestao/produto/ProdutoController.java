package com.oficinagestao.produto;

import com.oficinagestao.common.PageResponse;
import com.oficinagestao.produto.dto.CompatibilidadeResponseDTO;
import com.oficinagestao.produto.dto.ProdutoCompatibilidadeDTO;
import com.oficinagestao.produto.dto.ProdutoCreateDTO;
import com.oficinagestao.produto.dto.ProdutoResponseDTO;
import com.oficinagestao.produto.dto.ProdutoUpdateDTO;
import com.oficinagestao.usuario.Usuario;
import com.oficinagestao.usuario.UsuarioRepository;
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
import org.springframework.web.bind.annotation.DeleteMapping;
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
import java.util.Map;

@RestController
@RequestMapping("/api/produtos")
@Tag(name = "Produtos e Peças", description = "Catálogo de peças, componentes técnicos e insumos para máquinas de solda e geradores")
@SecurityRequirement(name = "cookieAuth")
@SecurityRequirement(name = "bearerAuth")
public class ProdutoController {

    private final ProdutoService produtoService;
    private final UsuarioRepository usuarioRepository;

    public ProdutoController(ProdutoService produtoService, UsuarioRepository usuarioRepository) {
        this.produtoService = produtoService;
        this.usuarioRepository = usuarioRepository;
    }

    @PostMapping
    @Operation(summary = "Cadastrar nova peça ou componente técnico")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Produto/peça cadastrado com sucesso"),
            @ApiResponse(responseCode = "400", description = "Dados inválidos"),
            @ApiResponse(responseCode = "409", description = "Código de produto já cadastrado")
    })
    public ResponseEntity<ProdutoResponseDTO> cadastrar(
            @Valid @RequestBody ProdutoCreateDTO dto,
            Authentication authentication,
            HttpServletRequest request
    ) {
        Long usuarioId = extrairUsuarioId(authentication);
        ProdutoResponseDTO response = produtoService.cadastrar(dto, usuarioId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    @Operation(summary = "Listar produtos e peças com filtros e paginação")
    public ResponseEntity<PageResponse<ProdutoResponseDTO>> listar(
            @RequestParam(required = false) String termo,
            @RequestParam(required = false) TipoProduto tipo,
            @RequestParam(required = false) Long fornecedorId,
            @RequestParam(required = false) Boolean ativo,
            @RequestParam(required = false) Boolean estoqueBaixo,
            @PageableDefault(size = 20, sort = "nome", direction = Sort.Direction.ASC) Pageable pageable
    ) {
        Page<ProdutoResponseDTO> page = produtoService.listar(termo, tipo, fornecedorId, ativo, estoqueBaixo, pageable);
        return ResponseEntity.ok(PageResponse.from(page));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Buscar produto ou peça por ID")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Produto localizado"),
            @ApiResponse(responseCode = "404", description = "Produto não encontrado")
    })
    public ResponseEntity<ProdutoResponseDTO> buscarPorId(@PathVariable Long id) {
        return ResponseEntity.ok(produtoService.buscarPorId(id));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Atualizar dados do produto ou peça")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Produto atualizado com sucesso"),
            @ApiResponse(responseCode = "400", description = "Dados inválidos"),
            @ApiResponse(responseCode = "404", description = "Produto não encontrado"),
            @ApiResponse(responseCode = "409", description = "Código já utilizado por outro produto")
    })
    public ResponseEntity<ProdutoResponseDTO> atualizar(
            @PathVariable Long id,
            @Valid @RequestBody ProdutoUpdateDTO dto,
            Authentication authentication,
            HttpServletRequest request
    ) {
        Long usuarioId = extrairUsuarioId(authentication);
        return ResponseEntity.ok(produtoService.atualizar(id, dto, usuarioId, request));
    }

    @PatchMapping("/{id}/status")
    @Operation(summary = "Ativar ou inativar produto/peça")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Status alterado com sucesso"),
            @ApiResponse(responseCode = "404", description = "Produto não encontrado")
    })
    public ResponseEntity<ProdutoResponseDTO> alterarStatus(
            @PathVariable Long id,
            @RequestBody Map<String, Boolean> body,
            Authentication authentication,
            HttpServletRequest request
    ) {
        boolean ativo = body.getOrDefault("ativo", true);
        Long usuarioId = extrairUsuarioId(authentication);
        return ResponseEntity.ok(produtoService.alterarStatus(id, ativo, usuarioId, request));
    }

    // =========================================================================
    // Compatibilidade Peça ↔ Máquina
    // =========================================================================

    @GetMapping("/{id}/compatibilidades")
    @Operation(summary = "Listar equipamentos compatíveis com a peça")
    public ResponseEntity<List<CompatibilidadeResponseDTO>> listarCompatibilidades(@PathVariable Long id) {
        return ResponseEntity.ok(produtoService.listarCompatibilidades(id));
    }

    @PostMapping("/{id}/compatibilidades")
    @Operation(summary = "Vincular equipamento compatível à peça")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Compatibilidade registrada com sucesso"),
            @ApiResponse(responseCode = "400", description = "Máquina já cadastrada como compatível"),
            @ApiResponse(responseCode = "404", description = "Produto ou máquina não encontrado")
    })
    public ResponseEntity<CompatibilidadeResponseDTO> adicionarCompatibilidade(
            @PathVariable Long id,
            @Valid @RequestBody ProdutoCompatibilidadeDTO dto,
            Authentication authentication,
            HttpServletRequest request
    ) {
        Long usuarioId = extrairUsuarioId(authentication);
        CompatibilidadeResponseDTO response = produtoService.adicionarCompatibilidade(id, dto, usuarioId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @DeleteMapping("/{id}/compatibilidades/{maquinaId}")
    @Operation(summary = "Remover vínculo de compatibilidade entre peça e equipamento")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Compatibilidade removida com sucesso"),
            @ApiResponse(responseCode = "404", description = "Vínculo não encontrado")
    })
    public ResponseEntity<Void> removerCompatibilidade(
            @PathVariable Long id,
            @PathVariable Long maquinaId,
            Authentication authentication,
            HttpServletRequest request
    ) {
        Long usuarioId = extrairUsuarioId(authentication);
        produtoService.removerCompatibilidade(id, maquinaId, usuarioId, request);
        return ResponseEntity.noContent().build();
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
