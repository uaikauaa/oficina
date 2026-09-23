package com.oficinagestao.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Testes unitários para JwtService e validação de ambiente (ISSUE-004).
 */
class JwtServiceTest {

    // =========================================================================
    // FASE 4.2.3: 8 CASOS DE TESTE OBRIGATÓRIOS DO JWT SECRET
    // =========================================================================

    @Test
    @DisplayName("Caso 1: Secret válido em ambiente de produção deve inicializar com sucesso")
    void caso1_secretValidoEmAmbienteValido_deveAceitar() {
        MockEnvironment env = new MockEnvironment();
        env.setActiveProfiles("prod");

        String secretForte = "chave-super-segura-gerada-aleatoriamente-2026-para-producao";

        JwtService service = assertDoesNotThrow(() ->
                new JwtService(secretForte, 900000L, env)
        );

        assertNotNull(service);
    }

    @Test
    @DisplayName("Caso 2: Secret ausente (null) em produção deve ser rejeitado com falha segura")
    void caso2_secretAusenteEmProducao_deveRejeitar() {
        MockEnvironment env = new MockEnvironment();
        env.setActiveProfiles("prod");

        IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
                new JwtService(null, 900000L, env)
        );

        assertTrue(ex.getMessage().contains("JWT_SECRET é mandatória e não foi fornecida"));
        assertTrue(ex.getMessage().contains("CRITICAL SECURITY CONFIGURATION ERROR"));
    }

    @Test
    @DisplayName("Caso 3: Secret vazio ou em branco em produção deve ser rejeitado")
    void caso3_secretVazioEmProducao_deveRejeitar() {
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
    @DisplayName("Caso 4: Secret inválido ou fraco (< 32 chars ou default) em produção deve ser rejeitado")
    void caso4_secretInvalidoOuFracoEmProducao_deveRejeitar() {
        MockEnvironment env = new MockEnvironment();
        env.setActiveProfiles("prod");

        // 4a. Secret com tamanho insuficiente (< 32 caracteres)
        IllegalStateException exCurto = assertThrows(IllegalStateException.class, () ->
                new JwtService("chave-curta-insegura-12345", 900000L, env)
        );
        assertTrue(exCurto.getMessage().contains("pelo menos 32 caracteres"));
        assertTrue(exCurto.getMessage().contains("no mínimo 32 caracteres"));

        // 4b. Secret padrão de desenvolvimento usado em produção
        IllegalStateException exPadrao = assertThrows(IllegalStateException.class, () ->
                new JwtService(JwtService.DEFAULT_DEV_SECRET, 900000L, env)
        );
        assertTrue(exPadrao.getMessage().contains("valor padrão de desenvolvimento é estritamente proibido"));
        assertTrue(exPadrao.getMessage().contains("O segredo JWT padrão de desenvolvimento foi detectado"));
    }

    @Test
    @DisplayName("Caso 5: Secret válido deve gerar JWT e validar o mesmo JWT com sucesso")
    void caso5_secretValido_gerarEValidarMesmoJwt_deveSerValido() {
        JwtService service = new JwtService("chave-secreta-de-testes-unificados-2026-com-tamanho-seguro", 900000L);
        com.oficinagestao.entity.Usuario usuario = new com.oficinagestao.entity.Usuario("Geisa", "geisa@oficina.com", "hash", true);
        org.springframework.test.util.ReflectionTestUtils.setField(usuario, "id", 101L);
        usuario.addRole(new com.oficinagestao.entity.Role("ROLE_ADMIN", "Admin"));

        String token = service.generateToken(usuario);

        assertNotNull(token);
        assertTrue(service.validateToken(token));
        assertEquals("geisa@oficina.com", service.extractEmail(token));
        assertEquals(101L, service.extractUserId(token));
        assertTrue(service.extractRoles(token).contains("ROLE_ADMIN"));
        assertFalse(service.isTokenExpired(token));
    }

    @Test
    @DisplayName("Caso 6: JWT assinado com secret diferente deve ser considerado inválido")
    void caso6_jwtAssinadoComSecretDiferente_deveSerInvalido() {
        String secretA = "chave-secreta-do-servidor-A-com-mais-de-32-caracteres-ok";
        String secretB = "chave-secreta-do-servidor-B-com-mais-de-32-caracteres-ok";

        JwtService serviceA = new JwtService(secretA, 900000L);
        JwtService serviceB = new JwtService(secretB, 900000L);

        com.oficinagestao.entity.Usuario usuario = new com.oficinagestao.entity.Usuario("Usuario", "user@oficina.com", "hash", true);
        org.springframework.test.util.ReflectionTestUtils.setField(usuario, "id", 202L);

        String tokenDoServidorA = serviceA.generateToken(usuario);

        // Válido no serviço emissor
        assertTrue(serviceA.validateToken(tokenDoServidorA));

        // Rejeitado no serviço receptor com chave diferente
        assertFalse(serviceB.validateToken(tokenDoServidorA));
    }

    @Test
    @DisplayName("Caso 7: Secret inválido não deve ser exposto na mensagem de erro ou log")
    void caso7_secretInvalido_naoDeveSerExpostoEmMensagemDeErro() {
        MockEnvironment env = new MockEnvironment();
        env.setActiveProfiles("prod");

        String secretInvalidoFraco = "senha-fraca-secreta-123";

        IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
                new JwtService(secretInvalidoFraco, 900000L, env)
        );

        // A mensagem de erro NUNCA deve expor o valor da chave secreta
        assertFalse(ex.getMessage().contains(secretInvalidoFraco),
                "VULNERABILIDADE: O valor do secret fornecido não pode ser vazado na mensagem de erro");
    }

    @Test
    @DisplayName("Caso 8: Em ambiente de desenvolvimento, deve permitir secret padrão com comodidade local")
    void caso8_desenvolvimento_devePermitirSecretPadrao() {
        MockEnvironment env = new MockEnvironment();
        env.setActiveProfiles("dev");

        assertDoesNotThrow(() ->
                new JwtService(JwtService.DEFAULT_DEV_SECRET, 900000L, env)
        );
    }
}
