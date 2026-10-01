package com.oficinagestao.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Testes de segurança e unidade para LoginAttemptService (SEC-02).
 */
class LoginAttemptServiceTest {

    private LoginAttemptService loginAttemptService;

    @BeforeEach
    void setUp() {
        // 5 tentativas máximas, 15 minutos de bloqueio, cache máx 10.000
        loginAttemptService = new LoginAttemptService(5, 15);
    }

    @Test
    @DisplayName("1. Primeira tentativa inválida não deve bloquear")
    void primeiraTentativaInvalidaNaoDeveBloquear() {
        String ip = "192.168.1.100";
        String email = "admin@oficina.com";

        assertFalse(loginAttemptService.isBlocked(ip, email));

        loginAttemptService.loginFailed(ip, email);

        assertFalse(loginAttemptService.isBlocked(ip, email));
        assertEquals(1, loginAttemptService.getAttemptsForKey(loginAttemptService.buildIpKey(ip)));
        assertEquals(1, loginAttemptService.getAttemptsForKey(loginAttemptService.buildIpEmailKey(ip, email)));
    }

    @Test
    @DisplayName("2. Quatro tentativas consecutivas não devem bloquear")
    void quatroTentativasNaoDevemBloquear() {
        String ip = "192.168.1.101";
        String email = "admin2@oficina.com";

        for (int i = 0; i < 4; i++) {
            loginAttemptService.loginFailed(ip, email);
            assertFalse(loginAttemptService.isBlocked(ip, email));
        }

        assertEquals(4, loginAttemptService.getAttemptsForKey(loginAttemptService.buildIpKey(ip)));
    }

    @Test
    @DisplayName("3. Cinco tentativas consecutivas devem bloquear IP e o par IP+Email")
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
    @DisplayName("4. Tentativa adicional durante bloqueio deve manter status de bloqueado")
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
    @DisplayName("5. Login bem-sucedido deve resetar contador de tentativas")
    void loginBemSucedidoDeveResetarContador() {
        String ip = "192.168.1.104";
        String email = "admin5@oficina.com";

        for (int i = 0; i < 3; i++) {
            loginAttemptService.loginFailed(ip, email);
        }

        assertEquals(3, loginAttemptService.getAttemptsForKey(loginAttemptService.buildIpKey(ip)));

        loginAttemptService.loginSucceeded(ip, email);

        assertEquals(0, loginAttemptService.getAttemptsForKey(loginAttemptService.buildIpKey(ip)));
        assertEquals(0, loginAttemptService.getAttemptsForKey(loginAttemptService.buildIpEmailKey(ip, email)));
        assertFalse(loginAttemptService.isBlocked(ip, email));
    }

    @Test
    @DisplayName("6. Atacante alterando e-mail deve continuar bloqueado por IP (proteção contra password spraying)")
    void atacanteAlterandoEmailDeveContinuarBloqueadoPorIp() {
        String ip = "200.20.10.5";

        // 5 falhas com e-mails diferentes a partir do mesmo IP
        for (int i = 0; i < 5; i++) {
            loginAttemptService.loginFailed(ip, "usuario" + i + "@oficina.com");
        }

        // Tenta com um novo e-mail a partir do mesmo IP
        assertTrue(loginAttemptService.isBlocked(ip, "outro_email@oficina.com"));
    }

    @Test
    @DisplayName("7. SEC-02: Atacante em IP malicioso NÃO deve provocar Account Lockout DoS em usuário legítimo de outro IP")
    void tentativasDeIpAtacanteNaoDevemBloquearUsuarioLegitimoEmOutroIp() {
        String emailVitima = "admin_alvo@oficina.com";
        String ipAtacante = "198.51.100.99";
        String ipUsuarioLegitimo = "203.0.113.10";

        // Atacante gera 5 falhas consecutivas contra o e-mail da vítima
        for (int i = 0; i < 5; i++) {
            loginAttemptService.loginFailed(ipAtacante, emailVitima);
        }

        // O atacante deve estar bloqueado
        assertTrue(loginAttemptService.isBlocked(ipAtacante, emailVitima));
        assertTrue(loginAttemptService.isBlocked(ipAtacante, "qualquer_outro@oficina.com"));

        // O usuário legítimo acessando do seu próprio IP NÃO deve estar bloqueado (evita DoS de conta)
        assertFalse(loginAttemptService.isBlocked(ipUsuarioLegitimo, emailVitima));
    }

    @Test
    @DisplayName("8. Estado expirado deixa de bloquear automaticamente na verificação")
    void estadoExpiradoDeixaDeBloquear() {
        // Serviço com duração de bloqueio 0 minutos (expiração imediata)
        LoginAttemptService shortLivedService = new LoginAttemptService(5, 0);
        String ip = "192.168.1.150";
        String email = "expiracao@oficina.com";

        for (int i = 0; i < 5; i++) {
            shortLivedService.loginFailed(ip, email);
        }

        // Como o tempo expirou de imediato, a verificação limpa e retorna false
        assertFalse(shortLivedService.isBlocked(ip, email));
    }

    @Test
    @DisplayName("9. Rotina periódica agendada (scheduledCleanup) remove entradas expiradas")
    void scheduledCleanupDeveRemoverEntradasExpiradas() {
        LoginAttemptService shortLivedService = new LoginAttemptService(5, 0);
        shortLivedService.loginFailed("192.168.1.201", "expirado@oficina.com");
        assertTrue(shortLivedService.getAttemptsCacheSize() > 0);

        shortLivedService.scheduledCleanup();
        assertEquals(0, shortLivedService.getAttemptsCacheSize());
    }

    @Test
    @DisplayName("10. Múltiplos IPs não compartilham indevidamente o mesmo contador")
    void multiplosIpsNaoCompartilhamOMesmoContador() {
        String ip1 = "10.0.0.1";
        String ip2 = "10.0.0.2";
        String email = "compartilhado@oficina.com";

        for (int i = 0; i < 3; i++) {
            loginAttemptService.loginFailed(ip1, email);
        }
        for (int i = 0; i < 2; i++) {
            loginAttemptService.loginFailed(ip2, email);
        }

        assertEquals(3, loginAttemptService.getAttemptsForKey(loginAttemptService.buildIpKey(ip1)));
        assertEquals(2, loginAttemptService.getAttemptsForKey(loginAttemptService.buildIpKey(ip2)));
        assertFalse(loginAttemptService.isBlocked(ip1, email));
        assertFalse(loginAttemptService.isBlocked(ip2, email));

        // Mais 2 falhas no IP 1 -> bloqueia apenas IP 1
        loginAttemptService.loginFailed(ip1, email);
        loginAttemptService.loginFailed(ip1, email);

        assertTrue(loginAttemptService.isBlocked(ip1, email));
        assertFalse(loginAttemptService.isBlocked(ip2, email));
    }

    @Test
    @DisplayName("11. Proteção contra saturação de memória: eviction desaloja entradas antigas se atingir limite máximo")
    void devePrevenirCrescimentoIlimitadoDeMemoria() {
        int maxCapacity = 20;
        LoginAttemptService limitedService = new LoginAttemptService(5, 15, maxCapacity);

        // Insere tentativas de 30 IPs diferentes (cada uma gera ip e ip_email)
        for (int i = 0; i < 30; i++) {
            limitedService.loginFailed("10.1.1." + i, "user" + i + "@oficina.com");
        }

        // O tamanho do cache nunca deve explodir além de limites razoáveis de segurança
        assertTrue(limitedService.getAttemptsCacheSize() <= maxCapacity + 2,
                "O cache de tentativas deve respeitar a capacidade máxima configurada.");
    }

    @Test
    @DisplayName("12. Concorrência: múltiplas threads simultâneas incrementam de forma thread-safe sem race conditions")
    void concorrenciaDeveSerThreadSafe() throws InterruptedException {
        int threads = 10;
        ExecutorService executor = Executors.newFixedThreadPool(threads);
        CountDownLatch latch = new CountDownLatch(threads);

        String ip = "172.16.0.50";
        String email = "concorrente@oficina.com";

        for (int i = 0; i < threads; i++) {
            executor.submit(() -> {
                try {
                    loginAttemptService.loginFailed(ip, email);
                } finally {
                    latch.countDown();
                }
            });
        }

        boolean finished = latch.await(5, TimeUnit.SECONDS);
        executor.shutdown();

        assertTrue(finished);
        assertEquals(threads, loginAttemptService.getAttemptsForKey(loginAttemptService.buildIpKey(ip)));
        assertTrue(loginAttemptService.isBlocked(ip, email));
    }

    @Test
    @DisplayName("13. resetAll limpa o estado completamente, simulando comportamento limpo de restart")
    void resetAllDeveLimparEstado() {
        loginAttemptService.loginFailed("192.168.1.99", "admin@oficina.com");
        assertTrue(loginAttemptService.getAttemptsCacheSize() > 0);

        loginAttemptService.resetAll();
        assertEquals(0, loginAttemptService.getAttemptsCacheSize());
        assertFalse(loginAttemptService.isBlocked("192.168.1.99", "admin@oficina.com"));
    }
}
