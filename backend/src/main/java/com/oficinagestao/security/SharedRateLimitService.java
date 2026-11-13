package com.oficinagestao.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.HexFormat;

/** PostgreSQL owns the clock and serializes each bucket's UPSERT across replicas. */
@Service
public class SharedRateLimitService {
    private final JdbcTemplate jdbc;
    private final byte[] key;
    private final String fingerprint;
    private final TransactionTemplate transaction;

    @Autowired
    public SharedRateLimitService(JdbcTemplate jdbc, @Value("${security.rate.secret:}") String secret,
            @Value("${security.jwt.secret}") String jwtSecret, @Value("${security.proxy.secret:}") String proxySecret,
            PlatformTransactionManager manager) {
        this(jdbc, secret, manager);
        if (secret.equals(jwtSecret) || secret.equals(proxySecret) || (!proxySecret.isBlank() && proxySecret.equals(jwtSecret)))
            throw new IllegalStateException("JWT, rate limiter and service context require distinct secrets");
    }

    public SharedRateLimitService(JdbcTemplate jdbc, String secret) {
        this(jdbc, secret, new org.springframework.jdbc.datasource.DataSourceTransactionManager(java.util.Objects.requireNonNull(jdbc.getDataSource())));
    }

    private SharedRateLimitService(JdbcTemplate jdbc, String secret, PlatformTransactionManager manager) {
        if (secret == null || secret.length() < 32 || secret.isBlank()) throw new IllegalStateException("RATE_LIMIT_SECRET must contain at least 32 characters");
        this.jdbc = jdbc;
        this.key = ("rate-limit-v2:" + secret).getBytes(StandardCharsets.UTF_8);
        try { this.fingerprint = HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(key)); }
        catch (java.security.GeneralSecurityException e) { throw new IllegalStateException("Rate limiter unavailable"); }
        this.transaction = new TransactionTemplate(manager);
        this.transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        this.transaction.setTimeout(5);
    }

    public record Decision(boolean allowed, long used, long retryAfterSeconds) {}

    public Decision consume(String scope, String subject, int limit, Duration window) {
        if (limit < 1 || window.isNegative() || window.isZero()) throw new IllegalArgumentException("Invalid rate policy");
        return transaction.execute(status -> consumeStatement(scope, subject, limit, window));
    }

    /** For callers that atomically reserve capacity and budget in one existing transaction. */
    public Decision consumeInCurrentTransaction(String scope, String subject, int limit, Duration window) {
        if (!TransactionSynchronizationManager.isActualTransactionActive())
            throw new IllegalStateException("An active transaction is required for atomic rate consumption");
        if (limit < 1 || window.isNegative() || window.isZero()) throw new IllegalArgumentException("Invalid rate policy");
        return consumeStatement(scope, subject, limit, window);
    }

    private Decision consumeStatement(String scope, String subject, int limit, Duration window) {
        ensureKeyGeneration();
        return jdbc.queryForObject("""
            INSERT INTO security_rate_limits (bucket_key, used, expires_at)
            VALUES (?, 1, statement_timestamp() + (? * interval '1 millisecond'))
            ON CONFLICT (bucket_key) DO UPDATE SET
              used = CASE WHEN security_rate_limits.expires_at <= statement_timestamp() THEN 1
                     ELSE LEAST(security_rate_limits.used + 1, 1000000000) END,
              expires_at = CASE WHEN security_rate_limits.expires_at <= statement_timestamp()
                     THEN statement_timestamp() + (? * interval '1 millisecond') ELSE security_rate_limits.expires_at END
            RETURNING used, GREATEST(1, CEIL(EXTRACT(EPOCH FROM (expires_at - statement_timestamp())))) AS retry
            """, (rs, row) -> new Decision(rs.getLong("used") <= limit, rs.getLong("used"), rs.getLong("retry")),
                bucket(scope, subject), window.toMillis(), window.toMillis());
    }

    public Decision inspect(String scope, String subject, int limit) {
        return transaction.execute(status -> {
        ensureKeyGeneration();
        var rows = jdbc.query("""
            SELECT used, GREATEST(1, CEIL(EXTRACT(EPOCH FROM (expires_at - statement_timestamp())))) AS retry
            FROM security_rate_limits WHERE bucket_key = ? AND expires_at > statement_timestamp()
            """, (rs, row) -> new Decision(rs.getLong("used") < limit, rs.getLong("used"), rs.getLong("retry")), bucket(scope, subject));
        return rows.isEmpty() ? new Decision(true, 0, 0) : rows.getFirst();
        });
    }

    public void clear(String scope, String subject) {
        transaction.executeWithoutResult(status -> {
        ensureKeyGeneration();
        jdbc.update("DELETE FROM security_rate_limits WHERE bucket_key = ?", bucket(scope, subject));
        });
    }

    @Scheduled(fixedDelayString = "${security.rate.cleanup-ms:10000}")
    public int cleanup() {
        return transaction.execute(status -> jdbc.update("DELETE FROM security_rate_limits WHERE bucket_key IN (SELECT bucket_key FROM security_rate_limits WHERE expires_at <= statement_timestamp() ORDER BY expires_at LIMIT 5000)"));
    }

    /** Never let a changed key (or a stale replica) silently create fresh budgets. */
    private void ensureKeyGeneration() {
        var observed = jdbc.queryForList("SELECT key_fingerprint FROM security_rate_key_state WHERE singleton = 1", String.class);
        if (!observed.isEmpty() && fingerprint.equals(observed.getFirst())) {
            var locked = jdbc.queryForList("SELECT key_fingerprint FROM security_rate_key_state WHERE singleton = 1 AND key_fingerprint = ? FOR SHARE", String.class, fingerprint);
            if (locked.isEmpty()) throw rotationBlocked();
            return;
        }
        // Serialize bootstrap and rotations; ordinary requests only hold a shared row lock.
        jdbc.execute("SELECT pg_advisory_xact_lock(1129270606, 1380013125)");
        var locked = jdbc.queryForList("SELECT key_fingerprint FROM security_rate_key_state WHERE singleton = 1 FOR UPDATE", String.class);
        if (!locked.isEmpty() && fingerprint.equals(locked.getFirst())) return;
        boolean active = Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS (SELECT 1 FROM security_rate_limits WHERE expires_at > statement_timestamp())", Boolean.class));
        if (active) throw rotationBlocked();
        jdbc.update("INSERT INTO security_rate_key_state (singleton, key_fingerprint) VALUES (1, ?) ON CONFLICT (singleton) DO UPDATE SET key_fingerprint = EXCLUDED.key_fingerprint", fingerprint);
    }

    private static org.springframework.dao.DataAccessResourceFailureException rotationBlocked() {
        return new org.springframework.dao.DataAccessResourceFailureException("Rate key transition blocked while active budgets exist; drain old replicas and wait for expiry");
    }

    String bucket(String scope, String subject) {
        if (!scope.matches("[a-z-]{1,32}")) throw new IllegalArgumentException("Invalid rate scope");
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key, "HmacSHA256"));
            return scope + ":" + HexFormat.of().formatHex(mac.doFinal(subject.getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.GeneralSecurityException e) { throw new IllegalStateException("Rate limiter unavailable", e); }
    }
}
