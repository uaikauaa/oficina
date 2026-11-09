package com.oficinagestao.testsupport;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.mock.env.MockEnvironment;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/** Real Flyway/JDBC tests in entirely NEW databases on the guarded local test server.
 * Never runs the historical real-identity seeds, including while building legacy fixtures.
 */
class ProductionMigrationPathTest {
    private static String url, user, password, syntheticLocation;
    @TempDir Path directory;

    @BeforeAll
    static void guardLocalTestServerBeforeOpeningAnyConnection() {
        var env = new MockEnvironment();
        env.setActiveProfiles("test");
        for (String name : List.of("TEST_DB_URL", "TEST_DB_USERNAME", "TEST_DB_PASSWORD", "TEST_DB_EXPECTED_PORT", "TEST_FLYWAY_LOCATION")) {
            String value = System.getenv(name);
            if (value == null) throw new IllegalStateException("Explicit isolated TEST_DB_* and TEST_FLYWAY_LOCATION required");
            env.setProperty(name, value);
        }
        env.setProperty("app.test-database", "true");
        env.setProperty("spring.datasource.url", env.getRequiredProperty("TEST_DB_URL"));
        env.setProperty("spring.datasource.username", env.getRequiredProperty("TEST_DB_USERNAME"));
        env.setProperty("spring.datasource.password", env.getRequiredProperty("TEST_DB_PASSWORD"));
        env.setProperty("spring.flyway.locations", env.getRequiredProperty("TEST_FLYWAY_LOCATION"));
        TestDatabaseSafetyGuard.validate(env);
        syntheticLocation = SyntheticMigrations.location(env);
        url = env.getRequiredProperty("TEST_DB_URL");
        user = env.getRequiredProperty("TEST_DB_USERNAME");
        password = env.getRequiredProperty("TEST_DB_PASSWORD");
    }

    @Test
    void emptyDatabaseUsesProductionBaselineWithoutEverExecutingRealIdentitySeeds() throws Exception {
        try (var db = new Database()) {
            assertEquals(0, db.jdbc.queryForObject("SELECT count(*) FROM information_schema.tables WHERE table_schema='public'", Integer.class));
            Flyway flyway = db.production();
            assertEquals(2, flyway.migrate().migrationsExecuted);
            flyway.validate();
            assertEquals(List.of("B24__neutral_initial_schema.sql", "V25__admin_rbac.sql"), db.jdbc.queryForList(
                    "SELECT script FROM flyway_schema_history WHERE version IS NOT NULL ORDER BY installed_rank", String.class));
            assertEquals("SQL_BASELINE", db.jdbc.queryForObject("SELECT type FROM flyway_schema_history WHERE version='24'", String.class));
            assertEquals("25", flyway.info().current().getVersion().getVersion());
            assertNeutralDatabase(db);
            var before = businessData(db);
            assertEquals(0, flyway.migrate().migrationsExecuted);
            assertEquals(before, businessData(db));

            // Prove that B24 does not prevent future versioned migrations from running normally.
            Path future = directory.resolve("V26__synthetic_future_probe.sql");
            Files.writeString(future, "CREATE TABLE synthetic_future_probe (id integer PRIMARY KEY);\n");
            Flyway next = Flyway.configure().dataSource(db.source)
                    .locations("classpath:db/migration", "filesystem:" + directory.toAbsolutePath())
                    .baselineOnMigrate(false).load();
            assertEquals(1, next.migrate().migrationsExecuted);
            next.validate();
            assertEquals("26", next.info().current().getVersion().getVersion());
        }
    }

    @Test
    void productionBaselineHasTheSameSchemaAsTheFullHistoricalChain() throws Exception {
        try (var fresh = new Database(); var legacy = new Database()) {
            fresh.production().migrate();
            legacy.synthetic("25").migrate();
            assertEquals(schema(legacy), schema(fresh), "Columns, defaults, constraints, indexes, sequences, functions and triggers must match");
            assertEquals(legacy.jdbc.queryForList("SELECT id,nome,descricao FROM roles ORDER BY id"), fresh.jdbc.queryForList("SELECT id,nome,descricao FROM roles ORDER BY id"));
            assertEquals(legacy.jdbc.queryForList("SELECT nome, descricao, ativo FROM categorias ORDER BY nome"),
                    fresh.jdbc.queryForList("SELECT nome, descricao, ativo FROM categorias ORDER BY nome"));
        }
    }

    @Test
    void existingV21HistoryUpgradesWithoutBaselineOrChangesToBusinessData() throws Exception {
        try (var db = new Database(); var resolver = new Database()) {
            legacyFixture(db, resolver, "21");
            var before = businessData(db);
            Flyway flyway = db.production();
            assertEquals(4, flyway.migrate().migrationsExecuted);
            flyway.validate();
            assertEquals("25", flyway.info().current().getVersion().getVersion());
            // V22 widens a numeric column; V23/V24 add empty security tables.
            var after = businessData(db);
            after.keySet().removeIf(name -> name.startsWith("security_rate_"));
            assertEquals(before, after);
            assertEquals(25, db.jdbc.queryForObject("SELECT count(*) FROM flyway_schema_history WHERE type='SQL'", Integer.class));
            assertEquals(0, db.jdbc.queryForObject("SELECT count(*) FROM flyway_schema_history WHERE script LIKE 'B%'", Integer.class));
        }
    }

    @Test
    void existingV24DataAndChecksumsRemainUntouchedAndTamperingStillFails() throws Exception {
        try (var db = new Database(); var resolver = new Database()) {
            legacyFixture(db, resolver, "24");
            var before = businessData(db);
            var history = db.jdbc.queryForList("SELECT * FROM flyway_schema_history ORDER BY installed_rank");
            Flyway flyway = db.production();
            assertEquals(1, flyway.migrate().migrationsExecuted);
            flyway.validate();
            assertEquals(before, businessData(db));
            assertEquals(history, db.jdbc.queryForList("SELECT * FROM flyway_schema_history WHERE installed_rank <= 24 ORDER BY installed_rank"));
            db.jdbc.update("UPDATE flyway_schema_history SET checksum=checksum+1 WHERE version='11'");
            var changed = db.jdbc.queryForObject("SELECT checksum FROM flyway_schema_history WHERE version='11'", Integer.class);
            assertThrows(org.flywaydb.core.api.exception.FlywayValidateException.class, flyway::migrate);
            assertEquals(changed, db.jdbc.queryForObject("SELECT checksum FROM flyway_schema_history WHERE version='11'", Integer.class));
            assertEquals(before, businessData(db));
        }
    }

    @Test
    void nonemptyUnversionedDatabaseIsNotSilentlyBaselined() throws Exception {
        try (var db = new Database()) {
            db.jdbc.execute("CREATE TABLE preserve_me (value text NOT NULL)");
            db.jdbc.update("INSERT INTO preserve_me VALUES ('synthetic-existing-data')");
            assertThrows(org.flywaydb.core.api.FlywayException.class, () -> db.production().migrate());
            assertEquals(List.of("synthetic-existing-data"), db.jdbc.queryForList("SELECT value FROM preserve_me", String.class));
            assertEquals(0, db.jdbc.queryForObject("SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='configuracao_oficina'", Integer.class));
        }
    }

    private static void assertNeutralDatabase(Database db) {
        var row = db.jdbc.queryForMap("SELECT * FROM configuracao_oficina");
        assertEquals("Oficina Gestão", row.get("nome_sistema"));
        assertEquals("Oficina não configurada", row.get("nome_fantasia"));
        for (String column : List.of("nome_empresarial", "cnpj", "responsavel", "telefone", "email", "logradouro", "numero", "bairro", "cep", "municipio", "uf"))
            assertNull(row.get(column), "A new configuration must not invent identity/contact data: " + column);
        for (var entry : businessData(db).entrySet()) {
            int expected = switch (entry.getKey()) { case "configuracao_oficina" -> 1; case "categorias" -> 6; default -> 0; };
            assertEquals(expected, entry.getValue().size(), "Unexpected seed rows in " + entry.getKey());
        }
    }

    /** Explicit test fixture only: synthetic SQL builds the legacy schema so no real seed is
     * executed. History metadata is then populated with the unmodified production checksums.
     * This is NOT a repair procedure and is never used by application/provisioning code.
     */
    private static void legacyFixture(Database db, Database resolver, String version) {
        db.synthetic(version).migrate();
        for (var migration : resolver.production().info().all()) {
            if (migration.getScript().startsWith("V") && migration.getVersion() != null)
                db.jdbc.update("UPDATE flyway_schema_history SET checksum=? WHERE version=?", migration.getChecksum(), migration.getVersion().getVersion());
        }
        db.jdbc.update("UPDATE configuracao_oficina SET nome_fantasia='Empresa Sintetica Preservada', email='preservar@example.invalid', responsavel='Pessoa Sintetica'");
        db.jdbc.update("INSERT INTO usuarios (nome,email,senha,ativo) VALUES ('Pessoa Sintetica','migration@example.invalid','synthetic-unused-hash',true)");
        db.jdbc.update("INSERT INTO usuario_roles (usuario_id,role_id) SELECT u.id,r.id FROM usuarios u CROSS JOIN roles r");
    }

    private static Map<String, List<String>> businessData(Database db) {
        Map<String, List<String>> result = new LinkedHashMap<>();
        for (String table : db.jdbc.queryForList("SELECT tablename FROM pg_tables WHERE schemaname='public' "
                + "AND tablename NOT IN ('flyway_schema_history','roles','role_permissoes','permissoes',"
                + "'convites_usuarios','eventos_administrativos') ORDER BY tablename", String.class)) {
            assertTrue(table.matches("[a-z_]+"));
            result.put(table, db.jdbc.queryForList("SELECT row_to_json(t)::text FROM " + table + " t ORDER BY row_to_json(t)::text", String.class));
        }
        return result;
    }

    private static List<List<Map<String, Object>>> schema(Database db) {
        return List.of(
            db.jdbc.queryForList("SELECT table_name,column_name,ordinal_position,column_default,is_nullable,data_type,udt_name,character_maximum_length,numeric_precision,numeric_scale FROM information_schema.columns WHERE table_schema='public' AND table_name<>'flyway_schema_history' ORDER BY table_name,ordinal_position"),
            db.jdbc.queryForList("SELECT c.relname,con.conname,pg_get_constraintdef(con.oid) AS definition FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname<>'flyway_schema_history' ORDER BY c.relname,con.conname"),
            db.jdbc.queryForList("SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename<>'flyway_schema_history' ORDER BY tablename,indexname"),
            db.jdbc.queryForList("SELECT sequencename,data_type,start_value,min_value,max_value,increment_by,cycle,cache_size FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename"),
            db.jdbc.queryForList("SELECT p.proname,pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' ORDER BY p.proname"),
            db.jdbc.queryForList("SELECT event_object_table,trigger_name,action_statement FROM information_schema.triggers WHERE trigger_schema='public' ORDER BY event_object_table,trigger_name")
        );
    }

    private static class Database implements AutoCloseable {
        final String name = "oficina_migration_test_" + UUID.randomUUID().toString().replace("-", "");
        final DriverManagerDataSource source;
        final JdbcTemplate jdbc;
        Database() throws Exception {
            assertTrue(name.matches("oficina_migration_test_[a-f0-9]{32}"));
            try (Connection admin = java.sql.DriverManager.getConnection(url, user, password); var statement = admin.createStatement()) {
                statement.execute("CREATE DATABASE " + name);
            }
            source = new DriverManagerDataSource(url.substring(0, url.lastIndexOf('/') + 1) + name, user, password);
            jdbc = new JdbcTemplate(source);
        }
        Flyway production() { return Flyway.configure().dataSource(source).locations("classpath:db/migration").baselineOnMigrate(false).validateOnMigrate(true).load(); }
        Flyway synthetic(String target) { return Flyway.configure().dataSource(source).locations(syntheticLocation).target(target).baselineOnMigrate(false).load(); }
        @Override public void close() throws Exception {
            // The name is generated locally and validated; no caller-provided database is dropped.
            try (Connection admin = java.sql.DriverManager.getConnection(url, user, password); var statement = admin.createStatement()) {
                statement.execute("DROP DATABASE " + name + " WITH (FORCE)");
            }
        }
    }
}
