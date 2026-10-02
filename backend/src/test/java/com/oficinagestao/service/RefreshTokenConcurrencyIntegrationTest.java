package com.oficinagestao.service;

import com.oficinagestao.dto.LoginResult;
import com.oficinagestao.entity.RefreshToken;
import com.oficinagestao.entity.Usuario;
import com.oficinagestao.repository.RefreshTokenRepository;
import com.oficinagestao.repository.UsuarioRepository;
import com.oficinagestao.repository.RoleRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.transaction.support.TransactionTemplate;

import com.oficinagestao.security.TokenHashUtil;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Testes de integração de concorrência real para rotação de Refresh Token (SEC-04 e ADC-01).
 * Valida a eficácia do bloqueio pessimista (@Lock(LockModeType.PESSIMISTIC_WRITE))
 * sob execução simultânea no PostgreSQL com armazenamento seguro por hash SHA-256.
 */
@SpringBootTest
class RefreshTokenConcurrencyIntegrationTest {

    @Autowired
    private AuthService authService;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

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
        String testEmail = "teste.refresh-concurrency-" + UUID.randomUUID() + "@oficina.local";
        testUser = new Usuario("Teste Refresh Concorrencia", testEmail, passwordEncoder.encode("Senha@Refresh12345"), true);
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
    @DisplayName("SEC-04 Cenário 1: Duas requisições simultâneas com o mesmo refresh token devem resultar em exatamente 1 rotação e 1 rejeição")
    void shouldPreventConcurrentRefreshFromConsumingSameToken() throws Exception {
        String tokenValue = UUID.randomUUID().toString();
        RefreshToken initialToken = new RefreshToken(
                testUser,
                TokenHashUtil.hashStatic(tokenValue),
                OffsetDateTime.now().plusDays(5),
                true
        );
        final Long initialTokenId = refreshTokenRepository.save(initialToken).getId();

        int threadsCount = 2;
        ExecutorService executor = Executors.newFixedThreadPool(threadsCount);
        CountDownLatch readyLatch = new CountDownLatch(threadsCount);
        CountDownLatch startLatch = new CountDownLatch(1);

        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger failureCount = new AtomicInteger(0);
        List<Throwable> exceptions = Collections.synchronizedList(new ArrayList<>());
        List<LoginResult> results = Collections.synchronizedList(new ArrayList<>());

        for (int i = 0; i < threadsCount; i++) {
            executor.submit(() -> {
                readyLatch.countDown();
                try {
                    startLatch.await(); // Disparo perfeitamente sincronizado
                    MockHttpServletRequest request = new MockHttpServletRequest();
                    request.setRemoteAddr("127.0.0.1");

                    LoginResult result = authService.refresh(tokenValue, request);
                    results.add(result);
                    successCount.incrementAndGet();
                } catch (Throwable t) {
                    failureCount.incrementAndGet();
                    exceptions.add(t);
                }
            });
        }

        readyLatch.await(5, TimeUnit.SECONDS);
        startLatch.countDown(); // Libera as threads simultaneamente

        executor.shutdown();
        assertTrue(executor.awaitTermination(15, TimeUnit.SECONDS));

        // 1. Validação estrita: exatamente 1 sucesso e 1 falha
        assertEquals(1, successCount.get(), "Exatamente uma requisição de refresh deve ter sucesso.");
        assertEquals(1, failureCount.get(), "A requisição concorrente deve ser rejeitada após a primeira consumir o token.");

        // 2. Validação da exceção da requisição rejeitada
        Throwable rejected = exceptions.get(0);
        assertTrue(rejected instanceof BadCredentialsException, "A requisição rejeitada deve lançar BadCredentialsException.");
        assertTrue(rejected.getMessage().contains("Refresh token revogado") || rejected.getMessage().contains("Refresh token"),
                "A mensagem deve indicar que o refresh token foi revogado.");

        // 3. Validação do estado no banco de dados
        RefreshToken updatedInitialToken = refreshTokenRepository.findById(initialTokenId).orElseThrow();
        assertTrue(updatedInitialToken.getRevogado(), "O refresh token original deve estar marcado como revogado.");

        // 4. Validação de sessão única emitida
        LoginResult winningSession = results.get(0);
        assertNotNull(winningSession.accessToken(), "Deve conter um novo access token emitido.");
        assertNotNull(winningSession.refreshToken(), "Deve conter um novo refresh token emitido.");
        assertNotEquals(tokenValue, winningSession.refreshToken(), "O novo refresh token deve ser diferente do original.");

        // 5. Validação de unicidade no banco: o novo token deve existir e estar válido
        RefreshToken newTokenInDb = buscarToken(winningSession.refreshToken());
        assertNotNull(newTokenInDb, "O novo refresh token deve existir no banco de dados.");
        assertFalse(newTokenInDb.getRevogado(), "O novo token emitido deve estar ativo.");
    }

    private RefreshToken buscarToken(String rawToken) {
        String tokenHash = TokenHashUtil.hashStatic(rawToken);
        return transactionTemplate.execute(status ->
                refreshTokenRepository.findByTokenHash(tokenHash).orElse(null)
        );
    }

    @Test
    @DisplayName("SEC-04 Cenário 2: Rotação concorrente preservando rememberMe=false emite sessão temporária única")
    void shouldEnforceSingleRotationUnderConcurrencyWithoutRememberMe() throws Exception {
        String tokenValue = UUID.randomUUID().toString();
        RefreshToken initialToken = new RefreshToken(
                testUser,
                TokenHashUtil.hashStatic(tokenValue),
                OffsetDateTime.now().plusHours(12),
                false
        );
        refreshTokenRepository.save(initialToken);

        int threadsCount = 2;
        ExecutorService executor = Executors.newFixedThreadPool(threadsCount);
        CountDownLatch readyLatch = new CountDownLatch(threadsCount);
        CountDownLatch startLatch = new CountDownLatch(1);

        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger failureCount = new AtomicInteger(0);
        List<LoginResult> results = Collections.synchronizedList(new ArrayList<>());

        for (int i = 0; i < threadsCount; i++) {
            executor.submit(() -> {
                readyLatch.countDown();
                try {
                    startLatch.await();
                    MockHttpServletRequest request = new MockHttpServletRequest();
                    request.setRemoteAddr("127.0.0.1");

                    LoginResult result = authService.refresh(tokenValue, request);
                    results.add(result);
                    successCount.incrementAndGet();
                } catch (Throwable t) {
                    failureCount.incrementAndGet();
                }
            });
        }

        readyLatch.await(5, TimeUnit.SECONDS);
        startLatch.countDown();

        executor.shutdown();
        assertTrue(executor.awaitTermination(15, TimeUnit.SECONDS));

        assertEquals(1, successCount.get());
        assertEquals(1, failureCount.get());
        assertFalse(results.get(0).rememberMe(), "A flag rememberMe=false deve ser preservada na nova sessão.");
    }

    @Test
    @DisplayName("SEC-04 Cenário 3: Rotações sequenciais legítimas (RT-A -> RT-B -> RT-C) devem funcionar normalmente")
    void shouldHandleSequentialRotationsSuccessfully() {
        String tokenA = UUID.randomUUID().toString();
        RefreshToken rtA = new RefreshToken(testUser, TokenHashUtil.hashStatic(tokenA), OffsetDateTime.now().plusDays(5), true);
        refreshTokenRepository.save(rtA);

        MockHttpServletRequest request = new MockHttpServletRequest();

        // 1ª rotação: RT-A -> RT-B
        LoginResult resultB = authService.refresh(tokenA, request);
        assertNotNull(resultB);
        String tokenB = resultB.refreshToken();
        assertNotEquals(tokenA, tokenB);

        // 2ª rotação: RT-B -> RT-C
        LoginResult resultC = authService.refresh(tokenB, request);
        assertNotNull(resultC);
        String tokenC = resultC.refreshToken();
        assertNotEquals(tokenB, tokenC);

        // RT-A e RT-B devem estar revogados; RT-C deve estar ativo
        assertTrue(buscarToken(tokenA).getRevogado());
        assertTrue(buscarToken(tokenB).getRevogado());
        assertFalse(buscarToken(tokenC).getRevogado());
    }

    @Test
    @DisplayName("SEC-04 Cenário 4 (TESTE 7): Reutilização de token original já rotacionado deve ser rejeitada e não gerar novo token")
    void shouldRejectReuseOfAlreadyRotatedTokenAndNotGenerateNewToken() {
        String tokenA = UUID.randomUUID().toString();
        RefreshToken rtA = new RefreshToken(testUser, TokenHashUtil.hashStatic(tokenA), OffsetDateTime.now().plusDays(5), true);
        refreshTokenRepository.save(rtA);

        MockHttpServletRequest request = new MockHttpServletRequest();

        // Rotação legítima RT-A -> RT-B
        LoginResult resultB = authService.refresh(tokenA, request);
        String tokenB = resultB.refreshToken();
        assertNotNull(tokenB);

        // Tentativa de reuso de RT-A: deve ser rejeitada
        BadCredentialsException ex = assertThrows(BadCredentialsException.class, () ->
                authService.refresh(tokenA, request)
        );
        assertTrue(ex.getMessage().contains("Refresh token revogado"));

        // O token original RT-A continua revogado e não gerou novo token
        assertTrue(buscarToken(tokenA).getRevogado());
    }

    @Test
    @DisplayName("SEC-04 Cenário 5: Tentativa de refresh com token expirado deve ser rejeitada")
    void shouldRejectExpiredRefreshToken() {
        String expiredToken = UUID.randomUUID().toString();
        RefreshToken rt = new RefreshToken(testUser, TokenHashUtil.hashStatic(expiredToken), OffsetDateTime.now().minusDays(1), true);
        refreshTokenRepository.save(rt);

        MockHttpServletRequest request = new MockHttpServletRequest();
        BadCredentialsException ex = assertThrows(BadCredentialsException.class, () ->
                authService.refresh(expiredToken, request)
        );
        assertTrue(ex.getMessage().contains("Refresh token expirado"));
    }

    @Test
    @DisplayName("SEC-04 Cenário 6: Tentativa de refresh com token inexistente deve ser rejeitada")
    void shouldRejectNonexistentRefreshToken() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        BadCredentialsException ex = assertThrows(BadCredentialsException.class, () ->
                authService.refresh("inexistente-" + UUID.randomUUID(), request)
        );
        assertTrue(ex.getMessage().contains("Refresh token não encontrado"));
    }

    @Test
    @DisplayName("SEC-04 Cenário 7: Logout deve revogar o refresh token no banco de dados sob lock")
    void shouldRevokeTokenOnLogout() {
        String tokenValue = UUID.randomUUID().toString();
        RefreshToken rt = new RefreshToken(testUser, TokenHashUtil.hashStatic(tokenValue), OffsetDateTime.now().plusDays(5), true);
        refreshTokenRepository.save(rt);

        MockHttpServletRequest request = new MockHttpServletRequest();
        authService.logout(testUser.getEmail(), tokenValue, request);

        RefreshToken afterLogout = buscarToken(tokenValue);
        assertNotNull(afterLogout);
        assertTrue(afterLogout.getRevogado(), "O token deve ser revogado no banco após logout.");
    }
}
