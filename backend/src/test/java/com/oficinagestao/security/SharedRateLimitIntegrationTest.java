package com.oficinagestao.security;

import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
class SharedRateLimitIntegrationTest {
    @Autowired SharedRateLimitService store;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager manager;
    @BeforeEach void clear() { jdbc.update("DELETE FROM security_rate_limits"); }

    @Test void replicasAndRestartShareExactlyOneAtomicBudget() throws Exception {
        String secret = "oficina-gestao-test-only-jwt-secret-2026-with-safe-length";
        var replicas = List.of(store, new SharedRateLimitService(jdbc, secret), new SharedRateLimitService(jdbc, secret));
        try (var executor = Executors.newFixedThreadPool(8)) {
            var tasks = new ArrayList<Callable<Boolean>>();
            for (int i = 0; i < 64; i++) {
                final int index = i;
                tasks.add(() -> replicas.get(index % 3).consume("distributed", "shared", 7, Duration.ofMinutes(1)).allowed());
            }
            var results = executor.invokeAll(tasks);
            long accepted = 0;
            for (var result : results) if (result.get(10, TimeUnit.SECONDS)) accepted++;
            assertEquals(7, accepted);
        }
        var restarted = new SharedRateLimitService(jdbc, secret);
        assertFalse(restarted.consume("distributed", "shared", 7, Duration.ofMinutes(1)).allowed());
        assertEquals(65, restarted.inspect("distributed", "shared", 7).used());
    }

    @Test void aRejectedBusinessTransactionCannotEraseTheCounter() {
        new TransactionTemplate(manager).executeWithoutResult(tx -> {
            store.consume("rollback", "synthetic", 1, Duration.ofMinutes(1));
            tx.setRollbackOnly();
        });
        assertFalse(store.inspect("rollback", "synthetic", 1).allowed());
    }

    @Test void databaseExpiryRestoresBudgetAndCleanupDoesNotDeleteActiveBuckets() {
        store.consume("expiry", "old", 1, Duration.ofMinutes(1));
        jdbc.update("UPDATE security_rate_limits SET expires_at = now() - interval '1 second'");
        assertTrue(store.consume("expiry", "old", 1, Duration.ofMinutes(1)).allowed());
        assertEquals(0, store.cleanup());
        assertEquals(1, store.inspect("expiry", "old", 1).used());
    }

    @Test void storedKeysDoNotContainAccountOrIpAndDistributedSubjectsStillHitGlobalBudget() {
        for (int i = 0; i < 12; i++) {
            store.consume("client", "192.0.2." + i + "|pessoa@oficina.invalid", 5, Duration.ofMinutes(1));
            assertEquals(i < 5, store.consume("global", "all", 5, Duration.ofMinutes(1)).allowed());
        }
        for (String key : jdbc.queryForList("SELECT bucket_key FROM security_rate_limits", String.class)) {
            assertFalse(key.contains("192.0.2.")); assertFalse(key.contains("oficina.invalid"));
        }
    }
}
