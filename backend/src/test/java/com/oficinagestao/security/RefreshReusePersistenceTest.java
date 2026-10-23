package com.oficinagestao.security;

import com.oficinagestao.entity.RefreshToken;
import com.oficinagestao.entity.Usuario;
import com.oficinagestao.repository.RefreshTokenRepository;
import com.oficinagestao.repository.UsuarioRepository;
import com.oficinagestao.service.AuthService;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static com.oficinagestao.testsupport.CsrfMockMvc.withCsrf;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Prepared for the disposable PostgreSQL gate. Never include in the isolated test selection.
 * No test-wide transaction: the HTTP failure must finish before a new transaction reads state.
 */
@SpringBootTest(properties = "security.jwt.refresh-token-cleanup-cron=-")
@ActiveProfiles("test")
@AutoConfigureMockMvc
class RefreshReusePersistenceTest {
    @Autowired MockMvc mvc;
    @Autowired UsuarioRepository users;
    @Autowired RefreshTokenRepository tokens;
    @Autowired PlatformTransactionManager transactionManager;
    @Autowired AuthService authService;

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void rejectedReuseCommitsFamilyRevocationWithoutAffectingAnotherUser(boolean purgeFirst) throws Exception {
        assertFalse(org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive());
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        String raw = UUID.randomUUID().toString();
        List<Long> userIds = new ArrayList<>();
        List<Long> tokenIds = new ArrayList<>();
        try {
            tx.executeWithoutResult(status -> {
                var owner = users.save(new Usuario("Synthetic reuse", raw + "@example.invalid", "unused-test-hash", true));
                var other = users.save(new Usuario("Synthetic other", UUID.randomUUID() + "@example.invalid", "unused-test-hash", true));
                userIds.add(owner.getId());
                userIds.add(other.getId());
                var revoked = new RefreshToken(owner, TokenHashUtil.hashStatic(raw), OffsetDateTime.now().plusDays(1), false);
                revoked.revoke();
                tokenIds.add(tokens.save(revoked).getId());
                for (int i = 0; i < 2; i++) {
                    tokenIds.add(tokens.save(new RefreshToken(owner, TokenHashUtil.hashStatic(UUID.randomUUID().toString()),
                            OffsetDateTime.now().plusDays(1), true)).getId());
                }
                tokenIds.add(tokens.save(new RefreshToken(other, TokenHashUtil.hashStatic(UUID.randomUUID().toString()),
                        OffsetDateTime.now().plusDays(1), true)).getId());
            });

            if (purgeFirst) {
                OffsetDateTime now = OffsetDateTime.now().withNano(0);
                assertNoPreexistingEligibleTokens(tx, now.minusDays(7));
                try (var clock = mockStatic(OffsetDateTime.class, CALLS_REAL_METHODS)) {
                    clock.when(OffsetDateTime::now).thenReturn(now);
                    assertEquals(0, authService.purgarTokensExpiradosOuRevogados());
                }
                tx.executeWithoutResult(status -> {
                    assertTrue(tokens.findById(tokenIds.getFirst()).orElseThrow().getRevogado());
                    for (int i = 1; i < 4; i++) {
                        assertFalse(tokens.findById(tokenIds.get(i)).orElseThrow().getRevogado());
                    }
                });
            }

            assertFalse(org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive());
            mvc.perform(withCsrf(mvc, post("/api/auth/refresh")).cookie(new Cookie("refresh_token", raw)))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.message").value("Refresh token revogado."))
                    .andExpect(cookie().doesNotExist("access_token"))
                    .andExpect(cookie().doesNotExist("refresh_token"));

            tx.executeWithoutResult(status -> {
                for (int i = 0; i < 3; i++) assertTrue(tokens.findById(tokenIds.get(i)).orElseThrow().getRevogado());
                assertFalse(tokens.findById(tokenIds.get(3)).orElseThrow().getRevogado());
                assertEquals(3, tokens.findAll().stream().filter(t -> t.getUsuario().getId().equals(userIds.getFirst())).count());
                assertEquals(1, tokens.findAll().stream().filter(t -> t.getUsuario().getId().equals(userIds.get(1))).count());
            });
        } finally {
            // Only this test's synthetic records, in the guarded disposable test database.
            tx.executeWithoutResult(status -> {
                tokens.deleteAllById(tokenIds);
                tokens.flush();
                users.deleteAllById(userIds);
            });
        }
    }

    @Test
    void purgeRetainsEveryTokenThroughSevenDaysAfterExpiration() {
        assertFalse(org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive());
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        // Whole seconds are exactly representable by PostgreSQL timestamp precision.
        OffsetDateTime now = OffsetDateTime.now().withNano(0);
        OffsetDateTime cutoff = now.minusDays(7);
        // Run serially on the guarded disposable database; never delete unrelated fixtures.
        assertNoPreexistingEligibleTokens(tx, cutoff);
        List<Long> userIds = new ArrayList<>();
        List<Long> tokenIds = new ArrayList<>();
        int[] expirationDays = {1, -2, -6, -8, -8, 1, -2, -7};
        boolean[] revoked = {true, true, true, true, false, false, true, true};
        try {
            tx.executeWithoutResult(status -> {
                var owner = users.save(new Usuario("Synthetic retention", UUID.randomUUID() + "@example.invalid", "unused-test-hash", true));
                var other = users.save(new Usuario("Synthetic retention other", UUID.randomUUID() + "@example.invalid", "unused-test-hash", true));
                userIds.add(owner.getId());
                userIds.add(other.getId());
                for (int i = 0; i < expirationDays.length; i++) {
                    var token = new RefreshToken(i == 6 ? other : owner,
                            TokenHashUtil.hashStatic(UUID.randomUUID().toString()), now.plusDays(expirationDays[i]), false);
                    if (revoked[i]) token.revoke();
                    tokenIds.add(tokens.save(token).getId());
                }
            });
            try (var clock = mockStatic(OffsetDateTime.class, CALLS_REAL_METHODS)) {
                clock.when(OffsetDateTime::now).thenReturn(now);
                assertEquals(2, authService.purgarTokensExpiradosOuRevogados());
            }
            // New transaction and persistence context, after the real service transaction commits.
            tx.executeWithoutResult(status -> {
                for (int i = 0; i < tokenIds.size(); i++) {
                    var stored = tokens.findById(tokenIds.get(i));
                    if (i == 3 || i == 4) {
                        assertTrue(stored.isEmpty(), "Expired eight days ago: " + i);
                    } else {
                        var token = stored.orElseThrow();
                        assertEquals(revoked[i], token.getRevogado());
                        assertTrue(token.getDataExpiracao().isEqual(now.plusDays(expirationDays[i])));
                        assertEquals(userIds.get(i == 6 ? 1 : 0), token.getUsuario().getId());
                    }
                }
                assertEquals(6, tokens.findAllById(tokenIds).size());
            });
        } finally {
            tx.executeWithoutResult(status -> {
                tokens.deleteAllById(tokenIds);
                tokens.flush();
                users.deleteAllById(userIds);
            });
        }
    }

    private void assertNoPreexistingEligibleTokens(TransactionTemplate tx, OffsetDateTime cutoff) {
        tx.executeWithoutResult(status -> assertFalse(tokens.findAll().stream()
                .anyMatch(token -> token.getDataExpiracao().isBefore(cutoff)),
                "Disposable database must contain no unrelated tokens eligible for global purge"));
    }
}
