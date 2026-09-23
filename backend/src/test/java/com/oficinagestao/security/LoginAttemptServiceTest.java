package com.oficinagestao.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Testes unitários para LoginAttemptService (ISSUE-003).
 */
class LoginAttemptServiceTest {

    private LoginAttemptService loginAttemptService;

    @BeforeEach
    void setUp() {
        // 5 tentativas máximas, 15 minutos de bloqueio
        loginAttemptService = new LoginAttemptService(5, 15);
    }

    @Test
    @DisplayName("Primeira tentativa inválida não deve bloquear")
    void primeiraTentativaInvalidaNaoDeveBloquear() {
        String ip = "192.168.1.100";
        String email = "admin@oficina.com";

        assertFalse(loginAttemptService.isBlocked(ip, email));

        loginAttemptService.loginFailed(ip, email);

        assertFalse(loginAttemptService.isBlocked(ip, email));
        assertEquals(1, loginAttemptService.getAttemptsForKey("ip:" + ip));
        assertEquals(1, loginAttemptService.getAttemptsForKey("email:" + email));
    }

    @Test
    @DisplayName("Quatro tentativas consecutivas não devem bloquear")
    void quatroTentativasNaoDevemBloquear() {
        String ip = "192.168.1.101";
        String email = "admin2@oficina.com";

        for (int i = 0; i < 4; i++) {
            loginAttemptService.loginFailed(ip, email);
            assertFalse(loginAttemptService.isBlocked(ip, email));
        }

        assertEquals(4, loginAttemptService.getAttemptsForKey("ip:" + ip));
    }

    @Test
    @DisplayName("Cinco tentativas consecutivas devem bloquear IP e E-mail")
    void cincoTentativasDevemBloquear() {
        String ip = "192.168.1.102";
        String email = "admin3@oficina.com";

        for (int i = 0; i < 5; i++) {
            loginAttemptService.loginFailed(ip, email);
        }

        assertTrue(loginAttemptService.isBlocked(ip, email));
        assertTrue(loginAttemptService.getRemainingLockMinutes(ip, email) > 0);
    }

    @Test
    @DisplayName("Tentativa durante bloqueio deve manter status de bloqueado")
    void tentativaDuranteBloqueioDevePermanecerBloqueado() {
        String ip = "192.168.1.103";
        String email = "admin4@oficina.com";

        for (int i = 0; i < 5; i++) {
            loginAttemptService.loginFailed(ip, email);
        }

        assertTrue(loginAttemptService.isBlocked(ip, email));

        // Nova tentativa enquanto bloqueado
        loginAttemptService.loginFailed(ip, email);

        assertTrue(loginAttemptService.isBlocked(ip, email));
    }

    @Test
    @DisplayName("Login bem-sucedido deve resetar contador de tentativas")
    void loginBemSucedidoDeveResetarContador() {
        String ip = "192.168.1.104";
        String email = "admin5@oficina.com";

        for (int i = 0; i < 3; i++) {
            loginAttemptService.loginFailed(ip, email);
        }

        assertEquals(3, loginAttemptService.getAttemptsForKey("ip:" + ip));

        loginAttemptService.loginSucceeded(ip, email);

        assertEquals(0, loginAttemptService.getAttemptsForKey("ip:" + ip));
        assertEquals(0, loginAttemptService.getAttemptsForKey("email:" + email));
        assertFalse(loginAttemptService.isBlocked(ip, email));
    }

    @Test
    @DisplayName("Atacante alterando e-mail deve continuar bloqueado por IP")
    void atacanteAlterandoEmailDeveContinuarBloqueadoPorIp() {
        String ip = "200.20.10.5";

        // 5 falhas com email A
        for (int i = 0; i < 5; i++) {
            loginAttemptService.loginFailed(ip, "email_a@oficina.com");
        }

        // Tenta com email B a partir do mesmo IP
        assertTrue(loginAttemptService.isBlocked(ip, "email_b@oficina.com"));
    }

    @Test
    @DisplayName("Atacante alterando IP contra mesma conta administrativa deve continuar bloqueado por E-mail")
    void atacanteAlterandoIpDeveContinuarBloqueadoPorEmail() {
        String email = "admin_alvo@oficina.com";

        // 5 falhas vindas de IP A
        for (int i = 0; i < 5; i++) {
            loginAttemptService.loginFailed("10.0.0.1", email);
        }

        // Tenta atacar a mesma conta a partir de um IP B diferente
        assertTrue(loginAttemptService.isBlocked("10.0.0.2", email));
    }

    @Test
    @DisplayName("cleanupExpiredEntries: deve remover do cache entradas não bloqueadas com última tentativa expirada")
    void deveLimparEntradasExpiradasDoCache() {
        // Registra uma tentativa simples (não bloqueada)
        loginAttemptService.loginFailed("192.168.1.200", "temporario@oficina.com");
        assertTrue(loginAttemptService.getAttemptsCacheSize() > 0);

        // Se chamarmos o cleanup imediatamente, nada deve ser removido porque não passou o lockDuration
        int removidosImediatos = loginAttemptService.cleanupExpiredEntries();
        assertEquals(0, removidosImediatos);

        // Instancia um serviço com lockDuration de 0 minutos para simular expiração imediata
        LoginAttemptService shortLivedService = new LoginAttemptService(5, 0);
        shortLivedService.loginFailed("192.168.1.201", "expirado@oficina.com");
        assertTrue(shortLivedService.getAttemptsCacheSize() > 0);

        int removidos = shortLivedService.cleanupExpiredEntries();
        assertTrue(removidos >= 2); // chave ip e chave email
        assertEquals(0, shortLivedService.getAttemptsCacheSize());
    }
}
