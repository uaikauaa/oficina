package com.oficinagestao.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
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

    public SharedRateLimitService(JdbcTemplate jdbc, @Value("${security.jwt.secret}") String secret) {
        this.jdbc = jdbc;
        this.key = ("rate-limit-v1:" + secret).getBytes(StandardCharsets.UTF_8);
    }

    public record Decision(boolean allowed, long used, long retryAfterSeconds) {}

    @Transactional(propagation = Propagation.REQUIRES_NEW, timeout = 5)
    public Decision consume(String scope, String subject, int limit, Duration window) {
        if (limit < 1 || window.isNegative() || window.isZero()) throw new IllegalArgumentException("Invalid rate policy");
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

    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = true, timeout = 5)
    public Decision inspect(String scope, String subject, int limit) {
        var rows = jdbc.query("""
            SELECT used, GREATEST(1, CEIL(EXTRACT(EPOCH FROM (expires_at - statement_timestamp())))) AS retry
            FROM security_rate_limits WHERE bucket_key = ? AND expires_at > statement_timestamp()
            """, (rs, row) -> new Decision(rs.getLong("used") < limit, rs.getLong("used"), rs.getLong("retry")), bucket(scope, subject));
        return rows.isEmpty() ? new Decision(true, 0, 0) : rows.getFirst();
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW, timeout = 5)
    public void clear(String scope, String subject) {
        jdbc.update("DELETE FROM security_rate_limits WHERE bucket_key = ?", bucket(scope, subject));
    }

    @Scheduled(fixedDelayString = "${security.rate.cleanup-ms:10000}")
    @Transactional(propagation = Propagation.REQUIRES_NEW, timeout = 5)
    public int cleanup() {
        return jdbc.update("DELETE FROM security_rate_limits WHERE bucket_key IN (SELECT bucket_key FROM security_rate_limits WHERE expires_at <= statement_timestamp() ORDER BY expires_at LIMIT 5000)");
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
