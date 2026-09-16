package com.oficinagestao.controller;

import com.oficinagestao.dto.BuscaRapidaDTO;
import com.oficinagestao.service.BuscaService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/busca")
@Tag(name = "Busca Global", description = "Busca rápida e unificada de clientes, equipamentos, ordens de serviço e produtos")
@SecurityRequirement(name = "cookieAuth")
@SecurityRequirement(name = "bearerAuth")
public class BuscaController {

    private final BuscaService buscaService;

    public BuscaController(BuscaService buscaService) {
        this.buscaService = buscaService;
    }

    @GetMapping("/rapida")
    @Operation(summary = "Busca rápida unificada", description = "Pesquisa clientes, equipamentos, ordens de serviço e produtos retornando os registros mais relevantes.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Resultados da busca rápida"),
            @ApiResponse(responseCode = "401", description = "Não autenticado")
    })
    public ResponseEntity<BuscaRapidaDTO> buscarRapida(
            @Parameter(description = "Termo de busca (nome, documento, número OS, número de série, marca/modelo ou código do produto)")
            @RequestParam(name = "termo", required = false) String termo
    ) {
        BuscaRapidaDTO resultado = buscaService.buscarRapida(termo);
        return ResponseEntity.ok(resultado);
    }
}
