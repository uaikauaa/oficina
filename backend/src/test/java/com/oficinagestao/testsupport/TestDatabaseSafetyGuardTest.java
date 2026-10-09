package com.oficinagestao.testsupport;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.SystemEnvironmentPropertySource;
import org.springframework.core.env.PropertySource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.support.ResourcePropertySource;
import org.springframework.mock.env.MockEnvironment;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static com.oficinagestao.testsupport.TestDatabaseSafetyGuard.Reason.*;

class TestDatabaseSafetyGuardTest {

    @ParameterizedTest
    @ValueSource(strings = {"localhost:5433", "127.0.0.1:5433", "localhost:5432", "127.0.0.1:5432"})
    void acceptsExplicitLocalAndCiIdentity(String authority) {
        MockEnvironment environment = validEnvironment();
        environment.setProperty("TEST_DB_URL", "jdbc:postgresql://" + authority + "/oficina_gestao_test");
        environment.setProperty("TEST_DB_EXPECTED_PORT", authority.substring(authority.indexOf(':') + 1));
        assertDoesNotThrow(() -> TestDatabaseSafetyGuard.validate(environment));
    }

    @ParameterizedTest
    @ValueSource(strings = {"test", "test,dev", "test,prod"})
    void retainsExistingTestProfileCombinations(String profiles) {
        MockEnvironment environment = validEnvironment();
        environment.setActiveProfiles(profiles.split(","));
        assertDoesNotThrow(() -> TestDatabaseSafetyGuard.validate(environment));
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "prod", "dev", "TEST", "prod,dev"})
    void requiresExactTestProfile(String profiles) {
        MockEnvironment environment = validEnvironment();
        environment.setActiveProfiles(profiles.isEmpty() ? new String[0] : profiles.split(","));
        rejects(environment, PROFILE);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "jdbc:postgresql://synthetic.neon.tech:5433/oficina_gestao_test",
            "jdbc:postgresql://203.0.113.10:5433/oficina_gestao_test",
            "jdbc:postgresql://db.example.invalid:5433/oficina_gestao_test",
            "jdbc:postgresql://evil-localhost:5433/oficina_gestao_test",
            "jdbc:postgresql://localhost.example.invalid:5433/oficina_gestao_test",
            "jdbc:postgresql://[::1]:5433/oficina_gestao_test",
            "jdbc:postgresql://localhost:5433/oficina_gestao",
            "jdbc:postgresql://localhost:5433/oficina_gestao_prod",
            "jdbc:postgresql://localhost:5433/outro_database_test",
            "jdbc:postgresql://localhost:5433/neon_test",
            "jdbc:postgresql://localhost:5433/OFICINA_GESTAO_TEST",
            "jdbc:postgresql://localhost:5432/oficina_gestao_test",
            "jdbc:postgresql://localhost:6543/oficina_gestao_test",
            "jdbc:postgresql://localhost/oficina_gestao_test",
            "jdbc:postgresql://localhost:5433/oficina_gestao_test?host=example.invalid",
            "jdbc:postgresql://localhost:5433/oficina_gestao_test?socketFactory=example.Factory",
            "jdbc:postgresql://localhost:5433/oficina_gestao_test?sslmode=disable",
            "jdbc:postgresql://localhost:5433/oficina_gestao_test#fragment",
            "jdbc:postgresql://user:synthetic@localhost:5433/oficina_gestao_test",
            "jdbc:postgresql://localhost:5433/oficina_gestao_%74est",
            "jdbc:postgresql://localhost:5433/oficina_gestao_test/",
            "jdbc:postgresql://localhost:5433,remote.invalid:5433/oficina_gestao_test",
            "jdbc:postgresql://localhost:05433/oficina_gestao_test",
            "jdbc:postgresql:oficina_gestao_test", "jdbc:h2:mem:test", "not-a-url",
            "jdbc:postgresql://[broken", " jdbc:postgresql://localhost:5433/oficina_gestao_test"
    })
    void rejectsAnyUnprovenJdbcIdentity(String url) {
        MockEnvironment environment = validEnvironment().withProperty("TEST_DB_URL", url);
        rejects(environment, DATABASE_IDENTITY);
    }

    @ParameterizedTest
    @ValueSource(strings = {"TEST_DB_URL", "TEST_DB_USERNAME", "TEST_DB_PASSWORD", "TEST_DB_EXPECTED_PORT",
            "app.test-database"})
    void missingDedicatedSettingsNeverFallBackToOperationalConfiguration(String missing) {
        MockEnvironment environment = validEnvironment();
        environment.setProperty(missing, "");
        environment.setProperty("DB_URL", "jdbc:postgresql://synthetic.neon.tech/operational");
        environment.setProperty("DB_USERNAME", "operational-synthetic");
        environment.setProperty("DB_PASSWORD", "operational-synthetic");
        rejects(environment, REQUIRED_SETTING);
    }

    @Test
    void rejectsTrulyAbsentTestUrlEvenWhenEffectiveUrlIsLocal() {
        MockEnvironment environment = new MockEnvironment()
                .withProperty("app.test-database", "true")
                .withProperty("TEST_DB_EXPECTED_PORT", "5433")
                .withProperty("spring.datasource.url", localUrl());
        environment.setActiveProfiles("test");
        rejects(environment, REQUIRED_SETTING);
    }

    @ParameterizedTest
    @ValueSource(strings = {"TEST_DB_USERNAME", "TEST_DB_PASSWORD", "TEST_DB_EXPECTED_PORT"})
    void rejectsTrulyAbsentCredentialsOrPort(String key) {
        MockEnvironment environment = validEnvironment();
        environment.getPropertySources().remove("dedicated-settings");
        Map<String, Object> incomplete = settings();
        incomplete.remove(key);
        environment.getPropertySources().addLast(new MapPropertySource("incomplete-settings", incomplete));
        environment.setProperty("DB_USERNAME", "operational-synthetic");
        environment.setProperty("DB_PASSWORD", "operational-synthetic");
        rejects(environment, REQUIRED_SETTING);
    }

    @ParameterizedTest
    @ValueSource(strings = {"false", "not-a-boolean"})
    void rejectsMissingPositiveTestIdentification(String value) {
        rejects(validEnvironment().withProperty("app.test-database", value), TEST_IDENTIFICATION);
    }

    @ParameterizedTest
    @ValueSource(strings = {"6543", "0", "-1", "5432,5433", "${MISSING_PORT}", "5433 "})
    void rejectsInvalidExpectedPort(String port) {
        rejects(validEnvironment().withProperty("TEST_DB_EXPECTED_PORT", port), port.contains("${") ? REQUIRED_SETTING : EXPECTED_PORT);
    }

    @Test
    void genericCiFlagCannotAuthorizeAPort() {
        rejects(validEnvironment().withProperty("TEST_DB_EXPECTED_PORT", "")
                .withProperty("CI", "true").withProperty("GITHUB_ACTIONS", "true"), REQUIRED_SETTING);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "spring.datasource.hikari.jdbc-url", "spring.datasource.hikari.jdbcUrl",
            "spring.datasource.jndi-name", "spring.datasource.hikari.data-source-class-name",
            "spring.datasource.hikari.data-source-j-n-d-i", "spring.datasource.hikari.data-source",
            "spring.datasource.hikari.data-source-properties.serverName",
            "spring.datasource.hikari.data-source-properties.portNumber",
            "spring.datasource.hikari.data-source-properties.databaseName",
            "spring.datasource.hikari.data-source-properties.socketFactory",
            "spring.datasource.hikari.username", "spring.datasource.hikari.password",
            "spring.datasource.hikari.driver-class-name", "spring.datasource.hikari.connection-init-sql",
            "spring.datasource.xa.data-source-class-name", "spring.datasource.tomcat.url",
            "spring.flyway.url", "spring.flyway.user", "spring.flyway.password",
            "spring.flyway.driver-class-name", "spring.flyway.jdbc-properties.serverName",
            "spring.jpa.properties.hibernate.connection.url",
            "spring.jpa.properties.hibernate.connection.datasource",
            "spring.jpa.properties.hibernate.connection.provider_class",
            "spring.jpa.properties.hibernate.multi_tenant_connection_provider",
            "spring.jpa.properties.jakarta.persistence.jdbc.url",
            "spring.jpa.properties.javax.persistence.jdbc.url",
            "spring.jpa.properties.jakarta.persistence.nonJtaDataSource"
    })
    void rejectsAlternativeConnectionSettings(String key) {
        rejects(validEnvironment().withProperty(key, "synthetic-alternative"), key.startsWith("spring.flyway") ? FLYWAY_OVERRIDE : key.startsWith("spring.jpa") ? JPA_OVERRIDE : DATASOURCE_OVERRIDE);
    }

    @ParameterizedTest
    @ValueSource(strings = {"jdbc:postgresql://synthetic.neon.tech:5433/oficina_gestao_test",
            "jdbc:postgresql://localhost:5432/oficina_gestao_test",
            "jdbc:postgresql://localhost:5433/oficina_gestao_test", ""})
    void rejectsEveryHikariUrlOverrideIncludingMatchingOrBlank(String override) {
        rejects(validEnvironment().withProperty("spring.datasource.hikari.jdbc-url", override), DATASOURCE_OVERRIDE);
    }

    @ParameterizedTest
    @ValueSource(strings = {"SPRING_DATASOURCE_HIKARI_JDBC_URL", "SPRING_DATASOURCE_HIKARI_JDBCURL",
            "SPRING_DATASOURCE_HIKARI_DATASOURCEPROPERTIES_SERVERNAME",
            "SPRING_DATASOURCE_JNDI_NAME", "SPRING_FLYWAY_URL"})
    void rejectsAlternativeConnectionsFromRealEnvironmentStyleSource(String key) {
        MockEnvironment environment = validEnvironment();
        environment.getPropertySources().addFirst(new SystemEnvironmentPropertySource(
                "synthetic-environment", Map.of(key, "synthetic-alternative")));
        rejects(environment, key.startsWith("SPRING_FLYWAY") ? FLYWAY_OVERRIDE : DATASOURCE_OVERRIDE);
    }

    @Test
    void rejectsHigherPrecedenceRemoteDatasource() {
        MockEnvironment environment = validEnvironment();
        environment.getPropertySources().addFirst(new MapPropertySource("higher-priority",
                Map.of("spring.datasource.url", "jdbc:postgresql://synthetic.neon.tech/operational")));
        rejects(environment, EFFECTIVE_DATASOURCE);
    }

    @Test
    void rejectsSourcesThatCouldHideConnectionOverridesFromEnumeration() {
        MockEnvironment environment = validEnvironment();
        environment.getPropertySources().addFirst(new PropertySource<>("opaque-source") {
            @Override
            public Object getProperty(String name) {
                return "spring.datasource.hikari.jdbc-url".equals(name)
                        ? "jdbc:postgresql://synthetic.neon.tech/unused" : null;
            }
        });
        rejects(environment, PROPERTY_SOURCE);
    }

    @ParameterizedTest
    @ValueSource(strings = {"spring.datasource.username", "spring.datasource.password"})
    void rejectsOperationalCredentialOverrides(String key) {
        rejects(validEnvironment().withProperty(key, "operational-synthetic"), EFFECTIVE_DATASOURCE);
    }

    @ParameterizedTest
    @ValueSource(strings = {"spring.datasource.driver-class-name", "spring.datasource.type"})
    void rejectsAlternativeDriverOrPool(String key) {
        rejects(validEnvironment().withProperty(key, "example.Untrusted"), key.endsWith("type") ? POOL_TYPE : DRIVER);
    }

    @Test
    void acceptsNormalPoolAndFlywaySettings() {
        MockEnvironment environment = validEnvironment()
                .withProperty("spring.datasource.driver-class-name", "org.postgresql.Driver")
                .withProperty("spring.datasource.type", "com.zaxxer.hikari.HikariDataSource")
                .withProperty("spring.datasource.hikari.maximum-pool-size", "10")
                .withProperty("spring.datasource.hikari.minimum-idle", "2")
                .withProperty("spring.datasource.hikari.connection-timeout", "20000")
                .withProperty("spring.datasource.hikari.max-lifetime", "600000")
                .withProperty("spring.datasource.hikari.idle-timeout", "300000")
                .withProperty("spring.datasource.hikari.keepalive-time", "120000");
        assertDoesNotThrow(() -> TestDatabaseSafetyGuard.validate(environment));
    }

    @Test
    void doesNotIncludeSecretsOrNestedBindingErrorsInRejections() {
        MockEnvironment environment = validEnvironment()
                .withProperty("TEST_DB_PASSWORD", "${synthetic-secret-that-must-not-be-logged}");
        var failure = assertThrows(TestDatabaseSafetyGuard.SafetyViolation.class,
                () -> TestDatabaseSafetyGuard.validate(environment));
        assertEquals(REQUIRED_SETTING, failure.reason());
        assertFalse(failure.toString().contains("synthetic-secret-that-must-not-be-logged"));
        assertNull(failure.getCause());
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "jdbc:postgresql://synthetic-user:synthetic-private-password@localhost:5433/oficina_gestao_test",
            "jdbc:postgresql://[broken?password=synthetic-private-password",
            "jdbc:postgresql://localhost:5433/oficina_gestao_test?password=synthetic-private-password"
    })
    void urlRejectionsNeverRetainCredentialsOrParserCauses(String url) {
        var failure = assertThrows(TestDatabaseSafetyGuard.SafetyViolation.class,
                () -> TestDatabaseSafetyGuard.validate(validEnvironment().withProperty("TEST_DB_URL", url)));
        assertEquals(DATABASE_IDENTITY, failure.reason());
        assertFalse(failure.toString().contains("synthetic-private-password"));
        assertFalse(failure.toString().contains("synthetic-user"));
        assertFalse(failure.toString().contains(url));
        assertNull(failure.getCause());
    }

    @Test
    void rejectsMaskedForbiddenPropertyEvenWhenHigherPriorityValueIsBlank() {
        var environment = validEnvironment();
        environment.getPropertySources().addLast(new MapPropertySource("masked-unsafe",
                Map.of("spring.datasource.hikari.jdbcUrl", "jdbc:postgresql://remote.invalid/unused")));
        environment.setProperty("spring.datasource.hikari.jdbc-url", "");
        rejects(environment, DATASOURCE_OVERRIDE);
    }

    static MockEnvironment validEnvironment() {
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles("test");
        environment.getPropertySources().addLast(new MapPropertySource("dedicated-settings", settings()));
        try {
            environment.getPropertySources().addLast(new ResourcePropertySource(
                    new ClassPathResource("application-test.properties")));
        } catch (IOException exception) {
            throw new AssertionError(exception);
        }
        return environment;
    }

    static Map<String, Object> settings() {
        Map<String, Object> settings = new HashMap<>();
        settings.put("TEST_DB_URL", localUrl());
        settings.put("TEST_DB_EXPECTED_PORT", "5433");
        settings.put("TEST_DB_USERNAME", "synthetic-test-user");
        settings.put("TEST_DB_PASSWORD", "synthetic-test-password");
        return settings;
    }

    static String localUrl() {
        return "jdbc:postgresql://localhost:5433/oficina_gestao_test";
    }

    private void rejects(MockEnvironment environment, TestDatabaseSafetyGuard.Reason expected) {
        var failure = assertThrows(TestDatabaseSafetyGuard.SafetyViolation.class,
                () -> TestDatabaseSafetyGuard.validate(environment));
        assertEquals(expected, failure.reason());
        assertTrue(failure.getMessage().startsWith("Test database safety guard:"));
        assertNull(failure.getCause());
        assertFalse(failure.toString().contains("synthetic-test-password"));
        assertFalse(failure.toString().contains("operational-synthetic"));
    }
}
