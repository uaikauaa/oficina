package com.oficinagestao.controller;

import com.oficinagestao.dto.AcceptInviteRequest;
import com.oficinagestao.dto.CreateInviteRequest;
import com.oficinagestao.dto.BootstrapSuperAdminRequest;
import com.oficinagestao.service.InviteService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
public class InviteController {
    private final InviteService service;

    public InviteController(InviteService service) { this.service = service; }

    @PostMapping("/api/admin/convites")
    public ResponseEntity<Void> create(@Valid @RequestBody CreateInviteRequest request) {
        service.create(request);
        return ResponseEntity.accepted().build();
    }

    @PostMapping("/api/admin/provisionamento/super-admin")
    public ResponseEntity<Void> bootstrap(@Valid @RequestBody BootstrapSuperAdminRequest request) {
        service.bootstrapSuperAdmin(request);
        return ResponseEntity.accepted().build();
    }

    @PostMapping("/api/auth/convites/aceitar")
    public ResponseEntity<Void> accept(@Valid @RequestBody AcceptInviteRequest request, HttpServletRequest httpRequest) {
        service.accept(request, httpRequest);
        return ResponseEntity.noContent().build();
    }
}
