package com.oficinagestao.common;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Collections;
import java.util.Map;

@RestController
@RequestMapping("/api")
@Tag(name = "Saúde", description = "Endpoints de verificação de integridade da aplicação")
public class HealthController {

    @GetMapping("/health")
    @Operation(summary = "Health check público", description = "Verifica se o backend está operacional. Não requer autenticação.")
    @ApiResponse(responseCode = "200", description = "Aplicação saudável e operacional")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Collections.singletonMap("status", "UP"));
    }
}
