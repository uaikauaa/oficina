package com.oficinagestao.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class TokenHashUtilTest {

    private final TokenHashUtil tokenHashUtil = new TokenHashUtil();

    @Test
    @DisplayName("Deve gerar hash SHA-256 de 64 caracteres em lowercase de forma determinística")
    void shouldGenerateDeterministicSha256InLowercaseHex() {
        String token = "d1e7c5b6-764f-4d69-8bc3-3ffcf8867a54";

        String hash1 = tokenHashUtil.hash(token);
        String hash2 = TokenHashUtil.hashStatic(token);

        assertNotNull(hash1);
        assertEquals(hash1, hash2, "As invocações de instância e estática devem ser idênticas.");
        assertEquals(64, hash1.length(), "O hash SHA-256 deve ter exatamente 64 caracteres.");
        assertTrue(hash1.matches("^[a-f0-9]{64}$"), "O hash deve conter apenas caracteres hexadecimais minúsculos.");

        // Determinismo: o mesmo token sempre produz exatamente o mesmo hash
        String hash3 = tokenHashUtil.hash(token);
        assertEquals(hash1, hash3);
    }

    @Test
    @DisplayName("Tokens diferentes devem gerar hashes diferentes")
    void shouldGenerateDifferentHashesForDifferentTokens() {
        String tokenA = "token-alpha-12345";
        String tokenB = "token-beta-67890";

        assertNotEquals(tokenHashUtil.hash(tokenA), tokenHashUtil.hash(tokenB));
    }

    @Test
    @DisplayName("Deve lançar IllegalArgumentException para token nulo ou vazio")
    void shouldThrowExceptionForNullOrBlankToken() {
        assertThrows(IllegalArgumentException.class, () -> tokenHashUtil.hash(null));
        assertThrows(IllegalArgumentException.class, () -> tokenHashUtil.hash(""));
        assertThrows(IllegalArgumentException.class, () -> tokenHashUtil.hash("   "));
        assertThrows(IllegalArgumentException.class, () -> TokenHashUtil.hashStatic(null));
        assertThrows(IllegalArgumentException.class, () -> TokenHashUtil.hashStatic(""));
        assertThrows(IllegalArgumentException.class, () -> TokenHashUtil.hashStatic("   "));
    }
}
