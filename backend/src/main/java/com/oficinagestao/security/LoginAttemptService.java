package com.oficinagestao.security;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Serviço em memória para controle de tentativas de autenticação e proteção contra força bruta (SEC-02).
 *
 * <p><b>Estratégia de Proteção:</b>
 * <ul>
 *   <li><b>Rate limiting por IP ({@code ip:<ip>}):</b> Bloqueia o IP de origem caso exceda o limite de tentativas
 *       falhas na janela de tempo, mitigando força bruta e password spraying (múltiplas contas testadas pelo mesmo IP).</li>
 *   <li><b>Rate limiting por combinação IP + Conta ({@code ip_email:<ip>:<email>}):</b> Bloqueia tentativas daquele
 *       IP específico contra aquela conta específica.</li>
 *   <li><b>Prevenção de Account Lockout DoS:</b> Bloqueios não são aplicados de forma global por e-mail de modo que
 *       um IP atacante impeça o acesso de um usuário legítimo vindo de seu IP legítimo.</li>
 *   <li><b>Limpeza Ativa e Eviction Segura:</b> Limpeza periódica agendada via {@link Scheduled} e desalocação
 *       determinística das entradas mais antigas em caso de saturação do cache (previne esgotamento de memória).</li>
 * </ul>
 */
@Service
public class LoginAttemptService {

    private static final Logger log = LoggerFactory.getLogger(LoginAttemptService.class);

    private static final int DEFAULT_MAX_CACHE_SIZE = 10_000;

    private final int maxAttempts;
    private final Duration lockDuration;
    private final int maxCacheSize;

    private final Map<String, AttemptInfo> attemptsCache = new ConcurrentHashMap<>();

    @org.springframework.beans.factory.annotation.Autowired
    public LoginAttemptService(
            @Value("${security.login.max-attempts:5}") int maxAttempts,
            @Value("${security.login.lock-duration-minutes:15}") int lockDurationMinutes,
            @Value("${security.login.max-cache-size:10000}") int maxCacheSize
    ) {
        this.maxAttempts = maxAttempts;
        this.lockDuration = Duration.ofMinutes(lockDurationMinutes);
        this.maxCacheSize = maxCacheSize > 0 ? maxCacheSize : DEFAULT_MAX_CACHE_SIZE;
    }

    public LoginAttemptService(
            int maxAttempts,
            int lockDurationMinutes
    ) {
        this(maxAttempts, lockDurationMinutes, DEFAULT_MAX_CACHE_SIZE);
    }

    public LoginAttemptService() {
        this(5, 15, DEFAULT_MAX_CACHE_SIZE);
    }

    public static class AttemptInfo {
        private int attempts;
        private volatile Instant lastAttempt;
        private volatile Instant blockedUntil;

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
     * Verifica se a requisição de login está atualmente bloqueada por excesso de tentativas.
     * Retorna {@code true} se o IP de origem ou o par (IP + E-mail) estiver bloqueado.
     */
    public boolean isBlocked(String ip, String email) {
        Instant now = Instant.now();
        if (ip != null && !ip.isBlank() && isKeyBlocked(buildIpKey(ip), now)) {
            return true;
        }
        if (ip != null && !ip.isBlank() && email != null && !email.isBlank()) {
            if (isKeyBlocked(buildIpEmailKey(ip, email), now)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Retorna o tempo restante de bloqueio em minutos para IP ou para a combinação IP+Email (mínimo 1 minuto se bloqueado).
     */
    public long getRemainingLockMinutes(String ip, String email) {
        Instant now = Instant.now();
        long remainingIp = (ip != null && !ip.isBlank()) ? getRemainingKeyLockMinutes(buildIpKey(ip), now) : 0;
        long remainingIpEmail = (ip != null && !ip.isBlank() && email != null && !email.isBlank())
                ? getRemainingKeyLockMinutes(buildIpEmailKey(ip, email), now)
                : 0;
        return Math.max(remainingIp, remainingIpEmail);
    }

    /**
     * Registra uma tentativa de login com falha para o IP e para o par IP + E-mail.
     */
    public void loginFailed(String ip, String email) {
        Instant now = Instant.now();
        if (ip != null && !ip.isBlank()) {
            recordFailure(buildIpKey(ip), now);
        }
        if (ip != null && !ip.isBlank() && email != null && !email.isBlank()) {
            recordFailure(buildIpEmailKey(ip, email), now);
        }
    }

    /**
     * Registra um login bem-sucedido, limpando as entradas do IP e do par IP + E-mail.
     */
    public void loginSucceeded(String ip, String email) {
        if (ip != null && !ip.isBlank()) {
            attemptsCache.remove(buildIpKey(ip));
        }
        if (ip != null && !ip.isBlank() && email != null && !email.isBlank()) {
            attemptsCache.remove(buildIpEmailKey(ip, email));
        }
    }

    /**
     * Limpa todo o cache de tentativas (útil em testes ou reinicializações).
     */
    public void resetAll() {
        attemptsCache.clear();
    }

    /**
     * Rotina periódica agendada para expirar entradas antigas do cache em memória.
     * Executa a cada 5 minutos por padrão (configurável via security.login.cleanup-interval-ms).
     */
    @Scheduled(fixedRateString = "${security.login.cleanup-interval-ms:300000}")
    public void scheduledCleanup() {
        int removed = cleanupExpiredEntries();
        if (removed > 0) {
            log.debug("Rotina agendada de limpeza de tentativas de login removeu {} entradas expiradas.", removed);
        }
    }

    /**
     * Limpa entradas expiradas do cache para prevenir crescimento indefinido de memória.
     * Retorna a quantidade de entradas removidas.
     */
    public int cleanupExpiredEntries() {
        Instant now = Instant.now();
        int removedCount = 0;
        for (Map.Entry<String, AttemptInfo> entry : attemptsCache.entrySet()) {
            AttemptInfo info = entry.getValue();
            if (info == null) {
                continue;
            }
            boolean isExpired = (info.getBlockedUntil() != null && !now.isBefore(info.getBlockedUntil()))
                    || (info.getBlockedUntil() == null && info.getLastAttempt() != null
                    && !now.isBefore(info.getLastAttempt().plus(lockDuration)));
            if (isExpired) {
                if (attemptsCache.remove(entry.getKey(), info)) {
                    removedCount++;
                }
            }
        }
        return removedCount;
    }

    public String buildIpKey(String ip) {
        return "ip:" + (ip != null ? ip.trim() : "");
    }

    public String buildIpEmailKey(String ip, String email) {
        return "ip_email:" + (ip != null ? ip.trim() : "") + ":" + (email != null ? email.trim().toLowerCase() : "");
    }

    public int getAttemptsCacheSize() {
        return attemptsCache.size();
    }

    public int getAttemptsForKey(String key) {
        AttemptInfo info = attemptsCache.get(key);
        return info != null ? info.getAttempts() : 0;
    }

    private boolean isKeyBlocked(String key, Instant now) {
        AttemptInfo info = attemptsCache.get(key);
        if (info == null) {
            return false;
        }
        if (info.isBlocked(now)) {
            return true;
        }
        // Se já passou o tempo de bloqueio, expira e remove de forma atômica
        if (info.getBlockedUntil() != null && !now.isBefore(info.getBlockedUntil())) {
            attemptsCache.remove(key, info);
            return false;
        }
        // Se a última tentativa foi há mais tempo que a janela de bloqueio, expira e remove
        if (info.getLastAttempt() != null && Duration.between(info.getLastAttempt(), now).compareTo(lockDuration) > 0) {
            attemptsCache.remove(key, info);
            return false;
        }
        return false;
    }

    private long getRemainingKeyLockMinutes(String key, Instant now) {
        AttemptInfo info = attemptsCache.get(key);
        if (info != null && info.isBlocked(now)) {
            long seconds = Duration.between(now, info.getBlockedUntil()).getSeconds();
            return Math.max(1, (seconds + 59) / 60);
        }
        return 0;
    }

    private void recordFailure(String key, Instant now) {
        ensureCapacity(now);

        attemptsCache.compute(key, (k, existing) -> {
            if (existing == null) {
                return new AttemptInfo(1, now);
            }

            // Se a última tentativa for mais antiga que a janela, reinicia a contagem
            if (existing.getLastAttempt() != null && Duration.between(existing.getLastAttempt(), now).compareTo(lockDuration) > 0) {
                AttemptInfo fresh = new AttemptInfo(1, now);
                return fresh;
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

    private void ensureCapacity(Instant now) {
        if (attemptsCache.size() >= maxCacheSize) {
            cleanupExpiredEntries();
            if (attemptsCache.size() >= maxCacheSize) {
                evictOldestEntries(Math.max(1, maxCacheSize / 10));
            }
        }
    }

    /**
     * Desaloja até {@code targetCount} entradas, priorizando entradas que não estão em bloqueio ativo
     * e cujas tentativas sejam as mais antigas. Previne starvation e DoS em memória.
     */
    private void evictOldestEntries(int targetCount) {
        if (targetCount <= 0 || attemptsCache.isEmpty()) {
            return;
        }
        Instant now = Instant.now();

        // 1ª prioridade: entradas que NÃO estão bloqueadas
        List<Map.Entry<String, AttemptInfo>> nonBlocked = attemptsCache.entrySet().stream()
                .filter(e -> !e.getValue().isBlocked(now))
                .sorted(Comparator.comparing(e -> e.getValue().getLastAttempt(), Comparator.nullsLast(Comparator.naturalOrder())))
                .limit(targetCount)
                .toList();

        int evicted = 0;
        for (Map.Entry<String, AttemptInfo> entry : nonBlocked) {
            if (attemptsCache.remove(entry.getKey(), entry.getValue())) {
                evicted++;
            }
        }

        // 2ª prioridade (se ainda saturado): entradas mais antigas em geral
        if (evicted < targetCount && !attemptsCache.isEmpty()) {
            int remaining = targetCount - evicted;
            List<Map.Entry<String, AttemptInfo>> oldest = attemptsCache.entrySet().stream()
                    .sorted(Comparator.comparing(e -> e.getValue().getLastAttempt(), Comparator.nullsLast(Comparator.naturalOrder())))
                    .limit(remaining)
                    .toList();

            for (Map.Entry<String, AttemptInfo> entry : oldest) {
                attemptsCache.remove(entry.getKey(), entry.getValue());
            }
        }
    }
}
