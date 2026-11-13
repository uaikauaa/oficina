package com.oficinagestao.service;

import com.oficinagestao.dto.CompletePasswordRecoveryRequest;
import com.oficinagestao.entity.Usuario;
import com.oficinagestao.exception.BusinessException;
import com.oficinagestao.exception.RateLimitException;
import com.oficinagestao.repository.RefreshTokenRepository;
import com.oficinagestao.repository.TwoFactorChallengeRepository;
import com.oficinagestao.repository.UsuarioRepository;
import com.oficinagestao.security.IpAddressResolver;
import com.oficinagestao.security.PasswordPolicyValidator;
import com.oficinagestao.security.SharedRateLimitService;
import com.oficinagestao.security.TokenHashUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.annotation.PostConstruct;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class PasswordRecoveryService {
    private static final Logger log = LoggerFactory.getLogger(PasswordRecoveryService.class);
    public enum RequestOutcome { ACCEPTED, SATURATED }
    private record Reset(long id, long userId, OffsetDateTime expiresAt,
                         OffsetDateTime usedAt, OffsetDateTime revokedAt) { }
    private record RequestJob(UUID id, int keyVersion, byte[] nonce, byte[] ciphertext,
                              OffsetDateTime expiresAt) { }
    private final JdbcTemplate jdbc;
    private final UsuarioRepository users;
    private final RefreshTokenRepository refreshTokens;
    private final TwoFactorChallengeRepository challenges;
    private final PasswordEncoder passwords;
    private final SharedRateLimitService limits;
    private final IpAddressResolver addresses;
    private final InviteOutbox outbox;
    private final TransactionTemplate transactions;
    private final AtomicLong saturationEvents = new AtomicLong();
    private final SecureRandom random = new SecureRandom();
    @Value("${security.password-recovery.expiration-minutes:30}")
    private int expiryMinutes;
    @Value("${security.password-recovery.queue-poll-ms:1000}")
    private long queuePollMs;

    public PasswordRecoveryService(JdbcTemplate jdbc, UsuarioRepository users,
                                   RefreshTokenRepository refreshTokens,
                                   TwoFactorChallengeRepository challenges,
                                   PasswordEncoder passwords, SharedRateLimitService limits,
                                   IpAddressResolver addresses, InviteOutbox outbox,
                                   TransactionTemplate transactions) {
        this.jdbc = jdbc;
        this.users = users;
        this.refreshTokens = refreshTokens;
        this.challenges = challenges;
        this.passwords = passwords;
        this.limits = limits;
        this.addresses = addresses;
        this.outbox = outbox;
        this.transactions = transactions;
    }

    @PostConstruct
    void validateConfiguration() {
        if (expiryMinutes < 5 || expiryMinutes > 60) throw new IllegalStateException(
                "PASSWORD_RECOVERY_EXPIRATION_MINUTES deve estar entre 5 e 60.");
        if (queuePollMs < 100 || queuePollMs > 3600000) throw new IllegalStateException(
                "PASSWORD_RECOVERY_QUEUE_POLL_MS deve estar entre 100 e 3600000.");
    }

    /** No account lookup or account-dependent write occurs before the public response. */
    @Transactional
    public RequestOutcome request(String suppliedEmail, HttpServletRequest http) {
        String email = suppliedEmail.trim().toLowerCase(Locale.ROOT);
        String ip = addresses.extrairIp(http);
        // Global saturation is independent of account state and must not consume budgets.
        jdbc.queryForList("SELECT pg_advisory_xact_lock(63701002291234)");
        Long pending = jdbc.queryForObject("SELECT count(*) FROM password_recovery_request_jobs WHERE status='PENDING'", Long.class);
        if (pending != null && pending >= 10000) {
            if (saturationEvents.incrementAndGet() == 1)
                log.warn("Password recovery queue saturated; HTTP 503; pending={}", pending);
            return RequestOutcome.SATURATED;
        }
        if (!limits.consumeInCurrentTransaction("password-recovery-ip", ip, 10, Duration.ofMinutes(15)).allowed()
                || !limits.consumeInCurrentTransaction("password-recovery-email", email, 3, Duration.ofHours(1)).allowed())
            return RequestOutcome.ACCEPTED;
        outbox.enqueueRecoveryRequest(email);
        return RequestOutcome.ACCEPTED;
    }

    @Scheduled(fixedDelayString = "${security.password-recovery.queue-poll-ms:1000}",
            initialDelayString = "${security.password-recovery.queue-poll-ms:1000}")
    public void pollRequests() {
        for (int i = 0; i < 50 && dispatchRequestOne(); i++) { /* bounded batch */ }
    }

    @Scheduled(fixedDelayString = "${security.password-recovery.queue-cleanup-ms:3600000}",
            initialDelayString = "${security.password-recovery.queue-cleanup-ms:3600000}")
    public void cleanupCompletedRequests() {
        jdbc.update("DELETE FROM password_recovery_request_jobs WHERE status<>'PENDING' "
                + "AND processed_at < now()-interval '7 days'");
    }

    /** Aggregate only; never log submitted addresses or request payloads. */
    @Scheduled(fixedDelay = 60000, initialDelay = 60000)
    public void reportSaturation() {
        long count = saturationEvents.getAndSet(0);
        if (count > 0) log.warn("Password recovery queue saturation events in the last interval={}", count);
    }

    /** Row locks and the reset/outbox insert share one transaction across JVMs and restarts. */
    public boolean dispatchRequestOne() {
        return Boolean.TRUE.equals(transactions.execute(status -> {
            var jobs = jdbc.query("SELECT id,key_version,nonce,ciphertext,expires_at "
                    + "FROM password_recovery_request_jobs WHERE status='PENDING' "
                    + "ORDER BY created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED",
                    (rs, row) -> new RequestJob(rs.getObject("id", UUID.class), rs.getInt("key_version"),
                            rs.getBytes("nonce"), rs.getBytes("ciphertext"),
                            rs.getObject("expires_at", OffsetDateTime.class)));
            if (jobs.isEmpty()) return false;
            RequestJob job = jobs.getFirst();
            if (!job.expiresAt().isAfter(OffsetDateTime.now())) {
                finishJob(job.id(), "EXPIRED", "QUEUE_EXPIRED");
                return true;
            }
            String email;
            try {
                email = outbox.decryptRecoveryRequest(job.id(), job.keyVersion(), job.nonce(), job.ciphertext());
            } catch (IllegalStateException error) {
                finishJob(job.id(), "EXHAUSTED", "DECRYPTION_FAILED");
                return true;
            }
            issueRecovery(email);
            finishJob(job.id(), "PROCESSED", null);
            return true;
        }));
    }

    private void finishJob(UUID id, String state, String category) {
        jdbc.update("UPDATE password_recovery_request_jobs SET status=?,nonce=NULL,ciphertext=NULL,"
                + "processed_at=now(),failure_category=? WHERE id=?", state, category, id);
    }

    private void issueRecovery(String email) {
        Usuario user = users.findByEmailForUpdate(email).orElse(null);
        if (user == null || !Boolean.TRUE.equals(user.getAtivo())) return;
        jdbc.update("UPDATE password_reset_requests SET revogado_em=now() WHERE usuario_id=? "
                + "AND usado_em IS NULL AND revogado_em IS NULL", user.getId());
        jdbc.update("UPDATE password_reset_outbox o SET status='CANCELLED',nonce=NULL,ciphertext=NULL,"
                + "last_failure='REISSUED' FROM password_reset_requests r WHERE r.id=o.reset_id "
                + "AND r.usuario_id=? AND o.status='PENDING'", user.getId());
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        Long resetId = jdbc.queryForObject("INSERT INTO password_reset_requests(usuario_id,token_hash,expira_em) "
                + "VALUES (?,?,now()+(? * interval '1 minute')) RETURNING id", Long.class,
                user.getId(), TokenHashUtil.hashStatic(token), expiryMinutes);
        outbox.enqueueRecovery(resetId, token);
        jdbc.update("INSERT INTO eventos_administrativos(ator_id,acao,detalhes) VALUES (?,?,?)",
                user.getId(), "RECUPERACAO_SOLICITADA", "Solicitação id=" + resetId);
    }

    @Transactional
    public void complete(CompletePasswordRecoveryRequest request, HttpServletRequest http) {
        if (!limits.consume("password-recovery-complete", addresses.extrairIp(http), 10,
                Duration.ofMinutes(15)).allowed()) throw new RateLimitException(900);
        if (!request.token().matches("[A-Za-z0-9_-]{43}")) throw invalid();
        PasswordPolicyValidator.validar(request.senha());
        if (!request.senha().equals(request.confirmacao()))
            throw new BusinessException("A confirmação da senha não corresponde.");
        String hash = TokenHashUtil.hashStatic(request.token());
        List<Long> ids = jdbc.queryForList("SELECT usuario_id FROM password_reset_requests WHERE token_hash=?",
                Long.class, hash);
        if (ids.size() != 1) throw invalid();
        Usuario user = users.findByIdForUpdate(ids.getFirst()).orElseThrow(PasswordRecoveryService::invalid);
        List<Reset> matches = jdbc.query("SELECT id,usuario_id,expira_em,usado_em,revogado_em "
                + "FROM password_reset_requests WHERE token_hash=? FOR UPDATE", (rs, row) -> new Reset(
                rs.getLong("id"), rs.getLong("usuario_id"), rs.getObject("expira_em", OffsetDateTime.class),
                rs.getObject("usado_em", OffsetDateTime.class), rs.getObject("revogado_em", OffsetDateTime.class)), hash);
        if (matches.size() != 1) throw invalid();
        Reset reset = matches.getFirst();
        if (!user.getId().equals(reset.userId()) || !Boolean.TRUE.equals(user.getAtivo())
                || reset.usedAt() != null || reset.revokedAt() != null
                || !reset.expiresAt().isAfter(OffsetDateTime.now())) throw invalid();
        user.setSenha(passwords.encode(request.senha()));
        user.incrementTokenVersion();
        users.saveAndFlush(user);
        refreshTokens.revokeAllByUsuarioId(user.getId());
        challenges.revokeAllActiveByUsuarioId(user.getId());
        jdbc.update("UPDATE password_reset_requests SET usado_em=now() WHERE id=?", reset.id());
        jdbc.update("UPDATE password_reset_requests SET revogado_em=now() WHERE usuario_id=? "
                + "AND id<>? AND usado_em IS NULL AND revogado_em IS NULL", user.getId(), reset.id());
        jdbc.update("UPDATE password_reset_outbox o SET status='CANCELLED',nonce=NULL,ciphertext=NULL,"
                + "last_failure='USED' FROM password_reset_requests r WHERE r.id=o.reset_id "
                + "AND r.usuario_id=? AND o.status='PENDING'", user.getId());
        jdbc.update("INSERT INTO eventos_administrativos(ator_id,acao,detalhes) VALUES (?,?,?)",
                user.getId(), "SENHA_RECUPERADA", "Recuperação id=" + reset.id());
    }

    private static BusinessException invalid() {
        return new BusinessException("Link de recuperação inválido ou expirado.");
    }
}
