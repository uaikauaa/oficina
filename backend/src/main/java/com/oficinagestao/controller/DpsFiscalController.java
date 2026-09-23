package com.oficinagestao.controller;

import com.oficinagestao.dto.DpsFiscalCreateDTO;
import com.oficinagestao.dto.DpsFiscalResponseDTO;
import com.oficinagestao.dto.PageResponse;
import com.oficinagestao.entity.Usuario;
import com.oficinagestao.repository.UsuarioRepository;
import com.oficinagestao.security.IpAddressResolver;
import com.oficinagestao.service.DpsFiscalService;
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
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Controller responsável pelo gerenciamento e preparação da Declaração de Prestação de Serviços (DPS).
 *
 * RESTRIÇÃO DE SEGURANÇA:
 * Todos os endpoints fiscais exigem autenticação e autorização com papel ROLE_ADMIN.
 *
 * AVISO IMPORTANTE:
 * A preparação da DPS cria e persiste o registro documental preparatório.
 * A emissão fiscal real (SEFIN / Emissor Nacional) NÃO é executada nesta fase.
 */
@RestController
@RequestMapping("/api/dps")
@Tag(name = "DPS Fiscal", description = "Estrutura e preparação documental de DPS para futura NFS-e")
@SecurityRequirement(name = "cookieAuth")
@SecurityRequirement(name = "bearerAuth")
@PreAuthorize("hasRole('ADMIN')")
public class DpsFiscalController {

    private final DpsFiscalService dpsFiscalService;
    private final UsuarioRepository usuarioRepository;
    private final IpAddressResolver ipAddressResolver;

    @org.springframework.beans.factory.annotation.Autowired
    public DpsFiscalController(
            DpsFiscalService dpsFiscalService,
            UsuarioRepository usuarioRepository,
            IpAddressResolver ipAddressResolver
    ) {
        this.dpsFiscalService = dpsFiscalService;
        this.usuarioRepository = usuarioRepository;
        this.ipAddressResolver = ipAddressResolver != null ? ipAddressResolver : new IpAddressResolver();
    }

    public DpsFiscalController(
            DpsFiscalService dpsFiscalService,
            UsuarioRepository usuarioRepository
    ) {
        this(dpsFiscalService, usuarioRepository, new IpAddressResolver());
    }

    @PostMapping("/preparar")
    @Operation(
            summary = "Preparar DPS para Ordem de Serviço",
            description = "Gera snapshot imutável dos dados cadastrais e aloca numeração sequencial segura. " +
                    "Não realiza emissão real nesta fase."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "DPS preparada com sucesso"),
            @ApiResponse(responseCode = "400", description = "Dados da OS inválidos ou sem valor de serviço"),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "403", description = "Acesso negado — requer ROLE_ADMIN"),
            @ApiResponse(responseCode = "404", description = "Ordem de Serviço não encontrada")
    })
    public ResponseEntity<DpsFiscalResponseDTO> preparar(
            @Valid @RequestBody DpsFiscalCreateDTO dto,
            Authentication authentication,
            HttpServletRequest request
    ) {
        Long usuarioId = extrairUsuarioId(authentication);
        String ip = ipAddressResolver.extrairIp(request);
        DpsFiscalResponseDTO response = dpsFiscalService.prepararDps(dto, usuarioId, ip);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Obter DPS por ID")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "DPS encontrada"),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "403", description = "Acesso negado — requer ROLE_ADMIN"),
            @ApiResponse(responseCode = "404", description = "DPS não encontrada")
    })
    public ResponseEntity<DpsFiscalResponseDTO> obterPorId(@PathVariable Long id) {
        return ResponseEntity.ok(dpsFiscalService.obterPorId(id));
    }

    @GetMapping("/os/{ordemServicoId}")
    @Operation(summary = "Obter DPS mais recente vinculada a uma Ordem de Serviço")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "DPS encontrada"),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "403", description = "Acesso negado — requer ROLE_ADMIN"),
            @ApiResponse(responseCode = "404", description = "Nenhuma DPS encontrada para a OS informada")
    })
    public ResponseEntity<DpsFiscalResponseDTO> obterPorOrdemServicoId(@PathVariable Long ordemServicoId) {
        return ResponseEntity.ok(dpsFiscalService.obterPorOrdemServicoId(ordemServicoId));
    }

    @GetMapping("/os/{ordemServicoId}/historico")
    @Operation(summary = "Listar histórico de DPS da Ordem de Serviço")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Lista de DPS da OS"),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "403", description = "Acesso negado — requer ROLE_ADMIN")
    })
    public ResponseEntity<List<DpsFiscalResponseDTO>> listarHistoricoPorOs(@PathVariable Long ordemServicoId) {
        return ResponseEntity.ok(dpsFiscalService.listarPorOrdemServico(ordemServicoId));
    }

    @GetMapping
    @Operation(summary = "Listar todas as DPS paginadas")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Página de DPS"),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "403", description = "Acesso negado — requer ROLE_ADMIN")
    })
    public ResponseEntity<PageResponse<DpsFiscalResponseDTO>> listar(
            @PageableDefault(size = 20, sort = "dataEmissao", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        Page<DpsFiscalResponseDTO> page = dpsFiscalService.listar(pageable);
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
