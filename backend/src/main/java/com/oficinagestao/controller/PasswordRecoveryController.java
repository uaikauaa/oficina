package com.oficinagestao.controller;

import com.oficinagestao.dto.CompletePasswordRecoveryRequest;
import com.oficinagestao.dto.PasswordRecoveryRequest;
import com.oficinagestao.service.PasswordRecoveryService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth/recuperacao")
public class PasswordRecoveryController {
    private final PasswordRecoveryService service;
    public PasswordRecoveryController(PasswordRecoveryService service) { this.service = service; }

    @PostMapping("/solicitar")
    public ResponseEntity<Void> request(@Valid @RequestBody PasswordRecoveryRequest request,
                                        HttpServletRequest http) {
        service.request(request.email(), http);
        return ResponseEntity.accepted().build();
    }

    @PostMapping("/concluir")
    public ResponseEntity<Void> complete(@Valid @RequestBody CompletePasswordRecoveryRequest request,
                                         HttpServletRequest http) {
        service.complete(request, http);
        return ResponseEntity.noContent().build();
    }
}
