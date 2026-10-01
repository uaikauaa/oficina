package com.oficinagestao.controller;

import com.oficinagestao.dto.NotificacaoResponseDTO;
import com.oficinagestao.dto.NotificacoesResumoDTO;
import com.oficinagestao.service.NotificacaoService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/notificacoes")
@Tag(name = "Notificações", description = "Gestão de alertas e notificações operacionais da oficina")
@SecurityRequirement(name = "cookieAuth")
@SecurityRequirement(name = "bearerAuth")
public class NotificacaoController {

    private final NotificacaoService notificacaoService;

    public NotificacaoController(NotificacaoService notificacaoService) {
        this.notificacaoService = notificacaoService;
    }

    @GetMapping
    @Operation(summary = "Listar notificações recentes da oficina e contadores de pendências")
    public ResponseEntity<NotificacoesResumoDTO> listarRecentes() {
        return ResponseEntity.ok(notificacaoService.listarRecentes());
    }

    @RequestMapping(value = "/{id}/ler", method = {RequestMethod.PATCH, RequestMethod.PUT})
    @Operation(summary = "Marcar uma notificação específica como lida")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Notificação marcada como lida"),
            @ApiResponse(responseCode = "404", description = "Notificação não encontrada")
    })
    public ResponseEntity<NotificacaoResponseDTO> marcarComoLida(@PathVariable Long id) {
        return ResponseEntity.ok(notificacaoService.marcarComoLida(id));
    }

    @RequestMapping(value = "/ler-todas", method = {RequestMethod.PATCH, RequestMethod.PUT})
    @Operation(summary = "Marcar todas as notificações ativas como lidas")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Todas as notificações foram marcadas como lidas")
    })
    public ResponseEntity<Void> marcarTodasComoLidas() {
        notificacaoService.marcarTodasComoLidas();
        return ResponseEntity.noContent().build();
    }
}
