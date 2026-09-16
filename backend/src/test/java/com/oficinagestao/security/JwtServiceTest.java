package com.oficinagestao.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Testes unitários para JwtService e validação de ambiente (ISSUE-004).
 */
class JwtServiceTest {

    @Test
    @DisplayName("Em ambiente de desenvolvimento/padrão, deve permitir secret padrão")
    void devePermitirSecretPadraoEmDesenvolvimento() {
        MockEnvironment env = new MockEnvironment();
        env.setActiveProfiles("dev");

        assertDoesNotThrow(() ->
                new JwtService(JwtService.DEFAULT_DEV_SECRET, 900000L, env)
        );
    }

    @Test
    @DisplayName("Em ambiente de produção, deve rejeitar secret padrão com IllegalStateException")
    void deveRejeitarSecretPadraoEmProducao() {
        MockEnvironment env = new MockEnvironment();
        env.setActiveProfiles("prod");

        IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
                new JwtService(JwtService.DEFAULT_DEV_SECRET, 900000L, env)
        );

        assertTrue(ex.getMessage().contains("CRITICAL SECURITY CONFIGURATION ERROR"));
        assertTrue(ex.getMessage().contains("valor padrão de desenvolvimento é estritamente proibido"));
    }

    @Test
    @DisplayName("Em ambiente de produção, deve rejeitar secret nulo ou em branco")
    void deveRejeitarSecretVazioEmProducao() {
        MockEnvironment env = new MockEnvironment();
        env.setActiveProfiles("production");

        assertThrows(IllegalStateException.class, () ->
                new JwtService("", 900000L, env)
        );

        assertThrows(IllegalStateException.class, () ->
                new JwtService("   ", 900000L, env)
        );
    }

    @Test
    @DisplayName("Em ambiente de produção, deve rejeitar secret com menos de 32 caracteres")
    void deveRejeitarSecretCurtoEmProducao() {
        MockEnvironment env = new MockEnvironment();
        env.setActiveProfiles("prod");

        IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
                new JwtService("chave-curta-insegura-12345", 900000L, env)
        );

        assertTrue(ex.getMessage().contains("deve conter pelo menos 32 caracteres"));
    }

    @Test
    @DisplayName("Em ambiente de produção, deve inicializar com sucesso quando fornecido secret forte")
    void deveInicializarComSucessoEmProducaoComSecretForte() {
        MockEnvironment env = new MockEnvironment();
        env.setActiveProfiles("prod");

        String secretForte = "chave-super-segura-gerada-aleatoriamente-2026-para-producao";

        JwtService service = assertDoesNotThrow(() ->
                new JwtService(secretForte, 900000L, env)
        );

        assertNotNull(service);
    }
}
