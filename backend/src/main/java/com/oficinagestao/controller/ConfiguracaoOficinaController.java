package com.oficinagestao.controller;

import com.oficinagestao.dto.ConfiguracaoOficinaResponseDTO;
import com.oficinagestao.dto.ConfiguracaoOficinaUpdateDTO;
import com.oficinagestao.service.ConfiguracaoOficinaService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * Controller de configuração central da oficina.
 *
 * GET  /api/configuracao-oficina  — público (autenticado): retorna dados da oficina
 * PUT  /api/configuracao-oficina  — restrito (ROLE_ADMIN): atualiza dados da oficina
 *
 * IMPORTANTE: Este controller NÃO emite NFS-e. Apenas gerencia os dados
 * cadastrais e de referência fiscal da oficina.
 */
@RestController
@RequestMapping("/api/configuracao-oficina")
@Tag(name = "Configuração da Oficina", description = "Dados cadastrais, comerciais e fiscais de referência da oficina")
public class ConfiguracaoOficinaController {

    private final ConfiguracaoOficinaService configuracaoOficinaService;

    public ConfiguracaoOficinaController(ConfiguracaoOficinaService configuracaoOficinaService) {
        this.configuracaoOficinaService = configuracaoOficinaService;
    }

    @GetMapping
    @Operation(
            summary = "Obter dados da oficina",
            description = "Retorna os dados cadastrais e fiscais de referência da oficina. " +
                    "Utilizado pelos documentos comerciais (PDF, WhatsApp) e pela tela de configurações.",
            security = { @SecurityRequirement(name = "cookieAuth"), @SecurityRequirement(name = "bearerAuth") }
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Dados da oficina retornados com sucesso"),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "404", description = "Configuração não encontrada — execute as migrations")
    })
    public ResponseEntity<ConfiguracaoOficinaResponseDTO> obter() {
        return ResponseEntity.ok(configuracaoOficinaService.obter());
    }

    @PutMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(
            summary = "Atualizar dados da oficina",
            description = "Atualiza os dados cadastrais e fiscais de referência da oficina. " +
                    "Operação restrita ao administrador do sistema. " +
                    "ATENÇÃO: Não valida regras fiscais — a responsabilidade pelos dados corretos é do usuário.",
            security = { @SecurityRequirement(name = "cookieAuth"), @SecurityRequirement(name = "bearerAuth") }
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Dados atualizados com sucesso"),
            @ApiResponse(responseCode = "400", description = "Dados inválidos"),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "403", description = "Acesso negado — papel ROLE_ADMIN necessário"),
            @ApiResponse(responseCode = "404", description = "Configuração não encontrada — execute as migrations")
    })
    public ResponseEntity<ConfiguracaoOficinaResponseDTO> atualizar(
            @Valid @RequestBody ConfiguracaoOficinaUpdateDTO dto) {
        return ResponseEntity.ok(configuracaoOficinaService.atualizar(dto));
    }
}
