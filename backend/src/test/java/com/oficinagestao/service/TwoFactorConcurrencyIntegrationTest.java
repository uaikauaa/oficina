package com.oficinagestao.service;

import com.oficinagestao.dto.LoginChallengeResponse;
import com.oficinagestao.dto.LoginRequest;
import com.oficinagestao.dto.LoginResult;
import com.oficinagestao.dto.TwoFactorResendRequest;
import com.oficinagestao.dto.TwoFactorVerifyRequest;
import com.oficinagestao.entity.TwoFactorChallenge;
import com.oficinagestao.entity.Usuario;
import com.oficinagestao.repository.RefreshTokenRepository;
import com.oficinagestao.repository.TwoFactorChallengeRepository;
import com.oficinagestao.repository.UsuarioRepository;
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

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class TwoFactorConcurrencyIntegrationTest {

    @Autowired
    private AuthService authService;

    @Autowired
    private TwoFactorChallengeRepository twoFactorChallengeRepository;

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private TransactionTemplate transactionTemplate;

    @MockitoBean
    private AuditoriaService auditoriaService;

    @MockitoBean
    private EmailService emailService;

    private Usuario testUser;

    @BeforeEach
    void setUp() {
        testUser = usuarioRepository.findByEmail("brunosoldasourinhos@hotmail.com")
                .or(() -> usuarioRepository.findByEmail("admin@oficina.com"))
                .or(() -> usuarioRepository.findAll().stream().findFirst())
                .orElseThrow(() -> new IllegalStateException("Usuário administrador deve existir na base de dados."));
    }

    @AfterEach
    void tearDown() {
        if (testUser != null && testUser.getId() != null) {
            transactionTemplate.execute(status -> {
                twoFactorChallengeRepository.revokeAllActiveByUsuarioId(testUser.getId());
                refreshTokenRepository.revokeAllByUsuarioId(testUser.getId());
                return null;
            });
        }
    }

    @Test
    @DisplayName("CENÁRIO 4: Duas requisições simultâneas com o código correto devem resultar em exatamente 1 autenticação e 1 rejeição")
    void shouldPreventDuplicateConsumptionWhenConcurrentValidRequestsArrive() throws Exception {
        String code = "543210";
        String challengeToken = UUID.randomUUID().toString();
        TwoFactorChallenge challenge = new TwoFactorChallenge(
                testUser,
                challengeToken,
                passwordEncoder.encode(code),
                OffsetDateTime.now().plusMinutes(5),
                true
        );
        final Long challengeId = twoFactorChallengeRepository.save(challenge).getId();

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
                    startLatch.await(); // Disparo sincronizado
                    MockHttpServletRequest request = new MockHttpServletRequest();
                    request.setRemoteAddr("127.0.0.1");

                    TwoFactorVerifyRequest verifyRequest = new TwoFactorVerifyRequest(challengeToken, code);
                    LoginResult result = authService.verificarTwoFactor(verifyRequest, request);
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

        // Validação estrita do resultado
        assertEquals(1, successCount.get(), "Exatamente uma requisição deve conseguir autenticar com sucesso.");
        assertEquals(1, failureCount.get(), "A segunda requisição concorrente deve ser rejeitada.");

        Throwable rejectedException = exceptions.get(0);
        assertTrue(rejectedException instanceof BadCredentialsException, "A falha deve ser BadCredentialsException.");
        assertTrue(rejectedException.getMessage().contains("Desafio inválido ou expirado"),
                "A mensagem deve indicar desafio inválido/expirado.");

        // Validação no banco de dados (leitura por ID não requer lock)
        TwoFactorChallenge updatedChallenge = twoFactorChallengeRepository.findById(challengeId).orElseThrow();
        assertTrue(updatedChallenge.getUtilizado(), "O desafio deve estar marcado como utilizado no banco.");
        assertEquals(1, updatedChallenge.getTentativas(), "O contador de tentativas deve refletir apenas o consumo do vencedor.");

        // Validação de sessão única
        LoginResult singleSession = results.get(0);
        assertNotNull(singleSession.accessToken());
        assertNotNull(singleSession.refreshToken());
    }

    @Test
    @DisplayName("CENÁRIO 5: Requisições incorretas simultâneas a partir de 4 tentativas não devem ultrapassar 5 tentativas")
    void shouldStrictlyEnforceMax5AttemptsUnderConcurrency() throws Exception {
        String correctCode = "888999";
        String wrongCode = "000000";
        String challengeToken = UUID.randomUUID().toString();

        TwoFactorChallenge challenge = new TwoFactorChallenge(
                testUser,
                challengeToken,
                passwordEncoder.encode(correctCode),
                OffsetDateTime.now().plusMinutes(5),
                false
        );
        challenge.setTentativas(4); // Estado inicial: 4 tentativas anteriores
        final Long challengeId = twoFactorChallengeRepository.save(challenge).getId();

        int threadsCount = 4; // 4 requisições incorretas simultâneas
        ExecutorService executor = Executors.newFixedThreadPool(threadsCount);
        CountDownLatch readyLatch = new CountDownLatch(threadsCount);
        CountDownLatch startLatch = new CountDownLatch(1);

        AtomicInteger failureCount = new AtomicInteger(0);
        List<Throwable> exceptions = Collections.synchronizedList(new ArrayList<>());

        for (int i = 0; i < threadsCount; i++) {
            executor.submit(() -> {
                readyLatch.countDown();
                try {
                    startLatch.await();
                    MockHttpServletRequest request = new MockHttpServletRequest();
                    request.setRemoteAddr("127.0.0.1");

                    TwoFactorVerifyRequest verifyRequest = new TwoFactorVerifyRequest(challengeToken, wrongCode);
                    authService.verificarTwoFactor(verifyRequest, request);
                } catch (Throwable t) {
                    failureCount.incrementAndGet();
                    exceptions.add(t);
                }
            });
        }

        readyLatch.await(5, TimeUnit.SECONDS);
        startLatch.countDown();

        executor.shutdown();
        assertTrue(executor.awaitTermination(15, TimeUnit.SECONDS));

        // Todas as 4 requisições devem falhar
        assertEquals(4, failureCount.get(), "Todas as requisições incorretas devem ser rejeitadas.");

        // Validação de estado final no banco de dados
        TwoFactorChallenge updatedChallenge = twoFactorChallengeRepository.findById(challengeId).orElseThrow();
        assertEquals(5, updatedChallenge.getTentativas(), "O contador de tentativas NUNCA deve ultrapassar 5.");
        assertTrue(updatedChallenge.getRevogado(), "O desafio deve estar revogado após a 5ª tentativa.");

        // 6ª tentativa subsequente deve ser rejeitada imediatamente
        MockHttpServletRequest request6 = new MockHttpServletRequest();
        assertThrows(BadCredentialsException.class, () ->
                authService.verificarTwoFactor(new TwoFactorVerifyRequest(challengeToken, wrongCode), request6)
        );
    }

    @Test
    @DisplayName("CENÁRIO 6: Concorrência mista (erros simultâneos com código correto) garante consistência e no máximo 1 autenticação")
    void shouldHandleMixedConcurrentRequestsConsistently() throws Exception {
        String correctCode = "123123";
        String wrongCode = "999999";
        String challengeToken = UUID.randomUUID().toString();

        TwoFactorChallenge challenge = new TwoFactorChallenge(
                testUser,
                challengeToken,
                passwordEncoder.encode(correctCode),
                OffsetDateTime.now().plusMinutes(5),
                false
        );
        final Long challengeId = twoFactorChallengeRepository.save(challenge).getId();

        int threadsCount = 4;
        ExecutorService executor = Executors.newFixedThreadPool(threadsCount);
        CountDownLatch readyLatch = new CountDownLatch(threadsCount);
        CountDownLatch startLatch = new CountDownLatch(1);

        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger failureCount = new AtomicInteger(0);

        // 3 com código incorreto, 1 com código correto
        for (int i = 0; i < threadsCount; i++) {
            final String codeToUse = (i == 0) ? correctCode : wrongCode;
            executor.submit(() -> {
                readyLatch.countDown();
                try {
                    startLatch.await();
                    MockHttpServletRequest request = new MockHttpServletRequest();
                    request.setRemoteAddr("127.0.0.1");

                    TwoFactorVerifyRequest verifyRequest = new TwoFactorVerifyRequest(challengeToken, codeToUse);
                    authService.verificarTwoFactor(verifyRequest, request);
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

        // No máximo 1 sucesso sob qualquer ordem de execução
        assertTrue(successCount.get() <= 1, "Nunca pode haver mais de uma autenticação bem-sucedida.");
        assertEquals(threadsCount, successCount.get() + failureCount.get(), "Todas as threads devem concluir.");

        TwoFactorChallenge updatedChallenge = twoFactorChallengeRepository.findById(challengeId).orElseThrow();
        assertTrue(updatedChallenge.getTentativas() <= 5, "As tentativas nunca devem ultrapassar 5.");
    }

    @Test
    @DisplayName("CENÁRIO 7: Tentativa subsequente após desafio utilizado deve ser rejeitada com HTTP 401 e sem nova sessão")
    void shouldRejectSubsequentAttemptsAfterChallengeIsUsed() {
        String correctCode = "456789";
        String challengeToken = UUID.randomUUID().toString();

        TwoFactorChallenge challenge = new TwoFactorChallenge(
                testUser,
                challengeToken,
                passwordEncoder.encode(correctCode),
                OffsetDateTime.now().plusMinutes(5),
                false
        );
        twoFactorChallengeRepository.save(challenge);

        MockHttpServletRequest request = new MockHttpServletRequest();
        TwoFactorVerifyRequest verifyRequest = new TwoFactorVerifyRequest(challengeToken, correctCode);

        // 1ª vez: sucesso
        LoginResult result = authService.verificarTwoFactor(verifyRequest, request);
        assertNotNull(result.accessToken());

        // 2ª vez: rejeitada
        BadCredentialsException ex = assertThrows(BadCredentialsException.class, () ->
                authService.verificarTwoFactor(verifyRequest, request)
        );
        assertTrue(ex.getMessage().contains("Desafio inválido ou expirado"));
    }

    @Test
    @DisplayName("CENÁRIO 8 (VULN-02): Duas requisições simultâneas de resend com o mesmo challengeToken devem resultar em exatamente 1 reenvio e 1 rejeição")
    void shouldPreventDuplicateResendWhenConcurrentRequestsArriveWithSameToken() throws Exception {
        String code = "112233";
        String challengeToken = UUID.randomUUID().toString();
        TwoFactorChallenge challenge = new TwoFactorChallenge(
                testUser,
                challengeToken,
                passwordEncoder.encode(code),
                OffsetDateTime.now().plusMinutes(5),
                true
        );
        challenge.setDataCriacao(OffsetDateTime.now().minusSeconds(40)); // Fora do cooldown de 30s
        final Long challengeId = twoFactorChallengeRepository.save(challenge).getId();

        int threadsCount = 2;
        ExecutorService executor = Executors.newFixedThreadPool(threadsCount);
        CountDownLatch readyLatch = new CountDownLatch(threadsCount);
        CountDownLatch startLatch = new CountDownLatch(1);

        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger failureCount = new AtomicInteger(0);
        List<Throwable> exceptions = Collections.synchronizedList(new ArrayList<>());
        List<LoginChallengeResponse> results = Collections.synchronizedList(new ArrayList<>());

        for (int i = 0; i < threadsCount; i++) {
            executor.submit(() -> {
                readyLatch.countDown();
                try {
                    startLatch.await(); // Disparo sincronizado
                    MockHttpServletRequest request = new MockHttpServletRequest();
                    request.setRemoteAddr("127.0.0.1");

                    TwoFactorResendRequest resendRequest = new TwoFactorResendRequest(challengeToken);
                    LoginChallengeResponse resendResponse = authService.reenviarTwoFactor(resendRequest, request);
                    results.add(resendResponse);
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

        // Validação estrita do resultado concorrente
        assertEquals(1, successCount.get(), "Exatamente uma requisição de reenvio deve ter sucesso.");
        assertEquals(1, failureCount.get(), "A segunda requisição concorrente de reenvio deve ser rejeitada.");

        Throwable rejectedException = exceptions.get(0);
        assertTrue(rejectedException instanceof BadCredentialsException, "A falha concorrente deve ser BadCredentialsException.");
        assertTrue(rejectedException.getMessage().contains("Desafio inválido ou expirado"),
                "A mensagem deve indicar desafio inválido ou expirado.");

        // Validação do estado no banco de dados
        TwoFactorChallenge updatedOldChallenge = twoFactorChallengeRepository.findById(challengeId).orElseThrow();
        assertTrue(updatedOldChallenge.getRevogado(), "O desafio original deve estar marcado como revogado.");

        // Validação de que o novo token gerado é válido e diferente do antigo
        LoginChallengeResponse singleResend = results.get(0);
        assertNotNull(singleResend.challengeToken());
        assertNotEquals(challengeToken, singleResend.challengeToken());
    }

    @Test
    @DisplayName("VULN-03 Integração: Login com usuário inexistente executa BCrypt real no banco e rejeita com 401")
    void shouldExecuteRealBCryptAndRejectNonExistentUserWithoutError() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("10.0.0.1");

        LoginRequest loginRequest = new LoginRequest("usuario.inexistente.timing@oficina.com", "Senha123!");

        BadCredentialsException ex = assertThrows(BadCredentialsException.class, () ->
                authService.login(loginRequest, request)
        );
        assertEquals("Credenciais inválidas.", ex.getMessage());
    }
}
