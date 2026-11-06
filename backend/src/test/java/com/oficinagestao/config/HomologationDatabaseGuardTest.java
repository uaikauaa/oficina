package com.oficinagestao.config;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import org.flywaydb.core.api.configuration.Configuration;
import org.flywaydb.core.api.Location;
import org.flywaydb.core.api.MigrationInfo;
import org.flywaydb.core.api.MigrationInfoService;
import org.flywaydb.core.api.MigrationVersion;
import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.Statement;
import java.sql.ResultSet;
import java.sql.DatabaseMetaData;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class HomologationDatabaseGuardTest {
    private MockEnvironment settings() {
        var env = new MockEnvironment();
        env.setActiveProfiles("prod");
        return env.withProperty("APP_ENVIRONMENT", "homologation")
            .withProperty("HML_NEON_ISOLATED", "true").withProperty("HML_MIGRATIONS_APPROVED", "true")
            .withProperty("HML_DB_HOST", "ep-synthetic.sa-east-1.aws.neon.tech")
            .withProperty("HML_DB_NAME", "oficina_security_test").withProperty("HML_DB_USER", "hml_security_test")
            .withProperty("spring.datasource.username", "hml_security_test")
            .withProperty("spring.jpa.hibernate.ddl-auto", "validate")
            .withProperty("spring.datasource.url", "jdbc:postgresql://ep-synthetic.sa-east-1.aws.neon.tech:5432/oficina_security_test?sslmode=verify-full&sslfactory=org.postgresql.ssl.DefaultJavaSSLFactory&channelBinding=require");
    }

    @Test void approvedSettingsAreStrictAndDoNotOpenAConnection() {
        assertDoesNotThrow(() -> HomologationDatabaseGuard.validateSettings(settings()));
    }

    @Test void missingApprovalBlocksBeforeAnyFlywayInteraction() {
        var env = settings().withProperty("HML_MIGRATIONS_APPROVED", "false");
        var flyway = mock(Flyway.class);
        assertThrows(IllegalStateException.class, () -> new FlywayConfig().flywayMigrationStrategy(env).migrate(flyway));
        verifyNoInteractions(flyway);
    }

    @Test void rejectsWrongIdentityDowngradeOverridesAndUnapprovedDatabaseWithoutLeakingValues() {
        for (String key : new String[]{"HML_DB_HOST", "HML_DB_NAME", "HML_DB_USER", "spring.datasource.url", "spring.datasource.username", "spring.jpa.hibernate.ddl-auto", "HML_NEON_ISOLATED"}) {
            var env = settings().withProperty(key, "private-sentinel-value");
            var error = assertThrows(IllegalStateException.class, () -> HomologationDatabaseGuard.validateSettings(env));
            assertFalse(error.toString().contains("private-sentinel-value"));
            assertNull(error.getCause());
        }
        for (String mode : new String[]{"require", "prefer", "allow", "disable", "verify-ca"}) {
            var env = settings();
            env.setProperty("spring.datasource.url", env.getProperty("spring.datasource.url").replace("verify-full", mode));
            assertThrows(IllegalStateException.class, () -> HomologationDatabaseGuard.validateSettings(env));
        }
    }

    @Test void developmentProfileCannotAuthorizeRemoteHomologation() {
        var env = settings(); env.setActiveProfiles("dev");
        assertThrows(IllegalStateException.class, () -> HomologationDatabaseGuard.validateSettings(env));
        for (String host : new String[]{"ep-synthetic-pooler.sa-east-1.aws.neon.tech", "ep-synthetic.us-east-1.aws.neon.tech"}) {
            var wrong = settings().withProperty("HML_DB_HOST", host);
            assertThrows(IllegalStateException.class, () -> HomologationDatabaseGuard.validateSettings(wrong));
        }
    }

    @Test void approvedEmptyDatabaseChecksTlsAndIdentityBeforeMigration() throws Exception {
        var env = settings();
        var flyway = mock(Flyway.class); var config = mock(Configuration.class);
        var source = mock(DataSource.class); var connection = mock(Connection.class);
        var metadata = mock(DatabaseMetaData.class); var statement = mock(Statement.class);
        var identity = mock(ResultSet.class); var tls = mock(ResultSet.class);
        var history = mock(ResultSet.class); var empty = mock(ResultSet.class);
        when(flyway.getConfiguration()).thenReturn(config);
        when(config.isValidateOnMigrate()).thenReturn(true);
        when(config.getLocations()).thenReturn(new Location[]{new Location("classpath:db/migration")});
        when(config.getDataSource()).thenReturn(source);
        when(source.getConnection()).thenReturn(connection);
        when(connection.getMetaData()).thenReturn(metadata);
        when(metadata.getURL()).thenReturn(env.getProperty("spring.datasource.url"));
        when(connection.createStatement()).thenReturn(statement);
        when(statement.executeQuery(anyString())).thenReturn(identity, tls, history, empty);
        for (var rows : new ResultSet[]{identity, tls, history, empty}) when(rows.next()).thenReturn(true);
        when(identity.getString(1)).thenReturn("oficina_security_test"); when(identity.getString(2)).thenReturn("hml_security_test");
        when(tls.getBoolean(1)).thenReturn(true); when(tls.getString(2)).thenReturn("TLSv1.3");
        when(history.getBoolean(1)).thenReturn(false); when(empty.getBoolean(1)).thenReturn(true);
        var info = mock(MigrationInfoService.class); var baseline = mock(MigrationInfo.class);
        when(flyway.info()).thenReturn(info); when(info.pending()).thenReturn(new MigrationInfo[]{baseline});
        when(baseline.getScript()).thenReturn("B24__neutral_initial_schema.sql");
        when(baseline.getVersion()).thenReturn(MigrationVersion.fromVersion("24"));

        new FlywayConfig().flywayMigrationStrategy(env).migrate(flyway);

        var ordered = inOrder(connection, flyway);
        ordered.verify(connection).setReadOnly(true); ordered.verify(connection).setAutoCommit(false);
        ordered.verify(connection).rollback(); ordered.verify(flyway).info(); ordered.verify(flyway).migrate();
        verify(flyway, never()).validate();
        verify(flyway, never()).repair();
        // A different pending plan cannot initialize an empty homologation database.
        clearInvocations(flyway);
        when(statement.executeQuery(anyString())).thenReturn(identity, tls, history, empty);
        when(baseline.getScript()).thenReturn("V11__create_configuracao_oficina.sql");
        assertThrows(IllegalStateException.class, () -> new FlywayConfig().flywayMigrationStrategy(env).migrate(flyway));
        verify(flyway, never()).migrate();
        // Existing B24 history uses normal checksum validation before migrate.
        clearInvocations(flyway);
        var baselineHistory = mock(ResultSet.class); var versions = mock(ResultSet.class);
        when(baselineHistory.next()).thenReturn(true); when(baselineHistory.getBoolean(1)).thenReturn(true);
        when(versions.next()).thenReturn(true); when(versions.getBoolean(1)).thenReturn(true);
        when(history.getBoolean(1)).thenReturn(true);
        when(statement.executeQuery(anyString())).thenReturn(identity, tls, history, baselineHistory, versions);
        new FlywayConfig().flywayMigrationStrategy(env).migrate(flyway);
        var restart = inOrder(flyway); restart.verify(flyway).validate(); restart.verify(flyway).migrate();
        // Reuse the setup with an unexpected user object: migration must now be blocked.
        clearInvocations(flyway);
        when(history.getBoolean(1)).thenReturn(false);
        when(statement.executeQuery(anyString())).thenReturn(identity, tls, history, empty);
        when(empty.getBoolean(1)).thenReturn(false);
        assertThrows(IllegalStateException.class, () -> new FlywayConfig().flywayMigrationStrategy(env).migrate(flyway));
        verify(flyway, never()).migrate(); verify(flyway, never()).validate();
    }

    @Test void jdbcFailuresDoNotExposeCredentialsOrReachMigrate() throws Exception {
        var env = settings(); var flyway = mock(Flyway.class); var config = mock(Configuration.class);
        var source = mock(DataSource.class);
        when(flyway.getConfiguration()).thenReturn(config); when(config.isValidateOnMigrate()).thenReturn(true);
        when(config.getLocations()).thenReturn(new Location[]{new Location("classpath:db/migration")});
        when(config.getDataSource()).thenReturn(source);
        when(source.getConnection()).thenThrow(new java.sql.SQLException("private-sentinel-password"));
        var error = assertThrows(IllegalStateException.class, () -> new FlywayConfig().flywayMigrationStrategy(env).migrate(flyway));
        assertNull(error.getCause()); assertFalse(error.toString().contains("private-sentinel-password"));
        verify(flyway, never()).migrate(); verify(flyway, never()).repair();
    }
}
