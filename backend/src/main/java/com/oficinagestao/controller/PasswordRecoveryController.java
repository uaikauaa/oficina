package com.oficinagestao.controller;

import com.oficinagestao.dto.CompletePasswordRecoveryRequest;
import com.oficinagestao.dto.PasswordRecoveryRequest;
import com.oficinagestao.service.PasswordRecoveryService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth/recuperacao")
public class PasswordRecoveryController {
    private final PasswordRecoveryService service;
    @Value("${security.password-recovery.requests-enabled:false}")
    private boolean requestsEnabled;
    public PasswordRecoveryController(PasswordRecoveryService service) { this.service = service; }

    @PostMapping("/solicitar")
    public ResponseEntity<Void> request(@Valid @RequestBody PasswordRecoveryRequest request,
                                        HttpServletRequest http) {
        if (!requestsEnabled) return ResponseEntity.status(503).build();
        if (service.request(request.email(), http) == PasswordRecoveryService.RequestOutcome.SATURATED)
            return ResponseEntity.status(503).build();
        return ResponseEntity.accepted().build();
    }

    @PostMapping("/concluir")
    public ResponseEntity<Void> complete(@Valid @RequestBody CompletePasswordRecoveryRequest request,
                                         HttpServletRequest http) {
        service.complete(request, http);
        return ResponseEntity.noContent().build();
    }
}
