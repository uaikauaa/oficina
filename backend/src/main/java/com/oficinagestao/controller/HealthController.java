package com.oficinagestao.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.sql.Connection;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api")
@Tag(name = "Saúde", description = "Endpoints de verificação de integridade da aplicação e conectividade com banco")
public class HealthController {

    private static final Logger log = LoggerFactory.getLogger(HealthController.class);

    private final DataSource dataSource;

    public HealthController(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @GetMapping("/health")
    @Operation(summary = "Health check de aplicação e banco", description = "Verifica se a aplicação e a conexão com o PostgreSQL estão operacionais. Não expõe detalhes sensíveis.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Aplicação e banco de dados saudáveis"),
            @ApiResponse(responseCode = "503", description = "Banco de dados inacessível ou falha de conectividade")
    })
    public ResponseEntity<Map<String, String>> health() {
        Map<String, String> status = new LinkedHashMap<>();
        status.put("status", "UP");

        boolean dbUp = false;
        try (Connection connection = dataSource.getConnection()) {
            dbUp = connection.isValid(2); // Timeout de 2 segundos
        } catch (Exception e) {
            log.error("Health check detectou falha na conectividade com o banco de dados: {}", e.getMessage());
        }

        if (dbUp) {
            status.put("database", "UP");
            return ResponseEntity.ok(status);
        } else {
            status.put("status", "DOWN");
            status.put("database", "DOWN");
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(status);
        }
    }
}

