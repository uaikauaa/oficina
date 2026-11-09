package com.oficinagestao;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.test.context.ActiveProfiles;
import javax.sql.DataSource;
import java.net.URI;
import static org.assertj.core.api.Assertions.assertThat;

/** Checks the connection borrowed from Spring, not merely an independently opened JDBC URL. */
@SpringBootTest
@ActiveProfiles("test")
class DatabaseIdentityRegressionTest {
    @Autowired DataSource dataSource;
    @Autowired Environment environment;

    @Test
    void springConnectionMustReachTheExplicitSyntheticDatabaseAndSchema() throws Exception {
        try (var connection = dataSource.getConnection()) {
            connection.setReadOnly(true);
            connection.setAutoCommit(false);
            try (var statement = connection.createStatement();
                 var result = statement.executeQuery("SELECT current_database(), current_user, current_schema(), current_setting('transaction_read_only')")) {
                assertThat(result.next()).isTrue();
                assertThat(result.getString(1)).isEqualTo("oficina_gestao_test");
                assertThat(result.getString(2)).isEqualTo(environment.getRequiredProperty("TEST_DB_USERNAME"));
                assertThat(result.getString(3)).isEqualTo("public");
                assertThat(result.getString(4)).isEqualTo("on");
                var actual = URI.create(connection.getMetaData().getURL().substring(5));
                var expected = URI.create(environment.getRequiredProperty("TEST_DB_URL").substring(5));
                assertThat(actual.getHost()).isEqualTo(expected.getHost());
                assertThat(actual.getPort()).isEqualTo(Integer.parseInt(environment.getRequiredProperty("TEST_DB_EXPECTED_PORT")));
                assertThat(actual.getPath()).isEqualTo(expected.getPath());
            } finally {
                connection.rollback();
                connection.setAutoCommit(true);
                connection.setReadOnly(false);
            }
        }
    }

    @Test
    void schemaChangesAreVisibleOnTheActualConnectionAndRolledBack() throws Exception {
        try (var connection = dataSource.getConnection()) {
            connection.setAutoCommit(false);
            try (var statement = connection.createStatement()) {
                statement.execute("SET LOCAL search_path TO pg_catalog");
                try (var result = statement.executeQuery("SELECT current_schema(), to_regclass('usuarios') IS NULL")) {
                    assertThat(result.next()).isTrue();
                    assertThat(result.getString(1)).isEqualTo("pg_catalog");
                    assertThat(result.getBoolean(2)).isTrue();
                }
            } finally {
                connection.rollback();
                connection.setAutoCommit(true);
            }
        }
    }
}
