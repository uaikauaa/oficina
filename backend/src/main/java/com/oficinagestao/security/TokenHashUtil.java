package com.oficinagestao.security;

import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/**
 * Utilitário centralizado para cálculo de hash SHA-256 determinístico de refresh tokens (ADC-01).
 * Garante que refresh tokens nunca sejam persistidos em texto puro no banco de dados.
 */
@Component
public class TokenHashUtil {

    private static final String ALGORITHM = "SHA-256";

    /**
     * Calcula o hash SHA-256 do token em formato hexadecimal minúsculo (lowercase).
     *
     * @param rawToken Token bruto recebido do cliente
     * @return String de 64 caracteres hexadecimais em minúsculo
     */
    public String hash(String rawToken) {
        return hashStatic(rawToken);
    }

    /**
     * Método estático utilitário para hashing determinístico de tokens.
     *
     * @param rawToken Token bruto a ser hasheado
     * @return String de 64 caracteres hexadecimais em minúsculo
     */
    public static String hashStatic(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            throw new IllegalArgumentException("O token para cálculo de hash não pode ser nulo ou em branco.");
        }
        try {
            MessageDigest digest = MessageDigest.getInstance(ALGORITHM);
            byte[] hashBytes = digest.digest(rawToken.trim().getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hashBytes);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("Algoritmo de hash SHA-256 indisponível no ambiente", e);
        }
    }
}
