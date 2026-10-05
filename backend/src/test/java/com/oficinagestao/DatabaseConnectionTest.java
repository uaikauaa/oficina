package com.oficinagestao;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationInfo;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
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
    @DisplayName("Deve validar que as migrations Flyway V1 a V21 foram aplicadas e as tabelas essenciais existem sem estruturas fiscais")
    void shouldValidateFlywayMigrationsAndTables() throws Exception {
        assertNotNull(flyway, "O bean Flyway deve estar inicializado.");

        MigrationInfo current = flyway.info().current();
        assertNotNull(current, "Deve haver uma migration Flyway aplicada.");
        assertEquals("21", current.getVersion().getVersion(), "A versão atual da migration deve ser 21.");
        assertEquals("hash refresh tokens", current.getDescription());

        // Validar que a V1 também consta no histórico
        MigrationInfo v1 = flyway.info().applied()[0];
        assertEquals("1", v1.getVersion().getVersion());

        // Validar existência das 18 tabelas essenciais no banco de dados (incluindo notificacoes)
        List<String> expectedTables = List.of(
                "usuarios", "roles", "usuario_roles", "clientes", "fornecedores",
                "enderecos", "maquinas", "categorias", "produtos", "produto_maquina",
                "ordens_servico", "ordem_servico_itens", "estoque_movimentacoes", "auditoria",
                "refresh_tokens", "configuracao_oficina", "two_factor_challenges", "notificacoes");

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
                        "A tabela '" + table + "' deveria existir no banco de dados.");
            }

            // Validar que tabelas fiscais foram devidamente removidas pela V14
            assertFalse(existingTables.contains("dps_fiscal"),
                    "A tabela 'dps_fiscal' deve ter sido removida pela migration V14.");
            assertFalse(existingTables.contains("dps_numeracao"),
                    "A tabela 'dps_numeracao' deve ter sido removida pela migration V14.");

            // Validar que a coluna codigo_ibge foi removida da tabela clientes pela migration V15
            List<String> colunasClientes = new ArrayList<>();
            try (ResultSet rs = stmt.executeQuery(
                    "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clientes'")) {
                while (rs.next()) {
                    colunasClientes.add(rs.getString("column_name").toLowerCase());
                }
            }
            assertFalse(colunasClientes.contains("codigo_ibge"),
                    "A coluna 'codigo_ibge' deve ter sido removida de 'clientes' pela migration V15.");

            // Validar que codigo_barras foi removido e link_compra adicionado na tabela produtos pela migration V16
            List<String> colunasProdutos = new ArrayList<>();
            try (ResultSet rs = stmt.executeQuery(
                    "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'produtos'")) {
                while (rs.next()) {
                    colunasProdutos.add(rs.getString("column_name").toLowerCase());
                }
            }
            assertFalse(colunasProdutos.contains("codigo_barras"),
                    "A coluna 'codigo_barras' deve ter sido removida de 'produtos' pela migration V16.");
            assertTrue(colunasProdutos.contains("link_compra"),
                    "A coluna 'link_compra' deve existir em 'produtos' após a migration V16.");

            // ADC-01: Validar que token em texto puro foi removido e token_hash adicionado na tabela refresh_tokens pela migration V21
            List<String> colunasRefreshTokens = new ArrayList<>();
            try (ResultSet rs = stmt.executeQuery(
                    "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'refresh_tokens'")) {
                while (rs.next()) {
                    colunasRefreshTokens.add(rs.getString("column_name").toLowerCase());
                }
            }
            assertFalse(colunasRefreshTokens.contains("token"),
                    "A coluna em texto puro 'token' deve ter sido removida de 'refresh_tokens' pela migration V21.");
            assertTrue(colunasRefreshTokens.contains("token_hash"),
                    "A coluna 'token_hash' deve existir em 'refresh_tokens' após a migration V21.");
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
    @DisplayName("Deve validar que apenas ROLE_ADMIN existe e a integridade da associação do administrador ao papel ROLE_ADMIN")
    void shouldValidateSingleAdminRoleAndNoUsers() throws Exception {
        assertNotNull(dataSource, "O DataSource deve estar presente.");

        try (Connection connection = dataSource.getConnection();
                Statement stmt = connection.createStatement()) {

            // 1. Validar roles existentes na tabela roles (somente ROLE_ADMIN no MVP)
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

            // 2. Validar que nenhum usuário possui papel diferente de ROLE_ADMIN
            try (ResultSet rs = stmt.executeQuery(
                    "SELECT COUNT(*) FROM usuario_roles ur " +
                    "JOIN roles r ON r.id = ur.role_id " +
                    "WHERE r.nome != 'ROLE_ADMIN'")) {
                assertTrue(rs.next());
                assertEquals(0, rs.getInt(1), "Nenhum usuário deve possuir papel diferente de ROLE_ADMIN.");
            }

            // 3. Validar integridade da associação administrativa de forma determinística e isolada
            Long syntheticUserId = null;
            try {
                int totalUsuarios;
                try (ResultSet rs = stmt.executeQuery("SELECT COUNT(*) FROM usuarios")) {
                    assertTrue(rs.next());
                    totalUsuarios = rs.getInt(1);
                }

                String adminEmailParaValidar;
                if (totalUsuarios == 0) {
                    // Ambiente limpo/CI: cria registro administrativo sintético para validar integridade relacional
                    long roleAdminId;
                    try (ResultSet rs = stmt.executeQuery("SELECT id FROM roles WHERE nome = 'ROLE_ADMIN'")) {
                        assertTrue(rs.next());
                        roleAdminId = rs.getLong(1);
                    }

                    try (PreparedStatement pstmtUser = connection.prepareStatement(
                            "INSERT INTO usuarios (nome, email, senha, ativo, token_version, created_at, updated_at) " +
                            "VALUES ('Admin Teste CI', 'admin.ci-test@oficinagestao.local', '$2a$10$dummyHashBcryptForTestOnly1234567890', true, 0, NOW(), NOW()) RETURNING id")) {
                        try (ResultSet rs = pstmtUser.executeQuery()) {
                            assertTrue(rs.next());
                            syntheticUserId = rs.getLong(1);
                        }
                    }

                    try (PreparedStatement pstmtRole = connection.prepareStatement(
                            "INSERT INTO usuario_roles (usuario_id, role_id) VALUES (?, ?)")) {
                        pstmtRole.setLong(1, syntheticUserId);
                        pstmtRole.setLong(2, roleAdminId);
                        pstmtRole.executeUpdate();
                    }

                    adminEmailParaValidar = "admin.ci-test@oficinagestao.local";

                    // Valida que agora há exatamente 1 usuário criado deterministicamente
                    try (ResultSet rs = stmt.executeQuery("SELECT COUNT(*) FROM usuarios")) {
                        assertTrue(rs.next());
                        assertEquals(1, rs.getInt(1), "A tabela usuarios deve conter exatamente 1 usuário administrativo.");
                    }
                } else {
                    // Ambiente com usuário pré-existente: valida o primeiro usuário sem exigir credenciais hardcoded
                    try (ResultSet rs = stmt.executeQuery("SELECT email FROM usuarios LIMIT 1")) {
                        assertTrue(rs.next());
                        adminEmailParaValidar = rs.getString("email");
                    }
                }

                // 4. Validar que o administrador possui papel ROLE_ADMIN ativo e íntegro
                try (PreparedStatement pstmt = connection.prepareStatement(
                        "SELECT u.email, u.ativo, r.nome AS role_nome " +
                        "FROM usuarios u " +
                        "JOIN usuario_roles ur ON ur.usuario_id = u.id " +
                        "JOIN roles r ON r.id = ur.role_id " +
                        "WHERE u.email = ?")) {
                    pstmt.setString(1, adminEmailParaValidar);
                    try (ResultSet rs = pstmt.executeQuery()) {
                        assertTrue(rs.next(), "Deve encontrar o registro do administrador com seu papel associado.");
                        assertTrue(rs.getBoolean("ativo"), "O administrador deve estar ativo.");
                        assertEquals("ROLE_ADMIN", rs.getString("role_nome"), "O administrador deve possuir o papel ROLE_ADMIN.");
                    }
                }
            } finally {
                // Cleanup determinístico: se o usuário sintético foi criado por este teste, remove-o
                if (syntheticUserId != null) {
                    try (PreparedStatement pstmtDeleteUr = connection.prepareStatement("DELETE FROM usuario_roles WHERE usuario_id = ?");
                         PreparedStatement pstmtDeleteU = connection.prepareStatement("DELETE FROM usuarios WHERE id = ?")) {
                        pstmtDeleteUr.setLong(1, syntheticUserId);
                        pstmtDeleteUr.executeUpdate();
                        pstmtDeleteU.setLong(1, syntheticUserId);
                        pstmtDeleteU.executeUpdate();
                    }
                }
            }
        }
    }
}
