package com.oficinagestao.config;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.test.context.ActiveProfiles;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@ActiveProfiles("test")
class FlywayEmptySchemaIntegrationTest {

    @Autowired
    private DataSource dataSource;

    @Autowired
    private Environment environment;

    @Test
    void emptySchemaMigratesFromV1ToV22WithoutBaseline() throws Exception {
        String schema = "flyway_empty_" + UUID.randomUUID().toString().replace("-", "");

        try (Connection connection = dataSource.getConnection(); Statement statement = connection.createStatement()) {
            statement.execute("CREATE SCHEMA " + schema);
        }

        try {
            Flyway flyway = Flyway.configure()
                    .dataSource(dataSource)
                    .schemas(schema)
                    .defaultSchema(schema)
                    .locations("classpath:db/migration")
                    .baselineOnMigrate(false)
                    .validateOnMigrate(true)
                    .load();

            new FlywayConfig().flywayMigrationStrategy().migrate(flyway);

            assertEquals("22", flyway.info().current().getVersion().getVersion());
            assertFalse(environment.getProperty("spring.flyway.baseline-on-migrate", Boolean.class, true));

            try (Connection connection = dataSource.getConnection(); Statement statement = connection.createStatement()) {
                try (ResultSet tables = statement.executeQuery(
                        "SELECT COUNT(*) FROM information_schema.tables " +
                                "WHERE table_schema = '" + schema + "' AND table_name = 'usuarios'")) {
                    assertTrue(tables.next());
                    assertEquals(1, tables.getInt(1));
                }

                try (ResultSet history = statement.executeQuery(
                        "SELECT type FROM " + schema + ".flyway_schema_history " +
                                "WHERE installed_rank = 1")) {
                    assertTrue(history.next());
                    assertEquals("SQL", history.getString(1));
                }
            }
        } finally {
            try (Connection connection = dataSource.getConnection(); Statement statement = connection.createStatement()) {
                statement.execute("DROP SCHEMA IF EXISTS " + schema + " CASCADE");
            }
        }
    }

    @Test
    void existingV21SchemaMigratesToV22() throws Exception {
        String schema = "flyway_upgrade_" + UUID.randomUUID().toString().replace("-", "");
        try (Connection connection = dataSource.getConnection(); Statement statement = connection.createStatement()) {
            statement.execute("CREATE SCHEMA " + schema);
        }

        try {
            Flyway v21 = Flyway.configure().dataSource(dataSource).schemas(schema).defaultSchema(schema)
                    .locations("classpath:db/migration").target("21").baselineOnMigrate(false).load();
            v21.migrate();
            assertEquals("21", v21.info().current().getVersion().getVersion());

            Flyway v22 = Flyway.configure().dataSource(dataSource).schemas(schema).defaultSchema(schema)
                    .locations("classpath:db/migration").baselineOnMigrate(false).validateOnMigrate(true).load();
            v22.migrate();
            v22.validate();
            assertEquals("22", v22.info().current().getVersion().getVersion());

            try (Connection connection = dataSource.getConnection(); Statement statement = connection.createStatement();
                 ResultSet column = statement.executeQuery("SELECT numeric_precision, numeric_scale FROM information_schema.columns "
                         + "WHERE table_schema = '" + schema + "' AND table_name = 'produtos' AND column_name = 'margem_lucro'")) {
                assertTrue(column.next());
                assertEquals(16, column.getInt(1));
                assertEquals(2, column.getInt(2));
            }
        } finally {
            try (Connection connection = dataSource.getConnection(); Statement statement = connection.createStatement()) {
                statement.execute("DROP SCHEMA IF EXISTS " + schema + " CASCADE");
            }
        }
    }
}
