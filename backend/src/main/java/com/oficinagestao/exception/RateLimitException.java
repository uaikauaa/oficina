package com.oficinagestao.exception;

/** A bounded, retryable denial that does not reveal account existence. */
public class RateLimitException extends RuntimeException {
    private final long retryAfterSeconds;
    public RateLimitException() {
        this(60);
    }
    public RateLimitException(long retryAfterSeconds) {
        super("Muitas solicitações de autenticação. Aguarde antes de tentar novamente.");
        this.retryAfterSeconds = Math.max(1, retryAfterSeconds);
    }
    public long getRetryAfterSeconds() { return retryAfterSeconds; }
}
