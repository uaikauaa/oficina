package com.oficinagestao.controller;

import com.oficinagestao.service.InfrastructureMonitoringService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/infraestrutura")
public class AdminInfrastructureController {
    private final InfrastructureMonitoringService monitoring;

    public AdminInfrastructureController(InfrastructureMonitoringService monitoring) {
        this.monitoring = monitoring;
    }

    @GetMapping
    public InfrastructureMonitoringService.Snapshot snapshot() {
        return monitoring.snapshot();
    }
}
