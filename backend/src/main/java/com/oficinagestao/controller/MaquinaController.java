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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Tag(name = "Equipamentos", description = "Gestão de máquinas de solda e geradores de energia vinculados a clientes")
@SecurityRequirement(name = "cookieAuth")
@SecurityRequirement(name = "bearerAuth")
public class MaquinaController {

    private final MaquinaService maquinaService;
    private final UsuarioRepository usuarioRepository;
    private final com.oficinagestao.security.IpAddressResolver ipAddressResolver;

    @org.springframework.beans.factory.annotation.Autowired
    public MaquinaController(
            MaquinaService maquinaService,
            UsuarioRepository usuarioRepository,
            com.oficinagestao.security.IpAddressResolver ipAddressResolver
    ) {
        this.maquinaService = maquinaService;
        this.usuarioRepository = usuarioRepository;
        this.ipAddressResolver = ipAddressResolver != null ? ipAddressResolver : new com.oficinagestao.security.IpAddressResolver();
    }

    public MaquinaController(MaquinaService maquinaService, UsuarioRepository usuarioRepository) {
        this(maquinaService, usuarioRepository, new com.oficinagestao.security.IpAddressResolver());
    }

    // =========================================================================
    // Endpoints globais: /api/maquinas
    // =========================================================================

    @PostMapping("/api/maquinas")
    @Operation(summary = "Cadastrar equipamento", description = "Cadastra uma máquina de solda ou gerador vinculado a um cliente existente.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Equipamento cadastrado com sucesso"),
            @ApiResponse(responseCode = "400", description = "Dados inválidos"),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "404", description = "Cliente não encontrado")
    })
    public ResponseEntity<MaquinaResponseDTO> criar(
            @Valid @RequestBody MaquinaCreateDTO dto,
            Authentication authentication,
            HttpServletRequest request
    ) {
        Long usuarioId = extrairUsuarioId(authentication);
        String ip = ipAddressResolver.extrairIp(request);
        MaquinaResponseDTO response = maquinaService.criar(dto, usuarioId, ip);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/api/maquinas")
    @Operation(summary = "Listar equipamentos (global)", description = "Lista paginada de todos os equipamentos com filtros opcionais.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Lista retornada com sucesso"),
            @ApiResponse(responseCode = "401", description = "Não autenticado")
    })
    public ResponseEntity<PageResponse<MaquinaResponseDTO>> listar(
            @Parameter(description = "Termo de busca (marca, modelo, número de série, nome do cliente)")
            @RequestParam(name = "termo", required = false) String termo,

            @Parameter(description = "Filtro por tipo de equipamento")
            @RequestParam(name = "tipoEquipamento", required = false) TipoEquipamento tipoEquipamento,

            @Parameter(description = "Filtro por status ativo")
            @RequestParam(name = "ativo", required = false) Boolean ativo,

            @PageableDefault(size = 10, sort = "marca", direction = Sort.Direction.ASC)
            Pageable pageable
    ) {
        return ResponseEntity.ok(maquinaService.listar(termo, tipoEquipamento, ativo, pageable));
    }

    @GetMapping("/api/maquinas/{id}")
    @Operation(summary = "Buscar equipamento por ID")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Equipamento localizado"),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "404", description = "Equipamento não encontrado")
    })
    public ResponseEntity<MaquinaResponseDTO> buscarPorId(@PathVariable Long id) {
        return ResponseEntity.ok(maquinaService.buscarPorId(id));
    }

    @GetMapping("/api/maquinas/{id}/resumo")
    @Operation(summary = "Obter resumo e indicadores de manutenção do equipamento", description = "Retorna contadores de atendimentos, última manutenção e valor acumulado de OS concluídas.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Resumo retornado com sucesso"),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "404", description = "Equipamento não encontrado")
    })
    public ResponseEntity<MaquinaResumoDTO> obterResumo(@PathVariable Long id) {
        return ResponseEntity.ok(maquinaService.obterResumo(id));
    }

    @GetMapping("/api/maquinas/{id}/historico")
    @Operation(summary = "Consultar histórico de Ordens de Serviço do equipamento", description = "Retorna lista paginada de manutenções com data, problema, diagnóstico, solução e valor total.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Histórico retornado com sucesso"),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "404", description = "Equipamento não encontrado")
    })
    public ResponseEntity<PageResponse<OrdemServicoResponseDTO>> obterHistorico(
            @PathVariable Long id,
            @PageableDefault(size = 20, sort = "dataEntrada", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        return ResponseEntity.ok(maquinaService.obterHistorico(id, pageable));
    }

    @PutMapping("/api/maquinas/{id}")
    @Operation(summary = "Atualizar equipamento", description = "Atualiza dados técnicos do equipamento. O cliente vinculado não pode ser alterado.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Equipamento atualizado com sucesso"),
            @ApiResponse(responseCode = "400", description = "Dados inválidos"),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "404", description = "Equipamento não encontrado")
    })
    public ResponseEntity<MaquinaResponseDTO> atualizar(
            @PathVariable Long id,
            @Valid @RequestBody MaquinaUpdateDTO dto,
            Authentication authentication,
            HttpServletRequest request
    ) {
        Long usuarioId = extrairUsuarioId(authentication);
        String ip = ipAddressResolver.extrairIp(request);
        return ResponseEntity.ok(maquinaService.atualizar(id, dto, usuarioId, ip));
    }

    @PatchMapping("/api/maquinas/{id}/status")
    @Operation(summary = "Ativar ou inativar equipamento")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Status alterado com sucesso"),
            @ApiResponse(responseCode = "400", description = "Parâmetro inválido"),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "404", description = "Equipamento não encontrado")
    })
    public ResponseEntity<MaquinaResponseDTO> alterarStatus(
            @PathVariable Long id,
            @Valid @RequestBody MaquinaStatusDTO dto,
            Authentication authentication,
            HttpServletRequest request
    ) {
        Long usuarioId = extrairUsuarioId(authentication);
        String ip = ipAddressResolver.extrairIp(request);
        return ResponseEntity.ok(maquinaService.alterarStatus(id, dto.ativo(), usuarioId, ip));
    }

    // =========================================================================
    // Endpoints aninhados: /api/clientes/{clienteId}/maquinas
    // =========================================================================

    @GetMapping("/api/clientes/{clienteId}/maquinas")
    @Operation(
            summary = "Listar equipamentos de um cliente",
            description = "Retorna a lista paginada de equipamentos vinculados a um cliente específico."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Lista retornada com sucesso"),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "404", description = "Cliente não encontrado")
    })
    public ResponseEntity<PageResponse<MaquinaResponseDTO>> listarPorCliente(
            @PathVariable Long clienteId,

            @Parameter(description = "Termo de busca (marca, modelo, número de série)")
            @RequestParam(name = "termo", required = false) String termo,

            @Parameter(description = "Filtro por tipo de equipamento")
            @RequestParam(name = "tipoEquipamento", required = false) TipoEquipamento tipoEquipamento,

            @Parameter(description = "Filtro por status ativo")
            @RequestParam(name = "ativo", required = false) Boolean ativo,

            @PageableDefault(size = 20, sort = "marca", direction = Sort.Direction.ASC)
            Pageable pageable
    ) {
        return ResponseEntity.ok(
                maquinaService.listarPorCliente(clienteId, termo, tipoEquipamento, ativo, pageable)
        );
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
