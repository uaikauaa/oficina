package com.oficinagestao.security;

import com.oficinagestao.dto.*;
import com.oficinagestao.entity.*;
import com.oficinagestao.repository.*;
import com.oficinagestao.service.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.time.OffsetDateTime;
import java.util.UUID;
import java.util.concurrent.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Exercises real transactions against the guarded, disposable PostgreSQL database. */
@SpringBootTest
@ActiveProfiles("test")
class AuthLifecycleAuditIntegrationTest {
    @Autowired AuthService auth;
    @Autowired UsuarioRepository users;
    @Autowired RoleRepository roles;
    @Autowired TwoFactorChallengeRepository challenges;
    @Autowired RefreshTokenRepository refreshTokens;
    @Autowired PasswordEncoder encoder;
    @Autowired JdbcTemplate jdbc;
    @Autowired LoginAttemptService attempts;
    @MockitoBean EmailService mail;
    @MockitoBean AuditoriaService audit;
    Usuario user;
    final MockHttpServletRequest request = new MockHttpServletRequest();
    final String password = "AuditOnly#2026Original!";

    @BeforeEach void setup() {
        attempts.resetAll();
        user = new Usuario("Audit synthetic", "audit-" + UUID.randomUUID() + "@oficina.invalid",
                encoder.encode(password), true);
        user.addRole(roles.findByNome("ROLE_ADMIN").orElseThrow());
        user = users.save(user);
        request.setRemoteAddr("127.0.0.1");
    }

    @AfterEach void cleanup() {
        jdbc.update("DELETE FROM refresh_tokens WHERE usuario_id = ?", user.getId());
        jdbc.update("DELETE FROM two_factor_challenges WHERE usuario_id = ?", user.getId());
        users.deleteById(user.getId());
        attempts.resetAll();
    }

    String challenge() {
        String id = UUID.randomUUID().toString();
        challenges.save(new TwoFactorChallenge(user, id, encoder.encode("123456"),
                OffsetDateTime.now().plusMinutes(5), false));
        return id;
    }

    String refresh() {
        String value = UUID.randomUUID().toString();
        refreshTokens.save(new RefreshToken(user, TokenHashUtil.hashStatic(value),
                OffsetDateTime.now().plusHours(1), false));
        return value;
    }

    @Test void passwordChangeRevokesPendingSecondFactor() {
        String pending = challenge();
        auth.alterarSenha(user.getEmail(), new AlterarSenhaRequest(password,
                "AuditOnly#2026Replacement!", "AuditOnly#2026Replacement!"), request);
        assertThrows(BadCredentialsException.class,
                () -> auth.verificarTwoFactor(new TwoFactorVerifyRequest(pending, "123456"), request));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM refresh_tokens WHERE usuario_id = ?",
                Integer.class, user.getId()));
    }

    @Test void logoutWithOldCookieRevokesRotatedDescendant() {
        String old = refresh();
        LoginResult rotated = auth.refresh(old, request);
        auth.logout(user.getEmail(), old, request);
        assertThrows(BadCredentialsException.class, () -> auth.refresh(rotated.refreshToken(), request));
    }

    @Test void loginCannotBypassEmailCooldown() {
        LoginRequest login = new LoginRequest(user.getEmail(), password, false);
        auth.login(login, request);
        assertThrows(com.oficinagestao.exception.RateLimitException.class, () -> auth.login(login, request));
        verify(mail, times(1)).sendTwoFactorCode(eq(user.getEmail()), anyString());
    }

    @Test void hourlyEmailBudgetIncludesAlreadyRevokedChallenges() {
        for (int i = 0; i < 10; i++) challenge();
        jdbc.update("UPDATE two_factor_challenges SET data_criacao = now() - interval '2 minutes', revogado = true WHERE usuario_id = ?", user.getId());
        assertThrows(com.oficinagestao.exception.RateLimitException.class,
                () -> auth.login(new LoginRequest(user.getEmail(), password, false), request));
        verifyNoInteractions(mail);
    }

    @Test void inactiveAccountCannotCompleteSecondFactor() {
        String pending = challenge();
        jdbc.update("UPDATE usuarios SET ativo = false WHERE id = ?", user.getId());
        assertThrows(BadCredentialsException.class,
                () -> auth.verificarTwoFactor(new TwoFactorVerifyRequest(pending, "123456"), request));
    }

    @Test void refreshRacingLogoutCannotLeaveAnActiveRefreshToken() throws Exception {
        String old = refresh();
        var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            Future<?> rotating = executor.submit(() -> {
                try { start.await(); auth.refresh(old, request); }
                catch (BadCredentialsException expected) { /* logout won */ }
                catch (InterruptedException ex) { throw new RuntimeException(ex); }
            });
            Future<?> logout = executor.submit(() -> {
                try { start.await(); auth.logout(user.getEmail(), old, request); }
                catch (InterruptedException ex) { throw new RuntimeException(ex); }
            });
            start.countDown();
            rotating.get(15, TimeUnit.SECONDS);
            logout.get(15, TimeUnit.SECONDS);
        }
        assertEquals(0, jdbc.queryForObject(
                "SELECT count(*) FROM refresh_tokens WHERE usuario_id = ? AND revogado = false",
                Integer.class, user.getId()));
    }
}
