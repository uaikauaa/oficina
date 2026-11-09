package com.oficinagestao.controller;

import com.oficinagestao.dto.AdminChangeRequest;
import com.oficinagestao.dto.AdminUserResponse;
import com.oficinagestao.service.AdminUserService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/usuarios")
public class AdminUserController {
    private final AdminUserService service;

    public AdminUserController(AdminUserService service) { this.service = service; }

    @GetMapping
    public Page<AdminUserResponse> list(@RequestParam(required = false) String search,
                                        @RequestParam(required = false) Boolean ativo,
                                        @RequestParam(required = false) String role,
                                        @RequestParam(defaultValue = "0") int page,
                                        @RequestParam(defaultValue = "20") int size) {
        return service.list(search, ativo, role, page, size);
    }

    @PatchMapping("/{id}/status")
    public AdminUserResponse status(@PathVariable Long id, @Valid @RequestBody AdminChangeRequest request) {
        return service.changeStatus(id, request);
    }

    @PutMapping("/{id}/papeis")
    public AdminUserResponse roles(@PathVariable Long id, @Valid @RequestBody AdminChangeRequest request) {
        return service.changeRoles(id, request);
    }

    @PostMapping("/{id}/revogar-sessoes")
    public ResponseEntity<Void> revoke(@PathVariable Long id, @Valid @RequestBody AdminChangeRequest request) {
        service.revokeSessions(id, request);
        return ResponseEntity.noContent().build();
    }
}
