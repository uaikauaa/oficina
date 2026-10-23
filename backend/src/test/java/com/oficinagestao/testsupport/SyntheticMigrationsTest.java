package com.oficinagestao.testsupport;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.mock.env.MockEnvironment;

import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class SyntheticMigrationsTest {
    private static String approvedLocation() {
        return "filesystem:" + Path.of("src/test/resources/db/synthetic-migration").toAbsolutePath().normalize();
    }

    private MockEnvironment environment(String location) {
        MockEnvironment environment = new MockEnvironment();
        if (location != null) {
            environment.withProperty("TEST_FLYWAY_LOCATION", location)
                    .withProperty("spring.flyway.locations", location);
        }
        return environment;
    }

    @Test
    void acceptsOnlyTheApprovedSyntheticBytes() {
        assertEquals(approvedLocation(), SyntheticMigrations.location(environment(approvedLocation())));
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"classpath:db/migration", "filesystem:relative/path",
            "filesystem:/missing/synthetic-migrations", "filesystem:/tmp/a,classpath:db/migration"})
    void rejectsMissingRelativeMixedAndClasspathLocations(String location) {
        assertThrows(IllegalStateException.class, () -> SyntheticMigrations.location(environment(location)));
    }

    @Test
    void rejectsOfficialMigrationsEvenThoughNamesAndVersionsMatch() {
        String official = "filesystem:" + Path.of("src/main/resources/db/migration").toAbsolutePath().normalize();
        assertThrows(IllegalStateException.class, () -> SyntheticMigrations.location(environment(official)));
    }

    @Test
    void rejectsSpringOverrideBeforeConnectionBeansExist() {
        new ApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(SyntheticMigrations.Configuration.class))
                .withPropertyValues("TEST_FLYWAY_LOCATION=" + approvedLocation(),
                        "spring.flyway.locations=classpath:db/migration")
                .run(context -> assertThat(context).hasFailed()
                        .getFailure().hasMessage("Synthetic test migrations: location override rejected"));
    }

    @Test
    void acceptsAnEffectiveFlywayBeanUsingTheApprovedLocationWithoutConnecting() {
        new ApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(SyntheticMigrations.Configuration.class))
                .withPropertyValues("TEST_FLYWAY_LOCATION=" + approvedLocation(),
                        "spring.flyway.locations=" + approvedLocation())
                .withBean(Flyway.class, () -> Flyway.configure().locations(approvedLocation()).load())
                .run(context -> assertThat(context).hasNotFailed().hasSingleBean(Flyway.class));
    }

    @Test
    void rejectsAnEffectiveFlywayBeanPointingToTheOfficialClasspath() {
        new ApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(SyntheticMigrations.Configuration.class))
                .withPropertyValues("TEST_FLYWAY_LOCATION=" + approvedLocation(),
                        "spring.flyway.locations=" + approvedLocation())
                // load() configures the object only; it neither connects nor migrates.
                .withBean(Flyway.class, () -> Flyway.configure().locations("classpath:db/migration").load())
                .run(context -> assertThat(context).hasFailed()
                        .getFailure().hasRootCauseMessage("Synthetic test migrations: effective Flyway location rejected"));
    }
}
