package com.oficinagestao.testsupport;

import org.springframework.core.env.Environment;
import org.springframework.util.PlaceholderResolutionException;

import java.net.URI;
import java.util.Arrays;
import java.util.Locale;
import java.util.Set;

final class TestDatabaseSafetyGuard {

    private static final Set<String> LOOPBACK_HOSTS = Set.of("localhost", "127.0.0.1", "::1");
    private static final Set<String> FLYWAY_CONNECTION_PROPERTIES = Set.of(
            "spring.flyway.url", "spring.flyway.user", "spring.flyway.password"
    );

    private TestDatabaseSafetyGuard() {
    }

    static void validate(Environment environment) {
        boolean testProfileActive = Arrays.stream(environment.getActiveProfiles())
                .anyMatch("test"::equalsIgnoreCase);
        if (!testProfileActive) {
            throw new IllegalStateException(
                    "Test database safety guard: the 'test' profile is mandatory for Spring integration tests.");
        }

        if (!environment.getProperty("app.test-database", Boolean.class, false)) {
            throw new IllegalStateException(
                    "Test database safety guard: app.test-database=true is required.");
        }

        rejectIndependentFlywayConnection(environment);

        String datasourceUrl;
        try {
            datasourceUrl = environment.getProperty("spring.datasource.url");
        } catch (PlaceholderResolutionException exception) {
            throw new IllegalStateException(
                    "Test database safety guard: TEST_DB_URL is required and cannot fall back to DB_URL.", exception);
        }
        if (datasourceUrl == null || datasourceUrl.isBlank() || datasourceUrl.contains("${")) {
            throw new IllegalStateException(
                    "Test database safety guard: TEST_DB_URL is required and cannot fall back to DB_URL.");
        }

        String normalizedUrl = datasourceUrl.trim().toLowerCase(Locale.ROOT);
        if (normalizedUrl.contains("neon.tech")) {
            throw new IllegalStateException(
                    "Test database safety guard: Neon datasources are forbidden for automated tests.");
        }
        if (!normalizedUrl.startsWith("jdbc:postgresql://")) {
            throw new IllegalStateException(
                    "Test database safety guard: automated integration tests require PostgreSQL.");
        }

        URI jdbcUri;
        try {
            jdbcUri = URI.create(datasourceUrl.trim().substring("jdbc:".length()));
        } catch (IllegalArgumentException exception) {
            throw new IllegalStateException("Test database safety guard: invalid TEST_DB_URL.", exception);
        }

        String host = jdbcUri.getHost();
        if (host == null || !LOOPBACK_HOSTS.contains(host.toLowerCase(Locale.ROOT))) {
            throw new IllegalStateException(
                    "Test database safety guard: only a loopback PostgreSQL host is accepted.");
        }

        String path = jdbcUri.getPath();
        String databaseName = path != null && path.length() > 1 ? path.substring(1) : "";
        if (!databaseName.toLowerCase(Locale.ROOT).endsWith("_test")) {
            throw new IllegalStateException(
                    "Test database safety guard: database name must end with '_test'.");
        }
    }

    private static void rejectIndependentFlywayConnection(Environment environment) {
        for (String property : FLYWAY_CONNECTION_PROPERTIES) {
            String value;
            try {
                value = environment.getProperty(property);
            } catch (PlaceholderResolutionException exception) {
                throw new IllegalStateException(
                        "Test database safety guard: " + property
                                + " must not be configured in the test profile.", exception);
            }

            if (value != null && !value.isBlank()) {
                throw new IllegalStateException(
                        "Test database safety guard: " + property
                                + " must not be configured in the test profile. "
                                + "Flyway must reuse the validated test datasource.");
            }
        }
    }
}
