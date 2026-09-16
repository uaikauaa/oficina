package com.oficinagestao.security;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Serviço em memória para controle de tentativas de autenticação e proteção contra força bruta.
 * ISSUE-003: Rate limiting e lockout temporário por IP e E-mail.
 */
@Service
public class LoginAttemptService {

    private static final Logger log = LoggerFactory.getLogger(LoginAttemptService.class);

    private final int maxAttempts;
    private final Duration lockDuration;

    private final Map<String, AttemptInfo> attemptsCache = new ConcurrentHashMap<>();

    public LoginAttemptService(
            @Value("${security.login.max-attempts:5}") int maxAttempts,
            @Value("${security.login.lock-duration-minutes:15}") int lockDurationMinutes
    ) {
        this.maxAttempts = maxAttempts;
        this.lockDuration = Duration.ofMinutes(lockDurationMinutes);
    }

    public static class AttemptInfo {
        private int attempts;
        private Instant lastAttempt;
        private Instant blockedUntil;

        public AttemptInfo(int attempts, Instant lastAttempt) {
            this.attempts = attempts;
            this.lastAttempt = lastAttempt;
        }

        public int getAttempts() {
            return attempts;
        }

        public Instant getLastAttempt() {
            return lastAttempt;
        }

        public Instant getBlockedUntil() {
            return blockedUntil;
        }

        public boolean isBlocked(Instant now) {
            return blockedUntil != null && now.isBefore(blockedUntil);
        }
    }

    /**
     * Verifica se o IP ou o e-mail está atualmente bloqueado.
     */
    public boolean isBlocked(String ip, String email) {
        Instant now = Instant.now();
        if (ip != null && !ip.isBlank() && isKeyBlocked("ip:" + ip.trim(), now)) {
            return true;
        }
        if (email != null && !email.isBlank() && isKeyBlocked("email:" + email.trim().toLowerCase(), now)) {
            return true;
        }
        return false;
    }

    /**
     * Retorna o tempo restante de bloqueio em minutos para IP ou email (mínimo 1 minuto se bloqueado).
     */
    public long getRemainingLockMinutes(String ip, String email) {
        Instant now = Instant.now();
        long remainingIp = getRemainingKeyLockMinutes("ip:" + (ip != null ? ip.trim() : ""), now);
        long remainingEmail = getRemainingKeyLockMinutes("email:" + (email != null ? email.trim().toLowerCase() : ""), now);
        return Math.max(remainingIp, remainingEmail);
    }

    /**
     * Registra uma tentativa de login com falha.
     */
    public void loginFailed(String ip, String email) {
        Instant now = Instant.now();
        if (ip != null && !ip.isBlank()) {
            recordFailure("ip:" + ip.trim(), now);
        }
        if (email != null && !email.isBlank()) {
            recordFailure("email:" + email.trim().toLowerCase(), now);
        }
    }

    /**
     * Registra um login bem-sucedido, limpando os contadores de falhas.
     */
    public void loginSucceeded(String ip, String email) {
        if (ip != null && !ip.isBlank()) {
            attemptsCache.remove("ip:" + ip.trim());
        }
        if (email != null && !email.isBlank()) {
            attemptsCache.remove("email:" + email.trim().toLowerCase());
        }
    }

    /**
     * Limpa todo o cache de tentativas (útil em testes).
     */
    public void resetAll() {
        attemptsCache.clear();
    }

    private boolean isKeyBlocked(String key, Instant now) {
        AttemptInfo info = attemptsCache.get(key);
        if (info == null) {
            return false;
        }
        if (info.isBlocked(now)) {
            return true;
        }
        // Se já passou o tempo de bloqueio, expira
        if (info.blockedUntil != null && !now.isBefore(info.blockedUntil)) {
            attemptsCache.remove(key);
            return false;
        }
        // Se a última tentativa foi há mais tempo que a janela de bloqueio, expira
        if (info.lastAttempt != null && Duration.between(info.lastAttempt, now).compareTo(lockDuration) > 0) {
            attemptsCache.remove(key);
            return false;
        }
        return false;
    }

    private long getRemainingKeyLockMinutes(String key, Instant now) {
        AttemptInfo info = attemptsCache.get(key);
        if (info != null && info.isBlocked(now)) {
            long seconds = Duration.between(now, info.blockedUntil).getSeconds();
            return Math.max(1, (seconds + 59) / 60);
        }
        return 0;
    }

    private void recordFailure(String key, Instant now) {
        attemptsCache.compute(key, (k, existing) -> {
            if (existing == null) {
                return new AttemptInfo(1, now);
            }

            // Se a última tentativa for mais antiga que a janela, reinicia a contagem
            if (existing.lastAttempt != null && Duration.between(existing.lastAttempt, now).compareTo(lockDuration) > 0) {
                return new AttemptInfo(1, now);
            }

            existing.attempts++;
            existing.lastAttempt = now;

            if (existing.attempts >= maxAttempts) {
                existing.blockedUntil = now.plus(lockDuration);
                log.warn("Chave de autenticação '{}' bloqueada temporariamente até {} por excesso de tentativas ({}/{}).",
                        key, existing.blockedUntil, existing.attempts, maxAttempts);
            }
            return existing;
        });
    }

    public int getAttemptsForKey(String key) {
        AttemptInfo info = attemptsCache.get(key);
        return info != null ? info.getAttempts() : 0;
    }
}
