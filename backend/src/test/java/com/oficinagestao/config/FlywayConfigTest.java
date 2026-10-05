package com.oficinagestao.config;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

class FlywayConfigTest {

    @Test
    void startupStrategyMigratesWithoutAutomaticRepair() {
        Flyway flyway = mock(Flyway.class);
        FlywayMigrationStrategy strategy = new FlywayConfig().flywayMigrationStrategy();

        strategy.migrate(flyway);

        verify(flyway).migrate();
        verify(flyway, never()).repair();
    }
}
