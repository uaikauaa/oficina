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
    @DisplayName("Deve validar que as migrations Flyway V1 a V9 foram aplicadas e as tabelas essenciais existem")
    void shouldValidateFlywayMigrationsAndTables() throws Exception {
        assertNotNull(flyway, "O bean Flyway deve estar inicializado.");

        MigrationInfo current = flyway.info().current();
        assertNotNull(current, "Deve haver uma migration Flyway aplicada.");
        assertEquals("9", current.getVersion().getVersion(), "A versão atual da migration deve ser 9.");
        assertEquals("add produto marca and seed categorias", current.getDescription());

        // Validar que a V1 também consta no histórico
        MigrationInfo v1 = flyway.info().applied()[0];
        assertEquals("1", v1.getVersion().getVersion());

        // Validar existência das 15 tabelas no banco de dados (14 anteriores +
        // refresh_tokens)
        List<String> expectedTables = List.of(
                "usuarios", "roles", "usuario_roles", "clientes", "fornecedores",
                "enderecos", "maquinas", "categorias", "produtos", "produto_maquina",
                "ordens_servico", "ordem_servico_itens", "estoque_movimentacoes", "auditoria",
                "refresh_tokens");

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

    @Test
    @DisplayName("Deve validar que as colunas e índices da tabela maquinas e ordens_servico refletem o domínio de equipamentos técnicos sem campos automotivos")
    void shouldValidateEquipmentDomainSchema() throws Exception {
        assertNotNull(dataSource, "O DataSource deve estar presente.");

        try (Connection connection = dataSource.getConnection();
                Statement stmt = connection.createStatement()) {

            // 1. Validar colunas de 'maquinas'
            List<String> colunasMaquinas = new ArrayList<>();
            try (ResultSet rs = stmt.executeQuery(
                    "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'maquinas'")) {
                while (rs.next()) {
                    colunasMaquinas.add(rs.getString("column_name").toLowerCase());
                }
            }

            // Colunas de equipamento técnico que DEVEM existir
            assertTrue(colunasMaquinas.contains("tipo_equipamento"),
                    "Coluna 'tipo_equipamento' deve existir em maquinas.");
            assertTrue(colunasMaquinas.contains("numero_serie"), "Coluna 'numero_serie' deve existir em maquinas.");
            assertTrue(colunasMaquinas.contains("horimetro"), "Coluna 'horimetro' deve existir em maquinas.");
            assertTrue(colunasMaquinas.contains("potencia"), "Coluna 'potencia' deve existir em maquinas.");
            assertTrue(colunasMaquinas.contains("tensao"), "Coluna 'tensao' deve existir em maquinas.");
            assertTrue(colunasMaquinas.contains("especificacoes_tecnicas"),
                    "Coluna 'especificacoes_tecnicas' deve existir em maquinas.");

            // Colunas automotivas que NÃO DEVEM existir
            assertFalse(colunasMaquinas.contains("placa_identificacao"),
                    "Coluna automotiva 'placa_identificacao' não deve existir em maquinas.");
            assertFalse(colunasMaquinas.contains("numero_serie_chassi"),
                    "Coluna automotiva 'numero_serie_chassi' não deve existir em maquinas.");
            assertFalse(colunasMaquinas.contains("horimetro_quilometragem"),
                    "Coluna 'horimetro_quilometragem' não deve existir em maquinas.");

            // 2. Validar colunas de 'ordens_servico'
            List<String> colunasOs = new ArrayList<>();
            try (ResultSet rs = stmt.executeQuery(
                    "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ordens_servico'")) {
                while (rs.next()) {
                    colunasOs.add(rs.getString("column_name").toLowerCase());
                }
            }

            assertTrue(colunasOs.contains("horimetro_atual"),
                    "Coluna 'horimetro_atual' deve existir em ordens_servico.");
            assertTrue(colunasOs.contains("testes_realizados"),
                    "Coluna 'testes_realizados' deve existir em ordens_servico.");
            assertFalse(colunasOs.contains("horimetro_quilometragem_atual"),
                    "Coluna automotiva 'horimetro_quilometragem_atual' não deve existir em ordens_servico.");

            // 3. Validar índices
            List<String> indices = new ArrayList<>();
            try (ResultSet rs = stmt.executeQuery(
                    "SELECT indexname FROM pg_indexes WHERE schemaname = 'public'")) {
                while (rs.next()) {
                    indices.add(rs.getString("indexname").toLowerCase());
                }
            }

            // Índices que DEVEM existir
            assertTrue(indices.contains("idx_maquinas_tipo_equipamento"),
                    "Índice 'idx_maquinas_tipo_equipamento' deve existir.");
            assertTrue(indices.contains("idx_maquinas_numero_serie"),
                    "Índice 'idx_maquinas_numero_serie' deve existir.");
            assertTrue(indices.contains("idx_maquinas_cliente_numero_serie"),
                    "Índice 'idx_maquinas_cliente_numero_serie' deve existir.");

            // Índices automotivos que NÃO DEVEM existir
            assertFalse(indices.contains("idx_maquinas_placa"),
                    "Índice automotivo 'idx_maquinas_placa' não deve existir.");
            assertFalse(indices.contains("idx_maquinas_chassi"),
                    "Índice automotivo 'idx_maquinas_chassi' não deve existir.");
        }
    }

    @Test
    @DisplayName("Deve validar que apenas ROLE_ADMIN existe e nenhum usuário fictício foi criado")
    void shouldValidateSingleAdminRoleAndNoUsers() throws Exception {
        assertNotNull(dataSource, "O DataSource deve estar presente.");

        try (Connection connection = dataSource.getConnection();
                Statement stmt = connection.createStatement()) {

            // Validar roles existentes
            List<String> existingRoles = new ArrayList<>();
            try (ResultSet rs = stmt.executeQuery("SELECT nome FROM roles")) {
                while (rs.next()) {
                    existingRoles.add(rs.getString("nome"));
                }
            }

            assertEquals(1, existingRoles.size(), "A tabela roles deve conter exatamente 1 papel no MVP.");
            assertTrue(existingRoles.contains("ROLE_ADMIN"), "O papel ROLE_ADMIN deve existir.");
            assertFalse(existingRoles.contains("ROLE_GERENTE"), "ROLE_GERENTE não deve existir no MVP.");
            assertFalse(existingRoles.contains("ROLE_MECANICO"), "ROLE_MECANICO não deve existir no MVP.");
            assertFalse(existingRoles.contains("ROLE_ATENDENTE"), "ROLE_ATENDENTE não deve existir no MVP.");

            // Validar que nenhum usuário fictício foi criado
            try (ResultSet rs = stmt.executeQuery("SELECT COUNT(*) FROM usuarios WHERE email != 'admin@oficina.com'")) {
                assertTrue(rs.next());
                int userCount = rs.getInt(1);
                assertEquals(0, userCount, "Nenhum usuário fictício deve existir na tabela usuarios.");
            }
        }
    }
}
