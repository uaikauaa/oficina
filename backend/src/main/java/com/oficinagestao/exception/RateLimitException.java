package com.oficinagestao.exception;

/** A bounded, retryable denial that does not reveal account existence. */
public class RateLimitException extends RuntimeException {
    public RateLimitException() {
        super("Muitas solicitações de autenticação. Aguarde antes de tentar novamente.");
    }
}
