package com.oficinagestao.config;

import java.sql.Connection;
import java.util.Arrays;
import org.flywaydb.core.Flyway;
import org.springframework.core.env.Environment;

/** Additional gate for remote homologation only. Existing development/production paths are preserved. */
final class HomologationDatabaseGuard {
    private HomologationDatabaseGuard() {}

    static void validate(Environment env, Flyway flyway) {
        if (!"homologation".equals(env.getProperty("APP_ENVIRONMENT"))) return;
        try {
            validateSettings(env);
            var config = flyway.getConfiguration();
            if (config.isBaselineOnMigrate() || !config.isValidateOnMigrate()
                    || config.getLocations().length != 1
                    || !"classpath:db/migration".equals(config.getLocations()[0].getDescriptor())) throw rejected();
            boolean existingHistory;
            try (Connection connection = config.getDataSource().getConnection()) {
                connection.setReadOnly(true);
                connection.setAutoCommit(false);
                if (!env.getRequiredProperty("spring.datasource.url").equals(connection.getMetaData().getURL())) throw rejected();
                try (var statement = connection.createStatement()) {
                    statement.setQueryTimeout(10);
                    try (var rows = statement.executeQuery("SELECT current_database(), current_user")) {
                        if (!rows.next() || !env.getRequiredProperty("HML_DB_NAME").equals(rows.getString(1))
                                || !env.getRequiredProperty("HML_DB_USER").equals(rows.getString(2))) throw rejected();
                    }
                    try (var rows = statement.executeQuery("SELECT ssl,version FROM pg_stat_ssl WHERE pid=pg_backend_pid()")) {
                        if (!rows.next() || !rows.getBoolean(1)
                                || !java.util.Set.of("TLSv1.2", "TLSv1.3").contains(rows.getString(2))) throw rejected();
                    }
                    try (var rows = statement.executeQuery("SELECT to_regclass('public.flyway_schema_history') IS NOT NULL")) {
                        existingHistory = rows.next() && rows.getBoolean(1);
                    }
                    if (existingHistory) {
                        try (var rows = statement.executeQuery("SELECT count(*)=1 FROM public.flyway_schema_history WHERE success AND type='SQL_BASELINE' AND version='24' AND script='B24__neutral_initial_schema.sql'")) {
                            if (!rows.next() || !rows.getBoolean(1)) throw rejected();
                        }
                        try (var rows = statement.executeQuery("SELECT count(*)=0 FROM public.flyway_schema_history WHERE NOT success OR (version IS NOT NULL AND version::numeric < 24)")) {
                            if (!rows.next() || !rows.getBoolean(1)) throw rejected();
                        }
                    } else {
                        try (var rows = statement.executeQuery("""
                            SELECT NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                              WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp_%')
                            AND NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                              WHERE n.nspname NOT IN ('pg_catalog','information_schema'))
                            AND NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
                              WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp_%')
                            """)) {
                            if (!rows.next() || !rows.getBoolean(1)) throw rejected();
                        }
                    }
                } finally { connection.rollback(); }
            }
            if (existingHistory) {
                // No repair/administrative baseline; existing checksums must validate.
                flyway.validate();
            } else {
                // Standalone validate() rejects expected pending migrations on a new DB.
                // Inspect the read-only plan: only the reviewed B24 can initialize it.
                var pending = flyway.info().pending();
                if (pending.length != 1 || !"B24__neutral_initial_schema.sql".equals(pending[0].getScript())
                        || pending[0].getVersion() == null || !"24".equals(pending[0].getVersion().getVersion())) throw rejected();
            }
        } catch (Exception error) {
            // JDBC and binding exceptions may contain connection information. Never attach them.
            throw rejected();
        }
    }

    static void validateSettings(Environment env) {
        if (!Arrays.asList(env.getActiveProfiles()).contains("prod")
                || !"true".equals(env.getProperty("HML_NEON_ISOLATED"))
                || !"true".equals(env.getProperty("HML_MIGRATIONS_APPROVED"))) throw rejected();
        String host = env.getProperty("HML_DB_HOST", ""), database = env.getProperty("HML_DB_NAME", "");
        String user = env.getProperty("HML_DB_USER", "");
        if (!host.matches("ep-[a-z0-9-]+(?:\\.[a-z0-9-]+)*\\.neon\\.tech")
                || host.contains("-pooler") || !host.endsWith(".sa-east-1.aws.neon.tech")
                || !database.matches("[a-z][a-z0-9_]*_security_test")
                || (!database.equals("oficina_security_test") && !database.equals(env.getProperty("HML_APPROVED_DATABASE")))
                || !user.matches("[a-z0-9_]*security_test[a-z0-9_]*")
                || !user.equals(env.getProperty("spring.datasource.username"))) throw rejected();
        String expected = "jdbc:postgresql://" + host + ":5432/" + database
                + "?sslmode=verify-full&sslfactory=org.postgresql.ssl.DefaultJavaSSLFactory&channelBinding=require";
        if (!expected.equals(env.getProperty("spring.datasource.url"))
                || !"validate".equals(env.getProperty("spring.jpa.hibernate.ddl-auto"))) throw rejected();
    }

    private static IllegalStateException rejected() {
        return new IllegalStateException("Homologation database gate rejected configuration, TLS, identity, schema or migration approval; private details omitted.");
    }
}
