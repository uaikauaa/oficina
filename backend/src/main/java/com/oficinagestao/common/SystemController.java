package com.oficinagestao.common;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;

@RestController
@RequestMapping("/api/system")
@Tag(name = "Sistema", description = "Endpoints de diagnóstico e integridade da infraestrutura")
public class SystemController {

    private final String environment;

    public SystemController(@Value("${app.environment:development}") String environment) {
        this.environment = environment;
    }

    @GetMapping("/status")
    @Operation(
            summary = "Status da infraestrutura e SecurityContext",
            description = "Endpoint autenticado para validação do SecurityContext e da infraestrutura da API. Exige papel ROLE_ADMIN.",
            security = { @SecurityRequirement(name = "cookieAuth"), @SecurityRequirement(name = "bearerAuth") }
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Infraestrutura operacional e autenticação confirmada"),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "403", description = "Acesso negado — papel ROLE_ADMIN necessário")
    })
    public ResponseEntity<SystemStatusResponse> status(Authentication authentication) {
        String username = authentication != null ? authentication.getName() : "desconhecido";
        return ResponseEntity.ok(new SystemStatusResponse(
                "OPERATIONAL",
                environment,
                username,
                OffsetDateTime.now()
        ));
    }
}
