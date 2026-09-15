package com.oficinagestao;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationInfo;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class DatabaseConnectionTest {

    @Autowired(required = false)
    private DataSource dataSource;

    @Autowired(required = false)
    private Flyway flyway;

    @Test
    @DisplayName("Deve carregar o DataSource configurado")
    void shouldLoadDataSource() {
        assertNotNull(dataSource, "O DataSource não foi inicializado pelo Spring Context.");
    }

    @Test
    @DisplayName("Deve conectar ao banco de dados PostgreSQL e validar metadados")
    void shouldConnectToDatabase() throws Exception {
        assertNotNull(dataSource, "O DataSource deve estar presente.");
        try (Connection connection = dataSource.getConnection()) {
            assertNotNull(connection, "A conexão não deve ser nula.");
            assertFalse(connection.isClosed(), "A conexão deve estar aberta.");

            DatabaseMetaData metaData = connection.getMetaData();
            String productName = metaData.getDatabaseProductName();
            assertEquals("PostgreSQL", productName, "O banco de dados conectado deve ser PostgreSQL.");
        }
    }

    @Test
    @DisplayName("Deve validar que a migration Flyway V1 foi aplicada e as tabelas essenciais existem")
    void shouldValidateFlywayMigrationsAndTables() throws Exception {
        assertNotNull(flyway, "O bean Flyway deve estar inicializado.");

        MigrationInfo current = flyway.info().current();
        assertNotNull(current, "Deve haver uma migration Flyway aplicada.");
        assertEquals("1", current.getVersion().getVersion(), "A versão atual da migration deve ser 1.");
        assertEquals("create initial schema", current.getDescription());

        // Validar existência das 14 tabelas no banco de dados
        List<String> expectedTables = List.of(
                "usuarios", "roles", "usuario_roles", "clientes", "fornecedores",
                "enderecos", "maquinas", "categorias", "produtos", "produto_maquina",
                "ordens_servico", "ordem_servico_itens", "estoque_movimentacoes", "auditoria"
        );

        try (Connection connection = dataSource.getConnection();
             Statement stmt = connection.createStatement()) {

            List<String> existingTables = new ArrayList<>();
            try (ResultSet rs = stmt.executeQuery(
                    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")) {
                while (rs.next()) {
                    existingTables.add(rs.getString("table_name").toLowerCase());
                }
            }

            for (String table : expectedTables) {
                assertTrue(existingTables.contains(table),
                        "A tabela '" + table + "' deveria ter sido criada pela migration Flyway.");
            }
        }
    }
}
