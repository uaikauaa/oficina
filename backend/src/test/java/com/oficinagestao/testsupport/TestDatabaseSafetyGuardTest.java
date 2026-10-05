package com.oficinagestao.testsupport;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class TestDatabaseSafetyGuardTest {

    @Test
    void allowsIdentifiedLocalPostgresTestDatabase() {
        MockEnvironment environment = validEnvironment();

        assertDoesNotThrow(() -> TestDatabaseSafetyGuard.validate(environment));
    }

    @Test
    void rejectsNeonDatasource() {
        MockEnvironment environment = validEnvironment()
                .withProperty("spring.datasource.url", "jdbc:postgresql://synthetic.neon.tech/oficina_test");

        assertThrows(IllegalStateException.class, () -> TestDatabaseSafetyGuard.validate(environment));
    }

    @Test
    void rejectsAnyRemoteOperationalDatasource() {
        MockEnvironment environment = validEnvironment()
                .withProperty("spring.datasource.url", "jdbc:postgresql://prod-db.internal/oficina_test");

        assertThrows(IllegalStateException.class, () -> TestDatabaseSafetyGuard.validate(environment));
    }

    @Test
    void rejectsMissingTestDatasource() {
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles("test");
        environment.setProperty("app.test-database", "true");

        assertThrows(IllegalStateException.class, () -> TestDatabaseSafetyGuard.validate(environment));
    }

    @Test
    void rejectsSpringTestWithoutTestProfile() {
        MockEnvironment environment = validEnvironment();
        environment.setActiveProfiles("dev");

        assertThrows(IllegalStateException.class, () -> TestDatabaseSafetyGuard.validate(environment));
    }

    @Test
    void rejectsDatabaseWithoutPositiveTestName() {
        MockEnvironment environment = validEnvironment()
                .withProperty("spring.datasource.url", "jdbc:postgresql://localhost:5432/oficinadb");

        assertThrows(IllegalStateException.class, () -> TestDatabaseSafetyGuard.validate(environment));
    }

    @Test
    void allowsFlywayToReuseTheValidatedDatasource() {
        assertDoesNotThrow(() -> TestDatabaseSafetyGuard.validate(validEnvironment()));
    }

    @Test
    void rejectsIndependentFlywayUrlIncludingLocalTestDatabases() {
        MockEnvironment environment = validEnvironment()
                .withProperty("spring.flyway.url", "jdbc:postgresql://localhost:5432/oficina_test");

        assertThrows(IllegalStateException.class, () -> TestDatabaseSafetyGuard.validate(environment));
    }

    @Test
    void rejectsIndependentFlywayNeonUrl() {
        MockEnvironment environment = validEnvironment()
                .withProperty("spring.flyway.url", "jdbc:postgresql://synthetic.neon.tech/oficina_test");

        assertThrows(IllegalStateException.class, () -> TestDatabaseSafetyGuard.validate(environment));
    }

    @Test
    void rejectsIndependentFlywayCredentials() {
        MockEnvironment environment = validEnvironment()
                .withProperty("spring.flyway.user", "synthetic")
                .withProperty("spring.flyway.password", "synthetic");

        assertThrows(IllegalStateException.class, () -> TestDatabaseSafetyGuard.validate(environment));
    }

    private MockEnvironment validEnvironment() {
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles("test");
        environment.setProperty("app.test-database", "true");
        environment.setProperty("spring.datasource.url", "jdbc:postgresql://localhost:5432/oficina_test");
        return environment;
    }
}
