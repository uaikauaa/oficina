package com.oficinagestao.security;

import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import java.time.Duration;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
class RateKeyRotationAuditTest {
    @Autowired JdbcTemplate jdbc;
    @Autowired org.springframework.transaction.PlatformTransactionManager manager;
    final String rate = "audit-independent-rate-key-over-32-characters";
    @BeforeEach void clear() { jdbc.update("DELETE FROM security_rate_limits"); }
    @AfterEach void cleanup() { jdbc.update("DELETE FROM security_rate_limits"); }

    @Test void jwtRotationMustNotResetAnActiveRateBudget() {
        String oldJwt = "audit-original-jwt-secret-with-over-32-characters";
        String newJwt = "audit-rotated-jwt-secret-with-over-32-characters";
        var original = new SharedRateLimitService(jdbc, rate, oldJwt, "", manager);
        var rotated = new SharedRateLimitService(jdbc, rate, newJwt, "", manager);
        assertTrue(original.consume("rotation-audit", "synthetic-client", 1, Duration.ofMinutes(15)).allowed());
        assertFalse(rotated.consume("rotation-audit", "synthetic-client", 1, Duration.ofMinutes(15)).allowed(),
                "JWT rotation must never create a fresh abuse budget");
    }

    @Test void aRateKeyChangeFailsClosedUntilTheActiveWindowsExpire() {
        var oldService = new SharedRateLimitService(jdbc, rate);
        var newService = new SharedRateLimitService(jdbc, "audit-new-independent-rate-key-over-32-characters");
        oldService.consume("rotation-audit", "synthetic-client", 1, Duration.ofMinutes(15));
        assertThrows(org.springframework.dao.DataAccessResourceFailureException.class,
                () -> newService.consume("rotation-audit", "synthetic-client", 1, Duration.ofMinutes(15)));
        assertFalse(oldService.consume("rotation-audit", "synthetic-client", 1, Duration.ofMinutes(15)).allowed());
        jdbc.update("UPDATE security_rate_limits SET expires_at = now() - interval '1 second'");
        assertTrue(newService.consume("rotation-audit", "synthetic-client", 1, Duration.ofMinutes(15)).allowed());
        assertThrows(org.springframework.dao.DataAccessResourceFailureException.class,
                () -> oldService.consume("rotation-audit", "synthetic-client", 1, Duration.ofMinutes(15)));
    }

    @Test void jwtRotationRevokesOldSignaturesWhileTheRateBudgetSurvives() {
        var oldJwt = new JwtService("audit-original-jwt-secret-with-over-32-characters", 900000);
        var newJwt = new JwtService("audit-rotated-jwt-secret-with-over-32-characters", 900000);
        var user = new com.oficinagestao.entity.Usuario("Synthetic", "rotation@oficina.invalid", "unused", true);
        String token = oldJwt.generateToken(user);
        assertTrue(oldJwt.validateToken(token));
        assertFalse(newJwt.validateToken(token));
        assertTrue(newJwt.validateToken(newJwt.generateToken(user)));
    }

    @Test void absentWeakOrReusedSecretsAreRejectedWithoutPrintingThem() {
        assertThrows(IllegalStateException.class, () -> new SharedRateLimitService(jdbc, ""));
        assertThrows(IllegalStateException.class, () -> new SharedRateLimitService(jdbc, "weak"));
        for (String[] keys : new String[][]{{rate, rate, ""}, {rate, "different-jwt-key-over-32-characters", rate},
                {rate, "same-service-and-jwt-key-over-32-characters", "same-service-and-jwt-key-over-32-characters"}}) {
            var error = assertThrows(IllegalStateException.class, () -> new SharedRateLimitService(jdbc, keys[0], keys[1], keys[2], manager));
            assertFalse(error.getMessage().contains(rate));
        }
    }

    @Test void legacyUnclassifiedActiveBucketsCannotBeDiscardedAtBootstrap() {
        jdbc.update("DELETE FROM security_rate_key_state");
        jdbc.update("INSERT INTO security_rate_limits (bucket_key, used, expires_at) VALUES ('legacy:synthetic', 5, now() + interval '15 minutes')");
        assertThrows(org.springframework.dao.DataAccessResourceFailureException.class,
                () -> new SharedRateLimitService(jdbc, rate).consume("rotation-audit", "synthetic-client", 1, Duration.ofMinutes(1)));
    }

    @Test void concurrentMismatchedGenerationsCannotSplitOneBudget() throws Exception {
        var candidates = java.util.List.of(new SharedRateLimitService(jdbc, rate),
                new SharedRateLimitService(jdbc, "audit-competing-rate-generation-over-32-characters"));
        try (var executor = java.util.concurrent.Executors.newFixedThreadPool(8)) {
            var tasks = new java.util.ArrayList<java.util.concurrent.Callable<Boolean>>();
            for (int i = 0; i < 32; i++) {
                final int index = i;
                tasks.add(() -> {
                    try { return candidates.get(index % 2).consume("rotation-race", "same-client", 3, Duration.ofMinutes(1)).allowed(); }
                    catch (org.springframework.dao.DataAccessResourceFailureException expected) { return false; }
                });
            }
            int admitted = 0;
            for (var future : executor.invokeAll(tasks)) if (future.get()) admitted++;
            assertEquals(3, admitted, "Only one key generation can own an active window");
        }
    }
}
