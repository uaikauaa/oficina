package com.oficinagestao.config;

import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class FlywayConfig {

    @Bean
    public FlywayMigrationStrategy flywayMigrationStrategy() {
        // Spring Boot executa esta estrategia uma unica vez durante o startup.
        // Repair altera o historico de migrations e deve permanecer uma operacao
        // administrativa explicita, nunca automatica na inicializacao.
        return flyway -> flyway.migrate();
    }
}
