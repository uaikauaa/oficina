package com.oficinagestao.service;

import com.oficinagestao.dto.*;
import com.oficinagestao.entity.*;
import com.oficinagestao.repository.*;
import com.oficinagestao.security.JwtService;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.crypto.password.PasswordEncoder;
import com.oficinagestao.exception.BusinessException;

import java.time.OffsetDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

import com.oficinagestao.security.LoginAttemptService;
import com.oficinagestao.security.TokenHashUtil;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtService jwtService;

    @Mock
    private AuditoriaService auditoriaService;

    @Mock
    private RefreshTokenRepository refreshTokenRepository;

    @Mock
    private TwoFactorChallengeRepository twoFactorChallengeRepository;

    @Mock
    private EmailService emailService;

    @Mock
    private HttpServletRequest httpRequest;

    private LoginAttemptService loginAttemptService;
    private AuthService authService;

    private static final long REFRESH_EXPIRATION_MS = 604800000L; // 7 dias (persistente)
    private static final long REFRESH_EXPIRATION_TEMP_MS = 86400000L; // 24 horas (temporária)

    @BeforeEach
    void setUp() {
        loginAttemptService = new LoginAttemptService(5, 15);
        authService = new AuthService(
                usuarioRepository,
                passwordEncoder,
                jwtService,
                auditoriaService,
                refreshTokenRepository,
                twoFactorChallengeRepository,
                emailService,
                loginAttemptService,
                REFRESH_EXPIRATION_MS,
                REFRESH_EXPIRATION_TEMP_MS
        );
    }

    @Test
    @DisplayName("1 & 17. Deve validar credenciais no login e gerar desafio 2FA SEM emitir tokens antes da conclusão")
    void shouldLoginSuccessfullyWithValidCredentials() {
        Usuario usuario = new Usuario("Proprietária", "admin@oficina.com", "hash_senha", true);
        usuario.setId(1L);
        usuario.addRole(new Role("ROLE_ADMIN", "Admin"));

        when(usuarioRepository.findByEmail("admin@oficina.com")).thenReturn(Optional.of(usuario));
        when(passwordEncoder.matches("SenhaCorreta123", "hash_senha")).thenReturn(true);
        when(passwordEncoder.encode(anyString())).thenReturn("hashed_2fa_code");

        LoginRequest request = new LoginRequest("admin@oficina.com", "SenhaCorreta123", true);
        LoginChallengeResponse response = authService.login(request, httpRequest);

        assertNotNull(response);
        assertTrue(response.twoFactorRequired());
        assertNotNull(response.challengeToken());
        assertEquals("Se as credenciais forem válidas, um código de verificação foi enviado.", response.mensagem());

        // Desafio 2FA persistido com código hasheado e expiração de 5 minutos
        org.mockito.ArgumentCaptor<TwoFactorChallenge> challengeCaptor = org.mockito.ArgumentCaptor.forClass(TwoFactorChallenge.class);
        verify(twoFactorChallengeRepository).save(challengeCaptor.capture());
        TwoFactorChallenge savedChallenge = challengeCaptor.getValue();
        assertEquals("hashed_2fa_code", savedChallenge.getCodigoHash());
        assertTrue(savedChallenge.getRememberMe());
        assertEquals(0, savedChallenge.getTentativas());
        assertFalse(savedChallenge.getUtilizado());
        assertFalse(savedChallenge.getRevogado());
        assertTrue(savedChallenge.getDataExpiracao().isAfter(OffsetDateTime.now().plusMinutes(4)));
        assertTrue(savedChallenge.getDataExpiracao().isBefore(OffsetDateTime.now().plusMinutes(6)));

        // Código enviado por e-mail e evento auditado
        verify(emailService, times(1)).sendTwoFactorCode(eq("admin@oficina.com"), anyString());
        verify(auditoriaService, times(1)).registrarComRequest(eq(1L), eq("TwoFactorChallenge"), any(), eq("2FA_REQUESTED"), eq(httpRequest));

        // REGRA CRÍTICA: Nenhum token JWT ou refresh token é emitido no login antes do 2FA
        verify(refreshTokenRepository, never()).save(any(RefreshToken.class));
        verify(jwtService, never()).generateToken(any());
    }

    @Test
    @DisplayName("3 & 13. Deve validar código 2FA correto, autenticar e emitir sessão persistente quando rememberMe=true")
    void shouldCreatePersistentSessionWhenRememberMeIsTrue() {
        Usuario usuario = new Usuario("Proprietária", "admin@oficina.com", "hash_senha", true);
        usuario.setId(1L);
        usuario.addRole(new Role("ROLE_ADMIN", "Admin"));

        TwoFactorChallenge challenge = new TwoFactorChallenge(
                usuario,
                "challenge-uuid-persist",
                "hashed_2fa_code",
                OffsetDateTime.now().plusMinutes(5),
                true
        );
        challenge.setId(100L);

        when(twoFactorChallengeRepository.findByChallengeToken("challenge-uuid-persist")).thenReturn(Optional.of(challenge));
        when(passwordEncoder.matches("123456", "hashed_2fa_code")).thenReturn(true);
        when(jwtService.generateToken(usuario)).thenReturn("mock.jwt.token");
        when(jwtService.getExpirationMs()).thenReturn(900000L);

        org.mockito.ArgumentCaptor<RefreshToken> tokenCaptor = org.mockito.ArgumentCaptor.forClass(RefreshToken.class);

        TwoFactorVerifyRequest request = new TwoFactorVerifyRequest("challenge-uuid-persist", "123456");
        LoginResult result = authService.verificarTwoFactor(request, httpRequest);

        assertNotNull(result);
        assertEquals("mock.jwt.token", result.accessToken());
        assertTrue(result.rememberMe());
        assertEquals(REFRESH_EXPIRATION_MS / 1000, result.refreshExpiresIn());
        assertEquals("admin@oficina.com", result.user().email());

        // Desafio foi marcado como utilizado
        assertTrue(challenge.getUtilizado());
        verify(twoFactorChallengeRepository, times(1)).save(challenge);

        // Refresh token persistente salvo
        verify(refreshTokenRepository).save(tokenCaptor.capture());
        RefreshToken savedToken = tokenCaptor.getValue();
        assertTrue(savedToken.isRememberMe());
        assertTrue(savedToken.getDataExpiracao().isAfter(OffsetDateTime.now().plusDays(6)));

        verify(auditoriaService, times(1)).registrarComRequest(eq(1L), eq("TwoFactorChallenge"), eq("100"), eq("2FA_VALIDATED"), eq(httpRequest));
        verify(auditoriaService, times(1)).registrarComRequest(eq(1L), eq("Usuario"), eq("1"), eq("LOGIN"), eq(httpRequest));
    }

    @Test
    @DisplayName("14. Deve validar código 2FA correto e emitir sessão temporária (24h) quando rememberMe=false")
    void shouldCreateTemporarySessionWhenRememberMeIsFalse() {
        Usuario usuario = new Usuario("Proprietária", "admin@oficina.com", "hash_senha", true);
        usuario.setId(1L);
        usuario.addRole(new Role("ROLE_ADMIN", "Admin"));

        TwoFactorChallenge challenge = new TwoFactorChallenge(
                usuario,
                "challenge-uuid-temp",
                "hashed_2fa_code",
                OffsetDateTime.now().plusMinutes(5),
                false
        );
        challenge.setId(101L);

        when(twoFactorChallengeRepository.findByChallengeToken("challenge-uuid-temp")).thenReturn(Optional.of(challenge));
        when(passwordEncoder.matches("654321", "hashed_2fa_code")).thenReturn(true);
        when(jwtService.generateToken(usuario)).thenReturn("mock.jwt.token");
        when(jwtService.getExpirationMs()).thenReturn(900000L);

        org.mockito.ArgumentCaptor<RefreshToken> tokenCaptor = org.mockito.ArgumentCaptor.forClass(RefreshToken.class);

        TwoFactorVerifyRequest request = new TwoFactorVerifyRequest("challenge-uuid-temp", "654321");
        LoginResult result = authService.verificarTwoFactor(request, httpRequest);

        assertNotNull(result);
        assertFalse(result.rememberMe());
        assertEquals(REFRESH_EXPIRATION_TEMP_MS / 1000, result.refreshExpiresIn());

        verify(refreshTokenRepository).save(tokenCaptor.capture());
        RefreshToken savedToken = tokenCaptor.getValue();
        assertFalse(savedToken.isRememberMe());
        assertTrue(savedToken.getDataExpiracao().isBefore(OffsetDateTime.now().plusHours(25)));
    }

    @Test
    @DisplayName("Deve tratar rememberMe nulo como false ao gerar o desafio 2FA")
    void shouldDefaultToTemporarySessionWhenRememberMeIsNull() {
        Usuario usuario = new Usuario("Proprietária", "admin@oficina.com", "hash_senha", true);
        usuario.setId(1L);

        when(usuarioRepository.findByEmail("admin@oficina.com")).thenReturn(Optional.of(usuario));
        when(passwordEncoder.matches("SenhaCorreta123", "hash_senha")).thenReturn(true);
        when(passwordEncoder.encode(anyString())).thenReturn("hashed_2fa_code");

        org.mockito.ArgumentCaptor<TwoFactorChallenge> captor = org.mockito.ArgumentCaptor.forClass(TwoFactorChallenge.class);

        LoginRequest request = new LoginRequest("admin@oficina.com", "SenhaCorreta123", null);
        LoginChallengeResponse response = authService.login(request, httpRequest);

        verify(twoFactorChallengeRepository).save(captor.capture());
        assertFalse(captor.getValue().getRememberMe());
        assertTrue(response.twoFactorRequired());
    }

    @Test
    @DisplayName("4. Código incorreto é rejeitado, incrementa tentativas e audita 2FA_INVALID_CODE")
    void shouldRejectInvalidTwoFactorCodeAndIncrementAttempts() {
        Usuario usuario = new Usuario("Proprietária", "admin@oficina.com", "hash_senha", true);
        usuario.setId(1L);

        TwoFactorChallenge challenge = new TwoFactorChallenge(
                usuario,
                "challenge-uuid-wrong",
                "hashed_2fa_code",
                OffsetDateTime.now().plusMinutes(5),
                false
        );
        challenge.setId(102L);

        when(twoFactorChallengeRepository.findByChallengeToken("challenge-uuid-wrong")).thenReturn(Optional.of(challenge));
        when(passwordEncoder.matches("000000", "hashed_2fa_code")).thenReturn(false);

        TwoFactorVerifyRequest request = new TwoFactorVerifyRequest("challenge-uuid-wrong", "000000");
        BadCredentialsException ex = assertThrows(BadCredentialsException.class, () ->
                authService.verificarTwoFactor(request, httpRequest)
        );

        assertTrue(ex.getMessage().contains("Código de verificação incorreto"));
        assertEquals(1, challenge.getTentativas());
        assertFalse(challenge.getUtilizado());
        assertFalse(challenge.getRevogado());

        verify(auditoriaService, times(1)).registrarComRequest(eq(1L), eq("TwoFactorChallenge"), eq("102"), eq("2FA_INVALID_CODE"), eq(httpRequest));
        verify(refreshTokenRepository, never()).save(any());
        verify(jwtService, never()).generateToken(any());
    }

    @Test
    @DisplayName("8 & 9. 5 tentativas incorretas invalidam o desafio e a 6ª tentativa não funciona")
    void shouldLockoutAndRevokeChallengeAfter5FailedAttempts() {
        Usuario usuario = new Usuario("Proprietária", "admin@oficina.com", "hash_senha", true);
        usuario.setId(1L);

        TwoFactorChallenge challenge = new TwoFactorChallenge(
                usuario,
                "challenge-uuid-lockout",
                "hashed_2fa_code",
                OffsetDateTime.now().plusMinutes(5),
                false
        );
        challenge.setId(103L);
        challenge.setTentativas(4); // 4 tentativas anteriores

        when(twoFactorChallengeRepository.findByChallengeToken("challenge-uuid-lockout")).thenReturn(Optional.of(challenge));
        when(passwordEncoder.matches("000000", "hashed_2fa_code")).thenReturn(false);

        TwoFactorVerifyRequest request = new TwoFactorVerifyRequest("challenge-uuid-lockout", "000000");

        // 5ª tentativa incorreta
        BadCredentialsException ex5 = assertThrows(BadCredentialsException.class, () ->
                authService.verificarTwoFactor(request, httpRequest)
        );
        assertTrue(ex5.getMessage().contains("Limite de tentativas excedido"));
        assertEquals(5, challenge.getTentativas());
        assertTrue(challenge.getRevogado());
        verify(auditoriaService, times(1)).registrarComRequest(eq(1L), eq("TwoFactorChallenge"), eq("103"), eq("2FA_MAX_ATTEMPTS"), eq(httpRequest));

        // 6ª tentativa deve ser rejeitada imediatamente
        BadCredentialsException ex6 = assertThrows(BadCredentialsException.class, () ->
                authService.verificarTwoFactor(request, httpRequest)
        );
        assertTrue(ex6.getMessage().contains("Desafio inválido ou expirado"));
    }

    @Test
    @DisplayName("5. Código pode ser usado somente uma vez (tentativa de reuso é rejeitada)")
    void shouldRejectAlreadyUsedTwoFactorCode() {
        Usuario usuario = new Usuario("Proprietária", "admin@oficina.com", "hash_senha", true);
        usuario.setId(1L);

        TwoFactorChallenge challenge = new TwoFactorChallenge(
                usuario,
                "challenge-uuid-used",
                "hashed_2fa_code",
                OffsetDateTime.now().plusMinutes(5),
                false
        );
        challenge.setUtilizado(true);

        when(twoFactorChallengeRepository.findByChallengeToken("challenge-uuid-used")).thenReturn(Optional.of(challenge));

        TwoFactorVerifyRequest request = new TwoFactorVerifyRequest("challenge-uuid-used", "123456");
        BadCredentialsException ex = assertThrows(BadCredentialsException.class, () ->
                authService.verificarTwoFactor(request, httpRequest)
        );
        assertTrue(ex.getMessage().contains("Desafio inválido ou expirado"));
    }

    @Test
    @DisplayName("6 & 7. Código expira após 5 minutos e código expirado é rejeitado")
    void shouldRejectExpiredTwoFactorCode() {
        Usuario usuario = new Usuario("Proprietária", "admin@oficina.com", "hash_senha", true);
        usuario.setId(1L);

        TwoFactorChallenge challenge = new TwoFactorChallenge(
                usuario,
                "challenge-uuid-expired",
                "hashed_2fa_code",
                OffsetDateTime.now().minusSeconds(10), // Expirado
                false
        );
        challenge.setId(104L);

        when(twoFactorChallengeRepository.findByChallengeToken("challenge-uuid-expired")).thenReturn(Optional.of(challenge));

        TwoFactorVerifyRequest request = new TwoFactorVerifyRequest("challenge-uuid-expired", "123456");
        BadCredentialsException ex = assertThrows(BadCredentialsException.class, () ->
                authService.verificarTwoFactor(request, httpRequest)
        );

        assertTrue(ex.getMessage().contains("Código de verificação expirado"));
        assertTrue(challenge.getRevogado());
        verify(auditoriaService, times(1)).registrarComRequest(eq(1L), eq("TwoFactorChallenge"), eq("104"), eq("2FA_EXPIRED"), eq(httpRequest));
    }

    @Test
    @DisplayName("10, 11 & 12. Reenvio invalida código anterior, cria novo código com novo prazo e código antigo não funciona")
    void shouldResendTwoFactorCodeSuccessfullyAndInvalidateOldCode() {
        Usuario usuario = new Usuario("Proprietária", "admin@oficina.com", "hash_senha", true);
        usuario.setId(1L);

        // Desafio antigo criado há 40 segundos (> 30s cooldown)
        TwoFactorChallenge oldChallenge = new TwoFactorChallenge(
                usuario,
                "old-challenge-token",
                "old_hashed_code",
                OffsetDateTime.now().plusMinutes(4),
                true
        );
        oldChallenge.setId(105L);
        oldChallenge.setDataCriacao(OffsetDateTime.now().minusSeconds(40));

        when(twoFactorChallengeRepository.findByChallengeToken("old-challenge-token")).thenReturn(Optional.of(oldChallenge));
        when(passwordEncoder.encode(anyString())).thenReturn("new_hashed_code");

        TwoFactorResendRequest resendRequest = new TwoFactorResendRequest("old-challenge-token");
        LoginChallengeResponse resendResponse = authService.reenviarTwoFactor(resendRequest, httpRequest);

        assertNotNull(resendResponse);
        assertTrue(resendResponse.twoFactorRequired());
        assertNotEquals("old-challenge-token", resendResponse.challengeToken());

        // Desafio antigo foi revogado
        assertTrue(oldChallenge.getRevogado());

        // Novo desafio salvo com 5 minutos de validade e 0 tentativas
        org.mockito.ArgumentCaptor<TwoFactorChallenge> captor = org.mockito.ArgumentCaptor.forClass(TwoFactorChallenge.class);
        verify(twoFactorChallengeRepository, times(2)).save(captor.capture());
        TwoFactorChallenge newChallenge = captor.getAllValues().get(1);
        assertEquals("new_hashed_code", newChallenge.getCodigoHash());
        assertEquals(0, newChallenge.getTentativas());
        assertFalse(newChallenge.getRevogado());
        assertFalse(newChallenge.getUtilizado());
        assertTrue(newChallenge.getDataExpiracao().isAfter(OffsetDateTime.now().plusMinutes(4)));

        // Novo código enviado e auditoria registrada
        verify(emailService, times(1)).sendTwoFactorCode(eq("admin@oficina.com"), anyString());
        verify(auditoriaService, times(1)).registrarComRequest(eq(1L), eq("TwoFactorChallenge"), any(), eq("2FA_RESENT"), eq(httpRequest));
    }

    @Test
    @DisplayName("Deve bloquear reenvio durante o cooldown de 30 segundos")
    void shouldBlockResendDuringCooldown() {
        Usuario usuario = new Usuario("Proprietária", "admin@oficina.com", "hash_senha", true);
        usuario.setId(1L);

        TwoFactorChallenge challenge = new TwoFactorChallenge(
                usuario,
                "challenge-recent",
                "hashed_code",
                OffsetDateTime.now().plusMinutes(5),
                false
        );
        challenge.setDataCriacao(OffsetDateTime.now().minusSeconds(5)); // Criado há 5 segundos

        when(twoFactorChallengeRepository.findByChallengeToken("challenge-recent")).thenReturn(Optional.of(challenge));

        TwoFactorResendRequest resendRequest = new TwoFactorResendRequest("challenge-recent");
        BusinessException ex = assertThrows(BusinessException.class, () ->
                authService.reenviarTwoFactor(resendRequest, httpRequest)
        );
        assertTrue(ex.getMessage().contains("Aguarde alguns instantes"));
        verify(twoFactorChallengeRepository, never()).save(any(TwoFactorChallenge.class));
        verify(emailService, never()).sendTwoFactorCode(anyString(), anyString());
    }

    @Test
    @DisplayName("VULN-02 Teste 1: Reenvio com desafio revogado deve ser rejeitado sem novo desafio, código ou e-mail")
    void shouldRejectResendWhenChallengeIsRevoked() {
        Usuario usuario = new Usuario("Proprietária", "admin@oficina.com", "hash_senha", true);
        usuario.setId(1L);

        TwoFactorChallenge challenge = new TwoFactorChallenge(
                usuario,
                "revoked-token",
                "hashed_code",
                OffsetDateTime.now().plusMinutes(4),
                true
        );
        challenge.setDataCriacao(OffsetDateTime.now().minusSeconds(40));
        challenge.revoke();

        when(twoFactorChallengeRepository.findByChallengeToken("revoked-token")).thenReturn(Optional.of(challenge));

        TwoFactorResendRequest request = new TwoFactorResendRequest("revoked-token");
        BadCredentialsException ex = assertThrows(BadCredentialsException.class, () ->
                authService.reenviarTwoFactor(request, httpRequest)
        );
        assertEquals("Desafio inválido ou expirado.", ex.getMessage());

        verify(twoFactorChallengeRepository, never()).save(any(TwoFactorChallenge.class));
        verify(emailService, never()).sendTwoFactorCode(anyString(), anyString());
        verify(passwordEncoder, never()).encode(anyString());
        verify(auditoriaService, never()).registrarComRequest(any(), any(), any(), eq("2FA_RESENT"), any());
    }

    @Test
    @DisplayName("VULN-02 Teste 2: Reenvio com desafio expirado deve ser rejeitado sem novo desafio, código ou e-mail")
    void shouldRejectResendWhenChallengeIsExpired() {
        Usuario usuario = new Usuario("Proprietária", "admin@oficina.com", "hash_senha", true);
        usuario.setId(1L);

        TwoFactorChallenge challenge = new TwoFactorChallenge(
                usuario,
                "expired-token",
                "hashed_code",
                OffsetDateTime.now().minusSeconds(10),
                true
        );
        challenge.setDataCriacao(OffsetDateTime.now().minusMinutes(6));

        when(twoFactorChallengeRepository.findByChallengeToken("expired-token")).thenReturn(Optional.of(challenge));

        TwoFactorResendRequest request = new TwoFactorResendRequest("expired-token");
        BadCredentialsException ex = assertThrows(BadCredentialsException.class, () ->
                authService.reenviarTwoFactor(request, httpRequest)
        );
        assertEquals("Desafio inválido ou expirado.", ex.getMessage());

        verify(twoFactorChallengeRepository, never()).save(any(TwoFactorChallenge.class));
        verify(emailService, never()).sendTwoFactorCode(anyString(), anyString());
        verify(passwordEncoder, never()).encode(anyString());
        verify(auditoriaService, never()).registrarComRequest(any(), any(), any(), eq("2FA_RESENT"), any());
    }

    @Test
    @DisplayName("VULN-02 Teste 3: Reenvio com desafio utilizado deve ser rejeitado sem novo desafio")
    void shouldRejectResendWhenChallengeIsUsed() {
        Usuario usuario = new Usuario("Proprietária", "admin@oficina.com", "hash_senha", true);
        usuario.setId(1L);

        TwoFactorChallenge challenge = new TwoFactorChallenge(
                usuario,
                "used-token",
                "hashed_code",
                OffsetDateTime.now().plusMinutes(4),
                true
        );
        challenge.setDataCriacao(OffsetDateTime.now().minusSeconds(40));
        challenge.setUtilizado(true);

        when(twoFactorChallengeRepository.findByChallengeToken("used-token")).thenReturn(Optional.of(challenge));

        TwoFactorResendRequest request = new TwoFactorResendRequest("used-token");
        BadCredentialsException ex = assertThrows(BadCredentialsException.class, () ->
                authService.reenviarTwoFactor(request, httpRequest)
        );
        assertEquals("Desafio inválido ou expirado.", ex.getMessage());

        verify(twoFactorChallengeRepository, never()).save(any(TwoFactorChallenge.class));
        verify(emailService, never()).sendTwoFactorCode(anyString(), anyString());
        verify(passwordEncoder, never()).encode(anyString());
        verify(auditoriaService, never()).registrarComRequest(any(), any(), any(), eq("2FA_RESENT"), any());
    }

    @Test
    @DisplayName("VULN-02 Teste 4: Reenvio com challengeToken inexistente deve lançar BadCredentialsException genérica")
    void shouldRejectResendWhenChallengeDoesNotExist() {
        when(twoFactorChallengeRepository.findByChallengeToken("nonexistent-token")).thenReturn(Optional.empty());

        TwoFactorResendRequest request = new TwoFactorResendRequest("nonexistent-token");
        BadCredentialsException ex = assertThrows(BadCredentialsException.class, () ->
                authService.reenviarTwoFactor(request, httpRequest)
        );
        assertEquals("Desafio inválido ou expirado.", ex.getMessage());

        verify(twoFactorChallengeRepository, never()).save(any(TwoFactorChallenge.class));
        verify(emailService, never()).sendTwoFactorCode(anyString(), anyString());
        verify(passwordEncoder, never()).encode(anyString());
        verify(auditoriaService, never()).registrarComRequest(any(), any(), any(), eq("2FA_RESENT"), any());
    }

    @Test
    @DisplayName("VULN-02 Teste 7: Cadeia de reenvios A -> resend -> B invalida token A para novos reenvios mas permite B após cooldown")
    void shouldRejectResendUsingOldTokenAfterResendSucceeded() {
        Usuario usuario = new Usuario("Proprietária", "admin@oficina.com", "hash_senha", true);
        usuario.setId(1L);

        // Desafio A: válido e fora do cooldown
        TwoFactorChallenge challengeA = new TwoFactorChallenge(
                usuario,
                "token-A",
                "hash_A",
                OffsetDateTime.now().plusMinutes(5),
                true
        );
        challengeA.setId(101L);
        challengeA.setDataCriacao(OffsetDateTime.now().minusSeconds(40));

        when(twoFactorChallengeRepository.findByChallengeToken("token-A")).thenAnswer(inv -> Optional.of(challengeA));
        when(passwordEncoder.encode(anyString())).thenReturn("hash_B", "hash_C");

        // 1. Resend inicial usando token-A -> Gera token-B
        LoginChallengeResponse responseB = authService.reenviarTwoFactor(new TwoFactorResendRequest("token-A"), httpRequest);
        assertNotNull(responseB);
        String tokenB = responseB.challengeToken();
        assertNotEquals("token-A", tokenB);
        assertTrue(challengeA.getRevogado());

        // 2. Tentativa de reuso de token-A após ter sido revogado -> Deve ser REJEITADO
        BadCredentialsException ex = assertThrows(BadCredentialsException.class, () ->
                authService.reenviarTwoFactor(new TwoFactorResendRequest("token-A"), httpRequest)
        );
        assertEquals("Desafio inválido ou expirado.", ex.getMessage());

        // 3. Simula Desafio B no repositório, elegível para resend após seu próprio cooldown
        TwoFactorChallenge challengeB = new TwoFactorChallenge(
                usuario,
                tokenB,
                "hash_B",
                OffsetDateTime.now().plusMinutes(5),
                true
        );
        challengeB.setId(102L);
        challengeB.setDataCriacao(OffsetDateTime.now().minusSeconds(35)); // fora do cooldown

        when(twoFactorChallengeRepository.findByChallengeToken(tokenB)).thenReturn(Optional.of(challengeB));

        // 4. Resend usando token-B -> ACEITO
        LoginChallengeResponse responseC = authService.reenviarTwoFactor(new TwoFactorResendRequest(tokenB), httpRequest);
        assertNotNull(responseC);
        assertNotEquals(tokenB, responseC.challengeToken());
        assertTrue(challengeB.getRevogado());
    }


    @Test
    @DisplayName("Deve lançar BadCredentialsException quando a senha for inválida")
    void shouldThrowBadCredentialsWhenPasswordIsInvalid() {
        Usuario usuario = new Usuario("Proprietária", "admin@oficina.com", "hash_senha", true);

        when(usuarioRepository.findByEmail("admin@oficina.com")).thenReturn(Optional.of(usuario));
        when(passwordEncoder.matches("SenhaErrada", "hash_senha")).thenReturn(false);

        LoginRequest request = new LoginRequest("admin@oficina.com", "SenhaErrada");

        assertThrows(BadCredentialsException.class, () -> authService.login(request, httpRequest));
        verify(auditoriaService, never()).registrarComRequest(any(), any(), any(), any(), any());
        verify(refreshTokenRepository, never()).save(any(RefreshToken.class));
    }

    @Test
    @DisplayName("Deve lançar BadCredentialsException quando o usuário não existir")
    void shouldThrowBadCredentialsWhenUserDoesNotExist() {
        when(usuarioRepository.findByEmail("inexistente@oficina.com")).thenReturn(Optional.empty());

        LoginRequest request = new LoginRequest("inexistente@oficina.com", "QualquerSenha");

        assertThrows(BadCredentialsException.class, () -> authService.login(request, httpRequest));
        verify(passwordEncoder, times(1)).matches(eq("QualquerSenha"), anyString());
        verify(auditoriaService, never()).registrarComRequest(any(), any(), any(), any(), any());
        verify(refreshTokenRepository, never()).save(any(RefreshToken.class));
    }

    @Test
    @DisplayName("VULN-03 Teste 1: Login com e-mail inexistente deve rejeitar com mensagem genérica, sem 2FA e sem cookies")
    void shouldRejectLoginWhenEmailDoesNotExistWithoutLeakingInfo() {
        when(usuarioRepository.findByEmail("naoexiste@oficina.com")).thenReturn(Optional.empty());

        LoginRequest request = new LoginRequest("naoexiste@oficina.com", "QualquerSenha123");

        BadCredentialsException ex = assertThrows(BadCredentialsException.class, () -> authService.login(request, httpRequest));
        assertEquals("Credenciais inválidas.", ex.getMessage());

        verify(passwordEncoder, times(1)).matches(eq("QualquerSenha123"), anyString());
        verify(twoFactorChallengeRepository, never()).save(any(TwoFactorChallenge.class));
        verify(emailService, never()).sendTwoFactorCode(anyString(), anyString());
        verify(refreshTokenRepository, never()).save(any(RefreshToken.class));
    }

    @Test
    @DisplayName("VULN-03 Teste 2: Login com e-mail existente e senha incorreta deve executar BCrypt real e rejeitar")
    void shouldRejectLoginWhenEmailExistsAndWrongPassword() {
        Usuario usuario = new Usuario("Proprietária", "admin@oficina.com", "hash_real", true);

        when(usuarioRepository.findByEmail("admin@oficina.com")).thenReturn(Optional.of(usuario));
        when(passwordEncoder.matches("SenhaIncorreta", "hash_real")).thenReturn(false);

        LoginRequest request = new LoginRequest("admin@oficina.com", "SenhaIncorreta");

        BadCredentialsException ex = assertThrows(BadCredentialsException.class, () -> authService.login(request, httpRequest));
        assertEquals("Credenciais inválidas.", ex.getMessage());

        verify(passwordEncoder, times(1)).matches("SenhaIncorreta", "hash_real");
        verify(twoFactorChallengeRepository, never()).save(any(TwoFactorChallenge.class));
        verify(emailService, never()).sendTwoFactorCode(anyString(), anyString());
    }

    @Test
    @DisplayName("VULN-03 Teste 3: Login com e-mail existente e senha correta deve iniciar 2FA sem emitir tokens de sessão")
    void shouldStartTwoFactorWhenCredentialsAreValid() {
        Usuario usuario = new Usuario("Proprietária", "admin@oficina.com", "hash_real", true);
        usuario.setId(1L);

        when(usuarioRepository.findByEmail("admin@oficina.com")).thenReturn(Optional.of(usuario));
        when(passwordEncoder.matches("SenhaCorreta123", "hash_real")).thenReturn(true);
        when(passwordEncoder.encode(anyString())).thenReturn("hash_2fa");

        LoginRequest request = new LoginRequest("admin@oficina.com", "SenhaCorreta123", true);

        LoginChallengeResponse response = authService.login(request, httpRequest);

        assertNotNull(response);
        assertTrue(response.twoFactorRequired());
        assertNotNull(response.challengeToken());
        verify(twoFactorChallengeRepository, times(1)).save(any(TwoFactorChallenge.class));
        verify(emailService, times(1)).sendTwoFactorCode(eq("admin@oficina.com"), anyString());
        verify(refreshTokenRepository, never()).save(any(RefreshToken.class));
    }

    @Test
    @DisplayName("VULN-03 Teste 4: Dummy BCrypt deve ser executado com hash válido quando usuário não existe")
    void shouldExecuteDummyBCryptWhenUserDoesNotExist() {
        when(usuarioRepository.findByEmail("inexistente_timing@oficina.com")).thenReturn(Optional.empty());

        LoginRequest request = new LoginRequest("inexistente_timing@oficina.com", "TentativaDeAtaque123");

        assertThrows(BadCredentialsException.class, () -> authService.login(request, httpRequest));

        org.mockito.ArgumentCaptor<String> hashCaptor = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(passwordEncoder, times(1)).matches(eq("TentativaDeAtaque123"), hashCaptor.capture());

        String capturedHash = hashCaptor.getValue();
        assertNotNull(capturedHash);
        assertTrue(capturedHash.startsWith("$2a$10$") || capturedHash.startsWith("$2b$10$"),
                "O hash dummy deve ser compatível com BCrypt cost 10");
        assertEquals(60, capturedHash.length(), "O hash dummy BCrypt deve ter 60 caracteres");
    }

    @Test
    @DisplayName("VULN-03 Teste 5: Respostas para usuário inexistente e senha incorreta devem ser indistinguíveis")
    void shouldEnsureIdenticalResponseBetweenNonExistentUserAndWrongPassword() {
        // Cenário A: Usuário inexistente
        when(usuarioRepository.findByEmail("inexistente_teste5@oficina.com")).thenReturn(Optional.empty());
        LoginRequest requestA = new LoginRequest("inexistente_teste5@oficina.com", "SenhaQualquer");
        BadCredentialsException exA = assertThrows(BadCredentialsException.class, () -> authService.login(requestA, httpRequest));

        // Cenário B: Usuário existente + senha incorreta
        Usuario usuario = new Usuario("Proprietária", "admin@oficina.com", "hash_real", true);
        when(usuarioRepository.findByEmail("admin@oficina.com")).thenReturn(Optional.of(usuario));
        when(passwordEncoder.matches("SenhaIncorreta", "hash_real")).thenReturn(false);
        LoginRequest requestB = new LoginRequest("admin@oficina.com", "SenhaIncorreta");
        BadCredentialsException exB = assertThrows(BadCredentialsException.class, () -> authService.login(requestB, httpRequest));

        // Comparação estrita de mensagens e tipos
        assertEquals(exA.getClass(), exB.getClass());
        assertEquals(exA.getMessage(), exB.getMessage());
        assertEquals("Credenciais inválidas.", exA.getMessage());
    }

    @Test
    @DisplayName("VULN-03 Teste 7: Rate limiting deve funcionar igualmente para e-mail existente com senha incorreta")
    void shouldEnforceRateLimitingForExistentEmailWithWrongPassword() {
        Usuario usuario = new Usuario("Proprietária", "admin_lockout@oficina.com", "hash_real", true);
        when(usuarioRepository.findByEmail("admin_lockout@oficina.com")).thenReturn(Optional.of(usuario));
        when(passwordEncoder.matches(anyString(), eq("hash_real"))).thenReturn(false);
        when(httpRequest.getRemoteAddr()).thenReturn("192.168.1.99");

        LoginRequest request = new LoginRequest("admin_lockout@oficina.com", "SenhaErrada");

        for (int i = 0; i < 5; i++) {
            assertThrows(BadCredentialsException.class, () -> authService.login(request, httpRequest));
        }

        // 6ª tentativa bloqueada por lockout
        BadCredentialsException ex = assertThrows(BadCredentialsException.class, () -> authService.login(request, httpRequest));
        assertTrue(ex.getMessage().contains("Muitas tentativas incorretas. Conta bloqueada temporariamente"));
    }

    @Test
    @DisplayName("ISSUE-005: Deve lançar BadCredentialsException uniforme quando o usuário estiver inativo no login")
    void shouldThrowBadCredentialsWhenUserIsInactive() {
        Usuario usuario = new Usuario("Proprietária", "inativa@oficina.com", "hash_senha", false);

        when(usuarioRepository.findByEmail("inativa@oficina.com")).thenReturn(Optional.of(usuario));
        when(passwordEncoder.matches("SenhaValida", "hash_senha")).thenReturn(true);

        LoginRequest request = new LoginRequest("inativa@oficina.com", "SenhaValida");

        BadCredentialsException ex = assertThrows(BadCredentialsException.class, () -> authService.login(request, httpRequest));
        assertEquals("Credenciais inválidas.", ex.getMessage());
        verify(auditoriaService, never()).registrarComRequest(any(), any(), any(), any(), any());
        verify(refreshTokenRepository, never()).save(any(RefreshToken.class));
    }

    @Test
    @DisplayName("ISSUE-003: Deve bloquear login após atingir o limite de 5 tentativas consecutivas inválidas")
    void shouldBlockLoginAfterMaxAttempts() {
        when(usuarioRepository.findByEmail("admin_brute@oficina.com")).thenReturn(Optional.empty());
        when(httpRequest.getRemoteAddr()).thenReturn("192.168.1.50");

        LoginRequest request = new LoginRequest("admin_brute@oficina.com", "SenhaErrada");

        // 5 tentativas consecutivas
        for (int i = 0; i < 5; i++) {
            assertThrows(BadCredentialsException.class, () -> authService.login(request, httpRequest));
        }

        // 6ª tentativa deve ser bloqueada por lockout
        BadCredentialsException ex = assertThrows(BadCredentialsException.class, () -> authService.login(request, httpRequest));
        assertTrue(ex.getMessage().contains("Muitas tentativas incorretas. Conta bloqueada temporariamente"));
        assertFalse(ex.getMessage().contains("minuto(s)"), "Não deve vazar a duração ou minutos restantes de bloqueio");
    }

    @Test
    @DisplayName("SEC-02: Atacante errando 5 vezes de um IP não deve provocar Account Lockout DoS para usuário legítimo em outro IP")
    void shouldPreventAccountLockoutDosForLegitimateUserFromDifferentIp() {
        Usuario usuario = new Usuario("Proprietária", "admin_vitima@oficina.com", "hash_real", true);
        usuario.setId(1L);

        when(usuarioRepository.findByEmail("admin_vitima@oficina.com")).thenReturn(Optional.of(usuario));
        when(passwordEncoder.matches("SenhaErradaAtacante", "hash_real")).thenReturn(false);
        when(passwordEncoder.matches("SenhaCorretaLegitima", "hash_real")).thenReturn(true);
        when(passwordEncoder.encode(anyString())).thenReturn("hash_2fa");

        jakarta.servlet.http.HttpServletRequest requestAtacante = org.mockito.Mockito.mock(jakarta.servlet.http.HttpServletRequest.class);
        when(requestAtacante.getRemoteAddr()).thenReturn("198.51.100.99");

        jakarta.servlet.http.HttpServletRequest requestLegitimo = org.mockito.Mockito.mock(jakarta.servlet.http.HttpServletRequest.class);
        when(requestLegitimo.getRemoteAddr()).thenReturn("203.0.113.10");

        LoginRequest loginAtacante = new LoginRequest("admin_vitima@oficina.com", "SenhaErradaAtacante");

        // Atacante gera 5 falhas consecutivas de seu IP
        for (int i = 0; i < 5; i++) {
            assertThrows(BadCredentialsException.class, () -> authService.login(loginAtacante, requestAtacante));
        }

        // 6ª tentativa do atacante é bloqueada por lockout
        BadCredentialsException exAtacante = assertThrows(BadCredentialsException.class, () -> authService.login(loginAtacante, requestAtacante));
        assertTrue(exAtacante.getMessage().contains("Muitas tentativas incorretas. Conta bloqueada temporariamente"));

        // Usuário legítimo tenta logar de seu IP com sua senha correta
        LoginRequest loginLegitimo = new LoginRequest("admin_vitima@oficina.com", "SenhaCorretaLegitima", false);
        LoginChallengeResponse responseLegitimo = authService.login(loginLegitimo, requestLegitimo);

        assertNotNull(responseLegitimo, "Usuário legítimo deve conseguir iniciar autenticação 2FA");
        assertTrue(responseLegitimo.twoFactorRequired());
    }

    @Test
    @DisplayName("Deve rotacionar o refresh token e emitir novo access token com sucesso")
    void shouldRotateRefreshTokenSuccessfully() {
        Usuario usuario = new Usuario("Proprietária", "admin@oficina.com", "hash_senha", true);
        usuario.setId(1L);
        usuario.addRole(new Role("ROLE_ADMIN", "Admin"));

        RefreshToken oldToken = new RefreshToken(usuario, TokenHashUtil.hashStatic("old-refresh-uuid"), OffsetDateTime.now().plusDays(5), true);
        oldToken.setId(10L);

        when(refreshTokenRepository.findByTokenHash(TokenHashUtil.hashStatic("old-refresh-uuid"))).thenReturn(Optional.of(oldToken));
        when(jwtService.generateToken(usuario)).thenReturn("new.jwt.token");
        when(jwtService.getExpirationMs()).thenReturn(900000L);

        LoginResult result = authService.refresh("old-refresh-uuid", httpRequest);

        assertNotNull(result);
        assertEquals("new.jwt.token", result.accessToken());
        assertNotEquals("old-refresh-uuid", result.refreshToken());
        assertTrue(oldToken.getRevogado());
        assertTrue(result.rememberMe());
        assertEquals(REFRESH_EXPIRATION_MS / 1000, result.refreshExpiresIn());

        // Deve ter salvo o antigo revogado e o novo token
        verify(refreshTokenRepository, times(2)).save(any(RefreshToken.class));
    }

    @Test
    @DisplayName("Deve preservar rememberMe=true na rotação de refresh token com expiração persistente de 7 dias")
    void shouldPreserveRememberMeTrueOnRotation() {
        Usuario usuario = new Usuario("Proprietária", "admin@oficina.com", "hash_senha", true);
        usuario.setId(1L);
        usuario.addRole(new Role("ROLE_ADMIN", "Admin"));

        RefreshToken oldToken = new RefreshToken(usuario, TokenHashUtil.hashStatic("old-persistent-uuid"), OffsetDateTime.now().plusDays(5), true);
        when(refreshTokenRepository.findByTokenHash(TokenHashUtil.hashStatic("old-persistent-uuid"))).thenReturn(Optional.of(oldToken));
        when(jwtService.generateToken(usuario)).thenReturn("jwt.persistent");
        when(jwtService.getExpirationMs()).thenReturn(900000L);

        org.mockito.ArgumentCaptor<RefreshToken> captor = org.mockito.ArgumentCaptor.forClass(RefreshToken.class);

        LoginResult result = authService.refresh("old-persistent-uuid", httpRequest);

        verify(refreshTokenRepository, times(2)).save(captor.capture());
        RefreshToken newToken = captor.getAllValues().get(1);

        assertTrue(newToken.isRememberMe());
        assertTrue(newToken.getDataExpiracao().isAfter(OffsetDateTime.now().plusDays(6)));
        assertTrue(result.rememberMe());
        assertEquals(REFRESH_EXPIRATION_MS / 1000, result.refreshExpiresIn());
        assertEquals(64, newToken.getTokenHash().length());
        assertEquals(TokenHashUtil.hashStatic(result.refreshToken()), newToken.getTokenHash());
    }

    @Test
    @DisplayName("Deve preservar rememberMe=false na rotação de refresh token com expiração temporária de 24 horas")
    void shouldPreserveRememberMeFalseOnRotation() {
        Usuario usuario = new Usuario("Proprietária", "admin@oficina.com", "hash_senha", true);
        usuario.setId(1L);
        usuario.addRole(new Role("ROLE_ADMIN", "Admin"));

        RefreshToken oldToken = new RefreshToken(usuario, TokenHashUtil.hashStatic("old-temp-uuid"), OffsetDateTime.now().plusHours(12), false);
        when(refreshTokenRepository.findByTokenHash(TokenHashUtil.hashStatic("old-temp-uuid"))).thenReturn(Optional.of(oldToken));
        when(jwtService.generateToken(usuario)).thenReturn("jwt.temp");
        when(jwtService.getExpirationMs()).thenReturn(900000L);

        org.mockito.ArgumentCaptor<RefreshToken> captor = org.mockito.ArgumentCaptor.forClass(RefreshToken.class);

        LoginResult result = authService.refresh("old-temp-uuid", httpRequest);

        verify(refreshTokenRepository, times(2)).save(captor.capture());
        RefreshToken newToken = captor.getAllValues().get(1);

        assertFalse(newToken.isRememberMe());
        assertTrue(newToken.getDataExpiracao().isBefore(OffsetDateTime.now().plusHours(25)));
        assertFalse(result.rememberMe());
        assertEquals(REFRESH_EXPIRATION_TEMP_MS / 1000, result.refreshExpiresIn());
        assertEquals(64, newToken.getTokenHash().length());
        assertEquals(TokenHashUtil.hashStatic(result.refreshToken()), newToken.getTokenHash());
    }

    @Test
    @DisplayName("Deve lançar BadCredentialsException quando o refresh token não for encontrado")
    void shouldThrowWhenRefreshTokenNotFound() {
        when(refreshTokenRepository.findByTokenHash(TokenHashUtil.hashStatic("token-inexistente"))).thenReturn(Optional.empty());

        assertThrows(BadCredentialsException.class, () -> authService.refresh("token-inexistente", httpRequest));
    }

    @Test
    @DisplayName("Deve lançar BadCredentialsException quando o refresh token for nulo ou em branco")
    void shouldThrowWhenRefreshTokenIsBlank() {
        assertThrows(BadCredentialsException.class, () -> authService.refresh("   ", httpRequest));
        assertThrows(BadCredentialsException.class, () -> authService.refresh(null, httpRequest));
    }

    @Test
    @DisplayName("RISK-005: Deve revogar todos os tokens do usuário (família de tokens) e lançar BadCredentialsException ao tentar reutilizar token revogado")
    void shouldThrowAndRevokeAllTokensWhenRefreshTokenIsRevoked() {
        Usuario usuario = new Usuario("Proprietária", "admin@oficina.com", "hash_senha", true);
        usuario.setId(1L);
        RefreshToken revokedToken = new RefreshToken(usuario, TokenHashUtil.hashStatic("revoked-token"), OffsetDateTime.now().plusDays(2));
        revokedToken.revoke();

        when(refreshTokenRepository.findByTokenHash(TokenHashUtil.hashStatic("revoked-token"))).thenReturn(Optional.of(revokedToken));

        assertThrows(BadCredentialsException.class, () -> authService.refresh("revoked-token", httpRequest));
        verify(refreshTokenRepository, times(1)).revokeAllByUsuarioId(1L);
    }

    @Test
    @DisplayName("Deve lançar BadCredentialsException quando o refresh token estiver expirado")
    void shouldThrowWhenRefreshTokenIsExpired() {
        Usuario usuario = new Usuario("Proprietária", "admin@oficina.com", "hash_senha", true);
        RefreshToken expiredToken = new RefreshToken(usuario, TokenHashUtil.hashStatic("expired-token"), OffsetDateTime.now().minusDays(1));

        when(refreshTokenRepository.findByTokenHash(TokenHashUtil.hashStatic("expired-token"))).thenReturn(Optional.of(expiredToken));

        assertThrows(BadCredentialsException.class, () -> authService.refresh("expired-token", httpRequest));
    }

    @Test
    @DisplayName("Deve lançar DisabledException quando o usuário do refresh token estiver inativo")
    void shouldThrowWhenUserIsInactiveOnRefresh() {
        Usuario usuario = new Usuario("Proprietária", "admin@oficina.com", "hash_senha", false);
        RefreshToken token = new RefreshToken(usuario, TokenHashUtil.hashStatic("valid-token"), OffsetDateTime.now().plusDays(2));

        when(refreshTokenRepository.findByTokenHash(TokenHashUtil.hashStatic("valid-token"))).thenReturn(Optional.of(token));

        assertThrows(DisabledException.class, () -> authService.refresh("valid-token", httpRequest));
    }

    @Test
    @DisplayName("Deve revogar o refresh token e registrar auditoria no logout")
    void shouldRevokeRefreshTokenAndAuditLogout() {
        Usuario usuario = new Usuario("Proprietária", "admin@oficina.com", "hash_senha", true);
        usuario.setId(1L);

        RefreshToken token = new RefreshToken(usuario, TokenHashUtil.hashStatic("refresh-to-revoke"), OffsetDateTime.now().plusDays(3));

        when(refreshTokenRepository.findByTokenHash(TokenHashUtil.hashStatic("refresh-to-revoke"))).thenReturn(Optional.of(token));
        when(usuarioRepository.findByEmail("admin@oficina.com")).thenReturn(Optional.of(usuario));

        authService.logout("admin@oficina.com", "refresh-to-revoke", httpRequest);

        assertTrue(token.getRevogado());
        assertEquals(1, usuario.getTokenVersion());
        verify(usuarioRepository, times(1)).save(usuario);
        verify(refreshTokenRepository, times(1)).save(token);
        verify(auditoriaService, times(1)).registrarComRequest(eq(1L), eq("Usuario"), eq("1"), eq("LOGOUT"), eq(httpRequest));
    }

    @Test
    @DisplayName("Deve retornar os dados da usuária autenticada no getCurrentUser")
    void shouldReturnCurrentUser() {
        Usuario usuario = new Usuario("Proprietária", "admin@oficina.com", "hash_senha", true);
        usuario.setId(1L);
        usuario.addRole(new Role("ROLE_ADMIN", "Admin"));

        when(usuarioRepository.findByEmail("admin@oficina.com")).thenReturn(Optional.of(usuario));

        CurrentUserResponse response = authService.getCurrentUser("admin@oficina.com");

        assertNotNull(response);
        assertEquals("Proprietária", response.nome());
        assertEquals("admin@oficina.com", response.email());
        assertTrue(response.roles().contains("ROLE_ADMIN"));
    }

    @Test
    @DisplayName("ISSUE-08: Deve expurgar refresh tokens expirados ou revogados com sucesso")
    void shouldPurgeExpiredOrRevokedRefreshTokens() {
        when(refreshTokenRepository.deleteExpiredOrRevoked(any(OffsetDateTime.class))).thenReturn(42);

        int deletados = authService.purgarTokensExpiradosOuRevogados();

        assertEquals(42, deletados);
        verify(refreshTokenRepository, times(1)).deleteExpiredOrRevoked(any(OffsetDateTime.class));
    }

    @Test
    @DisplayName("Deve alterar a senha com sucesso, salvar hash BCrypt e revogar refresh tokens ativos")
    void shouldChangePasswordSuccessfully() {
        Usuario usuario = new Usuario("Proprietária", "admin@oficina.com", "hash_antigo", true);
        usuario.setId(1L);

        when(usuarioRepository.findByEmail("admin@oficina.com")).thenReturn(Optional.of(usuario));
        when(passwordEncoder.matches("SenhaAtual@123", "hash_antigo")).thenReturn(true);
        when(passwordEncoder.matches("NovaSenhaSegura#2026", "hash_antigo")).thenReturn(false);
        when(passwordEncoder.encode("NovaSenhaSegura#2026")).thenReturn("hash_novo_bcrypt");

        AlterarSenhaRequest request = new AlterarSenhaRequest("SenhaAtual@123", "NovaSenhaSegura#2026", "NovaSenhaSegura#2026");

        authService.alterarSenha("admin@oficina.com", request, httpRequest);

        assertEquals("hash_novo_bcrypt", usuario.getSenha());
        assertEquals(1, usuario.getTokenVersion());
        verify(usuarioRepository, times(1)).save(usuario);
        verify(refreshTokenRepository, times(1)).revokeAllByUsuarioId(1L);
        verify(auditoriaService, times(1)).registrarComRequest(eq(1L), eq("Usuario"), eq("1"), eq("PASSWORD_CHANGE"), eq(httpRequest));
    }

    @Test
    @DisplayName("Deve rejeitar alteração quando a senha atual informada estiver incorreta")
    void shouldRejectPasswordChangeWhenCurrentPasswordIsIncorrect() {
        Usuario usuario = new Usuario("Proprietária", "admin@oficina.com", "hash_antigo", true);
        usuario.setId(1L);

        when(usuarioRepository.findByEmail("admin@oficina.com")).thenReturn(Optional.of(usuario));
        when(passwordEncoder.matches("SenhaErrada@123", "hash_antigo")).thenReturn(false);

        AlterarSenhaRequest request = new AlterarSenhaRequest("SenhaErrada@123", "NovaSenhaSegura#2026", "NovaSenhaSegura#2026");

        BusinessException ex = assertThrows(BusinessException.class, () ->
                authService.alterarSenha("admin@oficina.com", request, httpRequest)
        );

        assertEquals("Senha atual incorreta.", ex.getMessage());
        verify(usuarioRepository, never()).save(any());
        verify(refreshTokenRepository, never()).revokeAllByUsuarioId(any());
    }

    @Test
    @DisplayName("Deve rejeitar alteração quando a confirmação da nova senha divergir")
    void shouldRejectPasswordChangeWhenConfirmationDoesNotMatch() {
        Usuario usuario = new Usuario("Proprietária", "admin@oficina.com", "hash_antigo", true);
        usuario.setId(1L);

        when(usuarioRepository.findByEmail("admin@oficina.com")).thenReturn(Optional.of(usuario));
        when(passwordEncoder.matches("SenhaAtual@123", "hash_antigo")).thenReturn(true);

        AlterarSenhaRequest request = new AlterarSenhaRequest("SenhaAtual@123", "NovaSenhaSegura#2026", "ConfirmacaoDiferente#2026");

        BusinessException ex = assertThrows(BusinessException.class, () ->
                authService.alterarSenha("admin@oficina.com", request, httpRequest)
        );

        assertEquals("A confirmação da nova senha não confere.", ex.getMessage());
        verify(usuarioRepository, never()).save(any());
    }

    @Test
    @DisplayName("Deve rejeitar alteração quando a nova senha for idêntica à senha atual")
    void shouldRejectPasswordChangeWhenNewPasswordIsSameAsCurrent() {
        Usuario usuario = new Usuario("Proprietária", "admin@oficina.com", "hash_antigo", true);
        usuario.setId(1L);

        when(usuarioRepository.findByEmail("admin@oficina.com")).thenReturn(Optional.of(usuario));
        when(passwordEncoder.matches("SenhaAtual@123", "hash_antigo")).thenReturn(true);

        AlterarSenhaRequest request = new AlterarSenhaRequest("SenhaAtual@123", "SenhaAtual@123", "SenhaAtual@123");

        BusinessException ex = assertThrows(BusinessException.class, () ->
                authService.alterarSenha("admin@oficina.com", request, httpRequest)
        );

        assertEquals("A nova senha não pode ser igual à senha atual.", ex.getMessage());
        verify(usuarioRepository, never()).save(any());
    }

    @Test
    @DisplayName("Deve rejeitar alteração quando a nova senha violar a política de complexidade")
    void shouldRejectPasswordChangeWhenNewPasswordViolatesPolicy() {
        Usuario usuario = new Usuario("Proprietária", "admin@oficina.com", "hash_antigo", true);
        usuario.setId(1L);

        when(usuarioRepository.findByEmail("admin@oficina.com")).thenReturn(Optional.of(usuario));
        when(passwordEncoder.matches("SenhaAtual@123", "hash_antigo")).thenReturn(true);
        when(passwordEncoder.matches("admin123", "hash_antigo")).thenReturn(false);

        AlterarSenhaRequest request = new AlterarSenhaRequest("SenhaAtual@123", "admin123", "admin123");

        assertThrows(BusinessException.class, () ->
                authService.alterarSenha("admin@oficina.com", request, httpRequest)
        );

        verify(usuarioRepository, never()).save(any());
    }

    @Test
    @DisplayName("Deve rejeitar alteração se a conta de usuário estiver inativa")
    void shouldRejectPasswordChangeWhenUserIsInactive() {
        Usuario usuario = new Usuario("Proprietária", "inativo@oficina.com", "hash_antigo", false);
        usuario.setId(1L);

        when(usuarioRepository.findByEmail("inativo@oficina.com")).thenReturn(Optional.of(usuario));

        AlterarSenhaRequest request = new AlterarSenhaRequest("SenhaAtual@123", "NovaSenhaSegura#2026", "NovaSenhaSegura#2026");

        assertThrows(DisabledException.class, () ->
                authService.alterarSenha("inativo@oficina.com", request, httpRequest)
        );

        verify(usuarioRepository, never()).save(any());
    }

    @Test
    @DisplayName("Backend como autoridade: o cliente não pode escolher arbitrariamente o tempo da sessão")
    void shouldNotAllowClientToDictateSessionExpirationDuration() {
        Usuario usuario = new Usuario("Proprietária", "admin@oficina.com", "hash_senha", true);
        usuario.setId(1L);
        usuario.addRole(new Role("ROLE_ADMIN", "Admin"));

        TwoFactorChallenge challenge = new TwoFactorChallenge(
                usuario,
                "challenge-temp-control",
                "hashed_code",
                OffsetDateTime.now().plusMinutes(5),
                false
        );

        when(twoFactorChallengeRepository.findByChallengeToken("challenge-temp-control")).thenReturn(Optional.of(challenge));
        when(passwordEncoder.matches("123456", "hashed_code")).thenReturn(true);
        when(jwtService.generateToken(usuario)).thenReturn("mock.jwt.token");
        when(jwtService.getExpirationMs()).thenReturn(900000L);

        org.mockito.ArgumentCaptor<RefreshToken> captor = org.mockito.ArgumentCaptor.forClass(RefreshToken.class);

        TwoFactorVerifyRequest request = new TwoFactorVerifyRequest("challenge-temp-control", "123456");
        LoginResult result = authService.verificarTwoFactor(request, httpRequest);

        verify(refreshTokenRepository).save(captor.capture());

        // A expiração deve ser estritamente controlada pelas propriedades do backend (24 horas = 86400s)
        assertEquals(REFRESH_EXPIRATION_TEMP_MS / 1000, result.refreshExpiresIn());
        assertFalse(result.rememberMe());
        assertTrue(captor.getValue().getDataExpiracao().isBefore(OffsetDateTime.now().plusHours(25)));
    }

    @Test
    @DisplayName("3. Deve rejeitar verify quando o desafio já estiver revogado previamente")
    void shouldRejectVerifyWhenChallengeIsRevoked() {
        Usuario usuario = new Usuario("Proprietária", "admin@oficina.com", "hash_senha", true);
        usuario.setId(1L);

        TwoFactorChallenge challenge = new TwoFactorChallenge(
                usuario,
                "challenge-revoked",
                "hashed_code",
                OffsetDateTime.now().plusMinutes(5),
                false
        );
        challenge.setRevogado(true);

        when(twoFactorChallengeRepository.findByChallengeToken("challenge-revoked")).thenReturn(Optional.of(challenge));

        TwoFactorVerifyRequest request = new TwoFactorVerifyRequest("challenge-revoked", "123456");
        BadCredentialsException ex = assertThrows(BadCredentialsException.class, () ->
                authService.verificarTwoFactor(request, httpRequest)
        );
        assertTrue(ex.getMessage().contains("Desafio inválido ou expirado"));
        verify(jwtService, never()).generateToken(any());
        verify(refreshTokenRepository, never()).save(any());
    }

    @Test
    @DisplayName("6 & 10. Concorrência simulada: segunda requisição com código correto encontra desafio utilizado e não emite sessão duplicada")
    void shouldPreventDuplicateSessionEmissionOnSimulatedConcurrentConsumption() {
        Usuario usuario = new Usuario("Proprietária", "admin@oficina.com", "hash_senha", true);
        usuario.setId(1L);
        usuario.addRole(new Role("ROLE_ADMIN", "Admin"));

        TwoFactorChallenge challenge = new TwoFactorChallenge(
                usuario,
                "challenge-concurrency-unit",
                "hashed_code",
                OffsetDateTime.now().plusMinutes(5),
                false
        );

        when(twoFactorChallengeRepository.findByChallengeToken("challenge-concurrency-unit")).thenReturn(Optional.of(challenge));
        when(passwordEncoder.matches("123456", "hashed_code")).thenReturn(true);
        when(jwtService.generateToken(usuario)).thenReturn("jwt.token.first");
        when(jwtService.getExpirationMs()).thenReturn(900000L);

        TwoFactorVerifyRequest request = new TwoFactorVerifyRequest("challenge-concurrency-unit", "123456");

        // 1ª requisição consome o desafio
        LoginResult firstResult = authService.verificarTwoFactor(request, httpRequest);
        assertNotNull(firstResult.accessToken());
        assertTrue(challenge.getUtilizado());

        // 2ª requisição concorrente encontra o desafio com utilizado=true
        BadCredentialsException ex = assertThrows(BadCredentialsException.class, () ->
                authService.verificarTwoFactor(request, httpRequest)
        );
        assertTrue(ex.getMessage().contains("Desafio inválido ou expirado"));

        // Garante que o JWT e RefreshToken só foram emitidos UMA vez
        verify(jwtService, times(1)).generateToken(usuario);
        verify(refreshTokenRepository, times(1)).save(any(RefreshToken.class));
    }

    @Test
    @DisplayName("8. Desafio revogado por excesso de tentativas não aceita código correto subsequente")
    void shouldRejectCorrectCodeIfChallengeWasRevokedByMaxAttempts() {
        Usuario usuario = new Usuario("Proprietária", "admin@oficina.com", "hash_senha", true);
        usuario.setId(1L);

        TwoFactorChallenge challenge = new TwoFactorChallenge(
                usuario,
                "challenge-exhausted",
                "hashed_code",
                OffsetDateTime.now().plusMinutes(5),
                false
        );
        challenge.setTentativas(5);
        challenge.setRevogado(true);

        when(twoFactorChallengeRepository.findByChallengeToken("challenge-exhausted")).thenReturn(Optional.of(challenge));

        TwoFactorVerifyRequest request = new TwoFactorVerifyRequest("challenge-exhausted", "123456");
        BadCredentialsException ex = assertThrows(BadCredentialsException.class, () ->
                authService.verificarTwoFactor(request, httpRequest)
        );
        assertTrue(ex.getMessage().contains("Desafio inválido ou expirado"));
        verify(passwordEncoder, never()).matches(anyString(), anyString());
        verify(jwtService, never()).generateToken(any());
        verify(refreshTokenRepository, never()).save(any());
    }
}
