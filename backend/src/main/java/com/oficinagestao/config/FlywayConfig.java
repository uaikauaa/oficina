package com.oficinagestao.config;

import org.springframework.boot.flyway.autoconfigure.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

@Configuration
public class FlywayConfig {

    @Bean
    public FlywayMigrationStrategy flywayMigrationStrategy(Environment environment) {
        // Spring Boot executa esta estrategia uma unica vez durante o startup.
        // Repair altera o historico de migrations e deve permanecer uma operacao
        // administrativa explicita, nunca automatica na inicializacao.
        return flyway -> {
            HomologationDatabaseGuard.validate(environment, flyway);
            flyway.migrate();
        };
    }
}
