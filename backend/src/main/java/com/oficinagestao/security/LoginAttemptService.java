package com.oficinagestao.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.time.Duration;
import java.util.Locale;

/** Persistent failure budgets; a successful account never clears the IP spray budget. */
@Service
public class LoginAttemptService {
    private final SharedRateLimitService store;
    private final int maxAttempts;
    private final Duration window;

    public LoginAttemptService(SharedRateLimitService store,
            @Value("${security.login.max-attempts:5}") int maxAttempts,
            @Value("${security.login.lock-duration-minutes:15}") int minutes) {
        this.store = store;
        this.maxAttempts = maxAttempts;
        this.window = Duration.ofMinutes(minutes);
    }
    public boolean isBlocked(String ip, String email) {
        return !store.inspect("login-ip", ip, maxAttempts).allowed()
                || !store.inspect("login-pair", pair(ip, email), maxAttempts).allowed();
    }
    public long getRemainingLockMinutes(String ip, String email) {
        long seconds = Math.max(store.inspect("login-ip", ip, maxAttempts).retryAfterSeconds(),
                store.inspect("login-pair", pair(ip, email), maxAttempts).retryAfterSeconds());
        return (seconds + 59) / 60;
    }
    public void loginFailed(String ip, String email) {
        store.consume("login-ip", ip, maxAttempts, window);
        store.consume("login-pair", pair(ip, email), maxAttempts, window);
    }
    public void loginSucceeded(String ip, String email) {
        store.clear("login-pair", pair(ip, email));
    }
    private String pair(String ip, String email) { return ip + "|" + email.trim().toLowerCase(Locale.ROOT); }
}
