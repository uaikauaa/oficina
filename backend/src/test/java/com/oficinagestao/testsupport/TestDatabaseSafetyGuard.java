package com.oficinagestao.testsupport;

import org.springframework.boot.context.properties.bind.Bindable;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.EnumerablePropertySource;
import org.springframework.core.env.Environment;
import org.springframework.core.env.PropertySource;
import org.springframework.boot.env.RandomValuePropertySource;
import com.zaxxer.hikari.HikariDataSource;

import java.net.URI;
import java.util.Arrays;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/** Fail closed on configuration, without constructing a pool or opening a connection. */
final class TestDatabaseSafetyGuard {

    enum Reason {
        PROFILE, TEST_IDENTIFICATION, EXPECTED_PORT, DATABASE_IDENTITY, REQUIRED_SETTING,
        EFFECTIVE_DATASOURCE, PROPERTY_SOURCE, CONFIGURATION_BINDING, DATASOURCE_OVERRIDE,
        FLYWAY_OVERRIDE, JPA_OVERRIDE, DRIVER, POOL_TYPE, CONNECTION_BEAN, JPA_EXTENSION,
        INDETERMINATE_FACTORY, ANCESTOR_CONNECTION, EARLY_CONNECTION, INITIALIZER_REQUIRED
    }

    static final class SafetyViolation extends IllegalStateException {
        private final Reason reason;

        private SafetyViolation(Reason reason, String message) {
            super("Test database safety guard: [" + reason + "] " + message + ".");
            this.reason = reason;
        }

        Reason reason() { return reason; }
    }

    private static final Set<String> HOSTS = Set.of("localhost", "127.0.0.1");
    private static final String DATABASE_PATH = "/oficina_gestao_test";
    // Connection settings have one source: TEST_DB_*. Only non-routing pool settings are allowed.
    private static final Set<String> DATASOURCE_PROPERTIES = Set.of(
            "url", "username", "password", "driverclassname", "type", "name", "generateuniquename",
            "hikarimaximumpoolsize", "hikariminimumidle", "hikarimaxlifetime", "hikariidletimeout",
            "hikariconnectiontimeout", "hikarikeepalivetime", "hikarivalidationtimeout",
            "hikariinitializationfailtimeout", "hikarileakdetectionthreshold", "hikaripoolname",
            "hikariautocommit", "hikarireadonly", "hikaritransactionisolation",
            "hikariregistermbeans", "hikariisolateinternalqueries", "hikariallowpoolsuspension");

    private TestDatabaseSafetyGuard() {
    }

    static void validate(Environment environment) {
        if (Arrays.stream(environment.getActiveProfiles()).noneMatch("test"::equals)) {
            throw rejected(Reason.PROFILE, "the 'test' profile is mandatory");
        }
        if (!"true".equalsIgnoreCase(required(environment, "app.test-database"))) {
            throw rejected(Reason.TEST_IDENTIFICATION, "app.test-database=true is required");
        }

        // Independently supplied: never derive the expected port from the untrusted URL or CI flag.
        String expectedPort = required(environment, "TEST_DB_EXPECTED_PORT");
        if (!Set.of("5432", "5433").contains(expectedPort)) {
            throw rejected(Reason.EXPECTED_PORT, "TEST_DB_EXPECTED_PORT must explicitly select local 5433 or CI 5432");
        }
        String url = required(environment, "TEST_DB_URL");
        validateUrl(url, Integer.parseInt(expectedPort));
        requireSame(environment, "spring.datasource.url", url);
        requireSame(environment, "spring.datasource.username", required(environment, "TEST_DB_USERNAME"));
        requireSame(environment, "spring.datasource.password", required(environment, "TEST_DB_PASSWORD"));

        // Also inspect raw names: map binding alone can miss environment-variable aliases.
        // Reject forbidden settings even when shadowed; never read/log their values here.
        if (!(environment instanceof ConfigurableEnvironment configurable)) {
            throw rejected(Reason.PROPERTY_SOURCE, "test property sources must be inspectable");
        }
        for (var source : configurable.getPropertySources()) {
            if (source instanceof EnumerablePropertySource<?> enumerable) {
                for (String name : enumerable.getPropertyNames()) {
                    inspectPropertyName(normalize(name));
                }
            } else if (!(source instanceof PropertySource.StubPropertySource)
                    && !(source instanceof RandomValuePropertySource)
                    && !source.getClass().getName().equals(
                            "org.springframework.boot.context.properties.source.ConfigurationPropertySourcesPropertySource")) {
                // Boot's bridge delegates to the inspected sources; stubs and random.* cannot route JDBC.
                throw rejected(Reason.PROPERTY_SOURCE, "an uninspectable configuration source is forbidden");
            }
        }

        for (String prefix : Set.of("spring.datasource", "spring.flyway", "spring.jpa")) {
            for (String key : properties(environment, prefix).keySet()) {
                inspectPropertyName(normalize(prefix + "." + key));
            }
        }
        String driver = bound(environment, "spring.datasource.driver-class-name");
        if (driver != null && !driver.equals("org.postgresql.Driver")) {
            throw rejected(Reason.DRIVER, "only the PostgreSQL driver is allowed");
        }
        String type = bound(environment, "spring.datasource.type");
        if (type != null && !type.equals("com.zaxxer.hikari.HikariDataSource")) {
            throw rejected(Reason.POOL_TYPE, "only the standard Hikari datasource is allowed");
        }
    }

    private static void validateUrl(String url, int expectedPort) {
        // JDBC parameters can override routing or install socket factories. Neither test setup needs them.
        if (!url.startsWith("jdbc:postgresql://")) {
            throw rejected(Reason.DATABASE_IDENTITY, "an explicit PostgreSQL JDBC URL is required");
        }
        URI uri;
        try {
            uri = URI.create(url.substring("jdbc:".length()));
        } catch (IllegalArgumentException exception) {
            throw rejected(Reason.DATABASE_IDENTITY, "invalid test JDBC URL");
        }
        if (uri.getHost() == null || !HOSTS.contains(uri.getHost()) || uri.getPort() != expectedPort
                || !DATABASE_PATH.equals(uri.getRawPath()) || uri.getRawUserInfo() != null
                || uri.getRawQuery() != null || uri.getRawFragment() != null
                || !url.equals("jdbc:postgresql://" + uri.getHost() + ":" + expectedPort + DATABASE_PATH)) {
            throw rejected(Reason.DATABASE_IDENTITY, "the exact authorized loopback host, explicit port and test database are required");
        }
    }

    private static void requireSame(Environment environment, String key, String expected) {
        if (!expected.equals(bound(environment, key))) {
            throw rejected(Reason.EFFECTIVE_DATASOURCE, "effective datasource configuration must match the dedicated TEST_DB_* values");
        }
    }

    private static String required(Environment environment, String key) {
        String value;
        try {
            value = environment.getProperty(key);
        } catch (RuntimeException exception) {
            // Never attach binding/placeholder exceptions: their messages can contain credentials.
            throw rejected(Reason.REQUIRED_SETTING, "a required test setting could not be resolved");
        }
        if (value == null || value.isBlank() || value.contains("${")) {
            throw rejected(Reason.REQUIRED_SETTING, "a required test setting is absent; operational fallback is forbidden");
        }
        return value;
    }

    private static String bound(Environment environment, String key) {
        try {
            return Binder.get(environment).bind(key, String.class).orElse(null);
        } catch (RuntimeException exception) {
            throw rejected(Reason.CONFIGURATION_BINDING, "effective test configuration could not be resolved");
        }
    }

    private static Map<String, String> properties(Environment environment, String prefix) {
        try {
            return Binder.get(environment).bind(prefix, Bindable.mapOf(String.class, String.class))
                    .orElse(Map.of());
        } catch (RuntimeException exception) {
            throw rejected(Reason.CONFIGURATION_BINDING, "test connection configuration could not be inspected");
        }
    }

    private static String normalize(String key) {
        return key.replace("-", "").replace("_", "").replace(".", "").toLowerCase(Locale.ROOT);
    }

    private static void inspectPropertyName(String name) {
        if (name.startsWith("springdatasource")
                && !DATASOURCE_PROPERTIES.contains(name.substring("springdatasource".length()))) {
            throw rejected(Reason.DATASOURCE_OVERRIDE, "alternative datasource/pool connection configuration is forbidden");
        }
        if (Set.of("springflywayurl", "springflywayuser", "springflywaypassword",
                "springflywaydriverclassname").contains(name) || name.startsWith("springflywayjdbcproperties")) {
            throw rejected(Reason.FLYWAY_OVERRIDE, "independent Flyway connection configuration is forbidden");
        }
        if (name.startsWith("springjpapropertieshibernateconnection")
                || name.startsWith("springjpapropertieshibernatemultitenantconnectionprovider")
                || name.startsWith("springjpapropertieshibernatehikari")
                || name.startsWith("springjpapropertieshibernatec3p0")
                || name.startsWith("springjpapropertieshibernateagroal")
                || name.startsWith("springjpapropertiesjakartapersistencejdbc")
                || name.startsWith("springjpapropertiesjavaxpersistencejdbc")
                || (name.startsWith("springjpa") && name.endsWith("jtadatasource"))) {
            throw rejected(Reason.JPA_OVERRIDE, "independent JPA connection configuration is forbidden");
        }
    }

    static void validatePool(Environment environment, HikariDataSource pool) {
        // Getters only; never start the pool. Recheck after binding and before consumers.
        if (!required(environment, "TEST_DB_URL").equals(pool.getJdbcUrl())
                || !required(environment, "TEST_DB_USERNAME").equals(pool.getUsername())
                || !required(environment, "TEST_DB_PASSWORD").equals(pool.getPassword())
                || !"org.postgresql.Driver".equals(pool.getDriverClassName())
                || pool.getDataSource() != null || pool.getDataSourceClassName() != null
                || pool.getDataSourceJNDI() != null || !pool.getDataSourceProperties().isEmpty()) {
            throw rejected(Reason.EFFECTIVE_DATASOURCE, "effective pool must retain the authorized test connection");
        }
    }

    static SafetyViolation rejected(Reason reason, String message) {
        return new SafetyViolation(reason, message);
    }
}
