package com.oficinagestao.controller;

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
@Tag(name = "SaÃƒÂºde", description = "Endpoints de verificaÃƒÂ§ÃƒÂ£o de integridade da aplicaÃƒÂ§ÃƒÂ£o")
public class HealthController {

    @GetMapping("/health")
    @Operation(summary = "Health check pÃƒÂºblico", description = "Verifica se o backend estÃƒÂ¡ operacional. NÃƒÂ£o requer autenticaÃƒÂ§ÃƒÂ£o.")
    @ApiResponse(responseCode = "200", description = "AplicaÃƒÂ§ÃƒÂ£o saudÃƒÂ¡vel e operacional")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Collections.singletonMap("status", "UP"));
    }
}
