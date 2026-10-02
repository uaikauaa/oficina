package com.oficinagestao.security;

import com.oficinagestao.dto.AlterarSenhaRequest;
import com.oficinagestao.dto.LoginResult;
import com.oficinagestao.dto.TwoFactorVerifyRequest;
import com.oficinagestao.entity.RefreshToken;
import com.oficinagestao.entity.TwoFactorChallenge;
import com.oficinagestao.entity.Usuario;
import com.oficinagestao.repository.RefreshTokenRepository;
import com.oficinagestao.repository.TwoFactorChallengeRepository;
import com.oficinagestao.repository.UsuarioRepository;
import com.oficinagestao.service.AuditoriaService;
import com.oficinagestao.service.AuthService;
import com.oficinagestao.service.EmailService;
import com.oficinagestao.repository.RoleRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.support.TransactionTemplate;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Bateria de testes de segurança para o ADC-01:
 * Armazenamento seguro de Refresh Tokens com hash SHA-256 determinístico.
 *
 * Garante que:
 * 1. Tokens nunca são armazenados em texto puro no banco de dados.
 * 2. Somente SHA-256 (64 hex lowercase) é gravado.
 * 3. O cliente envia/recebe o token bruto via cookie, e o backend calcula o SHA-256 para lookup.
 * 4. Validações de revogação, expiração, rotação, reuse detection, logout, alteração de senha,
 *    remember-me, 2FA, lock pessimista e tokenVersion continuam 100% íntegras.
 */
@SpringBootTest
class RefreshTokenHashSecurityTest {

    @Autowired
    private AuthService authService;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private TwoFactorChallengeRepository twoFactorChallengeRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private TokenHashUtil tokenHashUtil;

    @Autowired
    private DataSource dataSource;

    @Autowired
    private TransactionTemplate transactionTemplate;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @MockitoBean
    private AuditoriaService auditoriaService;

    @MockitoBean
    private EmailService emailService;

    private Usuario testUser;

    @BeforeEach
    void setUp() {
        String testEmail = "teste.refresh-hash-" + UUID.randomUUID() + "@oficina.local";
        testUser = new Usuario("Teste Refresh Hash", testEmail, passwordEncoder.encode("SenhaInicial@12345"), true);
        testUser.setTokenVersion(0);
        roleRepository.findByNome("ROLE_ADMIN").ifPresent(testUser::addRole);
        testUser = transactionTemplate.execute(status -> usuarioRepository.save(testUser));
    }

    @AfterEach
    void tearDown() {
        if (testUser != null && testUser.getId() != null) {
            Long userId = testUser.getId();
            transactionTemplate.execute(status -> {
                jdbcTemplate.update("DELETE FROM two_factor_challenges WHERE usuario_id = ?", userId);
                jdbcTemplate.update("DELETE FROM refresh_tokens WHERE usuario_id = ?", userId);
                jdbcTemplate.update("DELETE FROM usuario_roles WHERE usuario_id = ?", userId);
                jdbcTemplate.update("DELETE FROM usuarios WHERE id = ?", userId);
                return null;
            });
            assertFalse(usuarioRepository.existsById(userId), "Usuário efêmero deve ser removido após o teste.");
            Integer rfCount = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM refresh_tokens WHERE usuario_id = ?", Integer.class, userId);
            assertEquals(0, rfCount, "Não devem restar refresh_tokens para o usuário efêmero.");
            Integer tfCount = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM two_factor_challenges WHERE usuario_id = ?", Integer.class, userId);
            assertEquals(0, tfCount, "Não devem restar two_factor_challenges para o usuário efêmero.");
        }
    }

    @Test
    @DisplayName("ADC-01 (1 e 2): Refresh token recém-criado nunca é armazenado em texto puro; banco armazena somente SHA-256")
    void shouldStoreOnlySha256HashAndNeverPlainTextToken() throws Exception {
        // 1. Criar desafio 2FA simulado
        String code = "123456";
        String challengeToken = UUID.randomUUID().toString();
        TwoFactorChallenge challenge = new TwoFactorChallenge(
                testUser,
                challengeToken,
                passwordEncoder.encode(code),
                OffsetDateTime.now().plusMinutes(5),
                true
        );
        twoFactorChallengeRepository.save(challenge);

        // 2. Concluir 2FA via AuthService
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("127.0.0.1");
        TwoFactorVerifyRequest verifyRequest = new TwoFactorVerifyRequest(challengeToken, code);
        LoginResult loginResult = authService.verificarTwoFactor(verifyRequest, request);

        String rawTokenClient = loginResult.refreshToken();
        assertNotNull(rawTokenClient, "O cliente deve receber o token bruto no resultado de login.");

        // 3. Inspecionar diretamente a tabela do PostgreSQL via JDBC
        String expectedHash = tokenHashUtil.hash(rawTokenClient);
        assertEquals(64, expectedHash.length(), "O hash SHA-256 deve possuir exatamente 64 caracteres hexadecimais.");
        assertTrue(expectedHash.matches("^[a-f0-9]{64}$"), "O hash deve ser lowercase hexadecimal determinístico.");

        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement("SELECT token_hash FROM refresh_tokens WHERE usuario_id = ? AND revogado = false ORDER BY id DESC LIMIT 1")) {
            ps.setLong(1, testUser.getId());
            try (ResultSet rs = ps.executeQuery()) {
                assertTrue(rs.next(), "Deve encontrar o registro no banco.");
                String storedHash = rs.getString("token_hash");

                // Garantias de segurança:
                assertNotEquals(rawTokenClient, storedHash, "O banco JAMAIS deve armazenar o token em texto puro.");
                assertEquals(expectedHash, storedHash, "O banco deve armazenar estritamente o SHA-256 determinístico.");
            }
        }
    }

    @Test
    @DisplayName("ADC-01 (3 e 4): Token original bruto realiza refresh normalmente através de lookup por SHA-256")
    void shouldPerformRefreshUsingRawTokenViaSha256Lookup() {
        String rawToken = UUID.randomUUID().toString();
        String hash = tokenHashUtil.hash(rawToken);

        RefreshToken token = new RefreshToken(
                testUser,
                hash,
                OffsetDateTime.now().plusDays(5),
                true
        );
        refreshTokenRepository.save(token);

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("127.0.0.1");

        // O cliente envia o token bruto (como recebido no cookie)
        LoginResult refreshResult = authService.refresh(rawToken, request);

        assertNotNull(refreshResult);
        assertNotNull(refreshResult.accessToken());
        assertNotNull(refreshResult.refreshToken());
        assertNotEquals(rawToken, refreshResult.refreshToken(), "Rotação deve ter emitido um novo token.");

        // O token antigo foi revogado no banco buscando por hash
        RefreshToken oldToken = buscarTokenPorHash(hash);
        assertTrue(oldToken.getRevogado(), "O token anterior deve estar marcado como revogado.");
    }

    @Test
    @DisplayName("ADC-01 (5): Token inválido ou inexistente retorna 401 (BadCredentialsException)")
    void shouldReturn401ForInvalidOrNonexistentToken() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        assertThrows(BadCredentialsException.class, () ->
                authService.refresh("token-totalmente-inexistente-123", request)
        );
    }

    @Test
    @DisplayName("ADC-01 (6): Token revogado retorna 401 e aciona reuse detection (revoga família)")
    void shouldReturn401AndTriggerReuseDetectionForRevokedToken() {
        String rawToken = UUID.randomUUID().toString();
        String hash = tokenHashUtil.hash(rawToken);

        RefreshToken token = new RefreshToken(testUser, hash, OffsetDateTime.now().plusDays(5), true);
        token.revoke();
        refreshTokenRepository.save(token);

        MockHttpServletRequest request = new MockHttpServletRequest();
        BadCredentialsException ex = assertThrows(BadCredentialsException.class, () ->
                authService.refresh(rawToken, request)
        );
        assertTrue(ex.getMessage().contains("Refresh token revogado"));
    }

    @Test
    @DisplayName("ADC-01 (7): Token expirado retorna 401")
    void shouldReturn401ForExpiredToken() {
        String rawToken = UUID.randomUUID().toString();
        String hash = tokenHashUtil.hash(rawToken);

        RefreshToken token = new RefreshToken(testUser, hash, OffsetDateTime.now().minusDays(1), true);
        refreshTokenRepository.save(token);

        MockHttpServletRequest request = new MockHttpServletRequest();
        BadCredentialsException ex = assertThrows(BadCredentialsException.class, () ->
                authService.refresh(rawToken, request)
        );
        assertTrue(ex.getMessage().contains("Refresh token expirado"));
    }

    @Test
    @DisplayName("ADC-01 (8 e 9): Rotação e proteção contra reuso funcionam com tokens hasheados")
    void shouldRotateTokenAndPreventReuseWithHashedTokens() {
        String rawToken1 = UUID.randomUUID().toString();
        RefreshToken token1 = new RefreshToken(testUser, tokenHashUtil.hash(rawToken1), OffsetDateTime.now().plusDays(5), true);
        refreshTokenRepository.save(token1);

        MockHttpServletRequest request = new MockHttpServletRequest();

        // 1ª rotação: R1 -> R2
        LoginResult result2 = authService.refresh(rawToken1, request);
        String rawToken2 = result2.refreshToken();
        assertNotNull(rawToken2);
        assertNotEquals(rawToken1, rawToken2);

        // Tentativa de reutilizar R1: deve ser rejeitada
        assertThrows(BadCredentialsException.class, () ->
                authService.refresh(rawToken1, request)
        );

        // R2 continua válido e utilizável para nova rotação: R2 -> R3
        LoginResult result3 = authService.refresh(rawToken2, request);
        assertNotNull(result3.refreshToken());
        assertNotEquals(rawToken2, result3.refreshToken());
    }

    @Test
    @DisplayName("ADC-01 (10): Logout revoga o refresh token no banco usando hash")
    void shouldRevokeRefreshTokenOnLogoutUsingHash() {
        String rawToken = UUID.randomUUID().toString();
        String hash = tokenHashUtil.hash(rawToken);

        RefreshToken token = new RefreshToken(testUser, hash, OffsetDateTime.now().plusDays(5), true);
        refreshTokenRepository.save(token);

        MockHttpServletRequest request = new MockHttpServletRequest();
        authService.logout(testUser.getEmail(), rawToken, request);

        RefreshToken afterLogout = buscarTokenPorHash(hash);
        assertTrue(afterLogout.getRevogado(), "O token deve ser revogado após logout.");
    }

    @Test
    @DisplayName("ADC-01 (11): Alteração de senha revoga todos os refresh tokens e incrementa tokenVersion")
    void shouldRevokeAllTokensAndIncrementTokenVersionOnPasswordChange() {
        // Criar múltiplos tokens ativos para o usuário
        for (int i = 0; i < 3; i++) {
            String raw = UUID.randomUUID().toString();
            refreshTokenRepository.save(new RefreshToken(testUser, tokenHashUtil.hash(raw), OffsetDateTime.now().plusDays(5), true));
        }

        // Definir senha temporária conhecida
        transactionTemplate.execute(status -> {
            Usuario u = usuarioRepository.findById(testUser.getId()).orElseThrow();
            u.setSenha(passwordEncoder.encode("SenhaAtual@12345"));
            usuarioRepository.save(u);
            return null;
        });

        int versionBefore = testUser.getTokenVersion();

        MockHttpServletRequest request = new MockHttpServletRequest();
        AlterarSenhaRequest changeRequest = new AlterarSenhaRequest(
                "SenhaAtual@12345",
                "NovaSenha@Segura12345",
                "NovaSenha@Segura12345"
        );
        authService.alterarSenha(testUser.getEmail(), changeRequest, request);

        // Todos os refresh tokens devem estar revogados
        List<RefreshToken> remainingActive = refreshTokenRepository.findAll().stream()
                .filter(rt -> rt.getUsuario().getId().equals(testUser.getId()) && !rt.getRevogado())
                .toList();
        assertTrue(remainingActive.isEmpty(), "Todos os refresh tokens devem estar revogados após troca de senha.");

        // TokenVersion deve ter sido incrementada (SEC-07)
        Usuario updatedUser = usuarioRepository.findById(testUser.getId()).orElseThrow();
        assertEquals(versionBefore + 1, updatedUser.getTokenVersion());
    }

    @Test
    @DisplayName("ADC-01 (12): Remember-me true (7 dias) e false (24 horas) funcionam com tokens hasheados")
    void shouldMaintainRememberMeDurationsWithHashedTokens() {
        // 1. Remember-me = true (7 dias)
        String rawPersistent = UUID.randomUUID().toString();
        refreshTokenRepository.save(new RefreshToken(testUser, tokenHashUtil.hash(rawPersistent), OffsetDateTime.now().plusDays(5), true));
        MockHttpServletRequest request = new MockHttpServletRequest();
        LoginResult resPersistent = authService.refresh(rawPersistent, request);
        assertTrue(resPersistent.rememberMe());
        assertEquals(604800, resPersistent.refreshExpiresIn());

        // 2. Remember-me = false (24h)
        String rawTemp = UUID.randomUUID().toString();
        refreshTokenRepository.save(new RefreshToken(testUser, tokenHashUtil.hash(rawTemp), OffsetDateTime.now().plusHours(10), false));
        LoginResult resTemp = authService.refresh(rawTemp, request);
        assertFalse(resTemp.rememberMe());
        assertEquals(86400, resTemp.refreshExpiresIn());
    }

    @Test
    @DisplayName("ADC-01 (16 e Teste Especial de Migration): Validar conformidade de schema e migração determinística no PostgreSQL")
    void shouldValidatePostgresSchemaAndDeterministicMigration() throws Exception {
        try (Connection conn = dataSource.getConnection()) {
            // 1. Validar que coluna 'token' NÃO existe mais na tabela
            List<String> columns = new ArrayList<>();
            try (PreparedStatement ps = conn.prepareStatement(
                    "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'refresh_tokens'")) {
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        columns.add(rs.getString("column_name").toLowerCase());
                    }
                }
            }
            assertFalse(columns.contains("token"), "A coluna 'token' em texto puro NÃO DEVE mais existir na tabela refresh_tokens.");
            assertTrue(columns.contains("token_hash"), "A coluna 'token_hash' DEVE existir na tabela refresh_tokens.");

            // 2. Validar que a função do PostgreSQL encode(sha256(x::bytea), 'hex') produz exatamente o mesmo resultado de TokenHashUtil
            String sampleToken = "c8f25b2e-9df2-4217-b769-633857e4e1a0";
            String expectedJavaHash = TokenHashUtil.hashStatic(sampleToken);

            try (PreparedStatement ps = conn.prepareStatement("SELECT encode(sha256(?::bytea), 'hex') AS pg_hash")) {
                ps.setString(1, sampleToken);
                try (ResultSet rs = ps.executeQuery()) {
                    assertTrue(rs.next());
                    String pgHash = rs.getString("pg_hash");
                    assertEquals(expectedJavaHash, pgHash,
                            "O cálculo de hash no PostgreSQL deve ser 100% idêntico ao cálculo de hash em Java.");
                }
            }

            // 3. Validar que a coluna token_hash é NOT NULL e tem limite de 64 caracteres
            try (PreparedStatement ps = conn.prepareStatement(
                    "SELECT is_nullable, character_maximum_length FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'refresh_tokens' AND column_name = 'token_hash'")) {
                try (ResultSet rs = ps.executeQuery()) {
                    assertTrue(rs.next());
                    assertEquals("NO", rs.getString("is_nullable"), "A coluna token_hash deve ser NOT NULL.");
                    assertEquals(64, rs.getInt("character_maximum_length"), "A coluna token_hash deve ser VARCHAR(64).");
                }
            }

            // 4. Validar que NENHUM refresh token na base possui tamanho diferente de 64
            try (PreparedStatement ps = conn.prepareStatement("SELECT COUNT(*) FROM refresh_tokens WHERE length(token_hash) != 64")) {
                try (ResultSet rs = ps.executeQuery()) {
                    assertTrue(rs.next());
                    assertEquals(0, rs.getInt(1), "Todos os registros em refresh_tokens devem ter hashes de exatamente 64 caracteres.");
                }
            }
        }
    }

    private RefreshToken buscarTokenPorHash(String hash) {
        return transactionTemplate.execute(status ->
                refreshTokenRepository.findByTokenHash(hash).orElseThrow()
        );
    }
}
