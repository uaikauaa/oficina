package com.oficinagestao.controller;

import com.oficinagestao.dto.RoleChangeRequest;
import com.oficinagestao.dto.RoleResponse;
import com.oficinagestao.service.RoleManagementService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin")
public class AdminRoleController {
    private final RoleManagementService service;
    public AdminRoleController(RoleManagementService service) { this.service = service; }

    @GetMapping("/papeis")
    public List<RoleResponse> roles() { return service.list(); }

    @GetMapping("/permissoes")
    public List<String> permissions() { return service.permissions(); }

    @PostMapping("/papeis")
    public ResponseEntity<RoleResponse> create(@Valid @RequestBody RoleChangeRequest request) {
        return ResponseEntity.status(201).body(service.create(request));
    }

    @PutMapping("/papeis/{id}")
    public RoleResponse update(@PathVariable Long id, @Valid @RequestBody RoleChangeRequest request) {
        return service.update(id, request);
    }
}
