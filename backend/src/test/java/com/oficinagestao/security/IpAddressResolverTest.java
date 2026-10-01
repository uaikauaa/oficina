package com.oficinagestao.security;

import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Testes unitários para IpAddressResolver (AUDIT-005 / SEC-03).
 *
 * <p>Organização:
 * <ul>
 *   <li>{@link SemProxiesConfigurados} — comportamento seguro sem lista de proxies (padrão)</li>
 *   <li>{@link ComProxiesConfigurados} — comportamento com proxies confiáveis configurados</li>
 *   <li>{@link ValidacaoDeFormato} — validação de formato IPv4 / IPv6</li>
 *   <li>{@link SegurancaContraspoofing} — testes específicos de prevenção de spoofing (SEC-03)</li>
 * </ul>
 */
class IpAddressResolverTest {

    // =========================================================================
    // Helpers
    // =========================================================================

    /** Resolver SEM proxies configurados (construtor no-args — comportamento padrão). */
    private IpAddressResolver semProxy() {
        return new IpAddressResolver();
    }

    /** Resolver COM o proxy configurado como confiável. */
    private IpAddressResolver comProxy(String... proxyIps) {
        return new IpAddressResolver(Set.of(proxyIps));
    }

    private HttpServletRequest req(String remoteAddr) {
        HttpServletRequest r = mock(HttpServletRequest.class);
        when(r.getRemoteAddr()).thenReturn(remoteAddr);
        return r;
    }

    private HttpServletRequest req(String remoteAddr, String cfConnecting, String xRealIp, String xff) {
        HttpServletRequest r = mock(HttpServletRequest.class);
        when(r.getRemoteAddr()).thenReturn(remoteAddr);
        when(r.getHeader("CF-Connecting-IP")).thenReturn(cfConnecting);
        when(r.getHeader("X-Real-IP")).thenReturn(xRealIp);
        when(r.getHeader("X-Forwarded-For")).thenReturn(xff);
        return r;
    }

    // =========================================================================
    // Testes originais preservados (AUDIT-005)
    // =========================================================================

    @Test
    @DisplayName("Request nulo deve retornar 127.0.0.1")
    void requestNuloRetornaDefault() {
        assertEquals("127.0.0.1", semProxy().extrairIp(null));
    }

    @Test
    @DisplayName("Sem headers de proxy deve retornar getRemoteAddr")
    void semHeadersRetornaRemoteAddr() {
        HttpServletRequest request = req("192.168.1.50");
        assertEquals("192.168.1.50", semProxy().extrairIp(request));
    }

    @Test
    @DisplayName("Loopback IPv6 deve ser normalizado para 127.0.0.1")
    void loopbackIpv6Normalizado() {
        HttpServletRequest request = req("0:0:0:0:0:0:0:1");
        assertEquals("127.0.0.1", semProxy().extrairIp(request));
    }

    @Test
    @DisplayName("CF-Connecting-IP é aceito quando remoteAddr pertence a proxy confiável")
    void cfConnectingIpAceitoDeProxyConfiavel() {
        // remoteAddr = 10.0.0.1 é proxy confiável → CF-Connecting-IP deve ser aceito
        IpAddressResolver resolver = comProxy("10.0.0.1");
        HttpServletRequest request = req("10.0.0.1", "198.51.100.1", "10.0.0.9", "10.0.0.2");
        assertEquals("198.51.100.1", resolver.extrairIp(request));
    }

    @Test
    @DisplayName("X-Real-IP é aceito quando CF-Connecting-IP ausente e remoteAddr é proxy confiável")
    void xRealIpAceitoDeProxyConfiavel() {
        IpAddressResolver resolver = comProxy("10.0.0.3");
        HttpServletRequest request = req("10.0.0.3", null, "198.51.100.2", "10.0.0.2");
        assertEquals("198.51.100.2", resolver.extrairIp(request));
    }

    @Test
    @DisplayName("X-Forwarded-For com IP único é aceito de proxy confiável")
    void xForwardedForUnicoDeProxyConfiavel() {
        IpAddressResolver resolver = comProxy("10.0.0.3");
        HttpServletRequest request = req("10.0.0.3", null, null, "203.0.113.195");
        assertEquals("203.0.113.195", resolver.extrairIp(request));
    }

    @Test
    @DisplayName("X-Forwarded-For com múltiplos IPs extrai o cliente real (não proxy)")
    void xForwardedForMultiplosIpsExtraiCliente() {
        // proxies: 10.0.0.1 e 172.16.0.1 são confiáveis; remoteAddr = 10.0.0.1
        IpAddressResolver resolver = comProxy("10.0.0.1", "172.16.0.1");
        HttpServletRequest request = req("10.0.0.1", null, null, "203.0.113.195, 172.16.0.1");
        assertEquals("203.0.113.195", resolver.extrairIp(request));
    }

    @Test
    @DisplayName("IP com porta em IPv4 deve ser sanitizado removendo a porta")
    void ipComPortaRemovida() {
        IpAddressResolver resolver = comProxy("10.0.0.3");
        HttpServletRequest request = req("10.0.0.3", null, null, "203.0.113.195:8080");
        assertEquals("203.0.113.195", resolver.extrairIp(request));
    }

    @Test
    @DisplayName("Header com valor inválido faz fallback seguro para getRemoteAddr (proxy confiável)")
    void headerInvalidoFallbackRemoteAddrDeProxy() {
        IpAddressResolver resolver = comProxy("10.0.0.3");
        HttpServletRequest request = req("10.0.0.3", null, null, "unknown");
        assertEquals("10.0.0.3", resolver.extrairIp(request));
    }

    @Test
    @DisplayName("Endereço IPv6 válido deve ser preservado (via proxy confiável)")
    void ipv6ValidoPreservado() {
        IpAddressResolver resolver = comProxy("10.0.0.3");
        HttpServletRequest request = req("10.0.0.3", null, null, "2001:db8::1");
        assertEquals("2001:db8::1", resolver.extrairIp(request));
    }

    // =========================================================================
    // SEC-03 — Testes específicos de prevenção de spoofing
    // =========================================================================

    @Nested
    @DisplayName("SEC-03 — Prevenção de IP Spoofing via headers falsificados")
    class SegurancaContraspoofing {

        /**
         * Cenário 1: Cliente direto falsifica CF-Connecting-IP.
         * remoteAddr NÃO pertence à lista de proxies → header deve ser IGNORADO.
         */
        @Test
        @DisplayName("1. Cliente direto falsificando CF-Connecting-IP → header ignorado, usa remoteAddr")
        void clienteDiretoFalsificaCfConnectingIpDeveSerIgnorado() {
            IpAddressResolver resolver = semProxy(); // sem proxy configurado
            HttpServletRequest request = req(
                    "192.168.1.50",     // remoteAddr real do cliente
                    "127.0.0.1",        // CF-Connecting-IP falsificado
                    null,
                    null
            );
            // Deve ignorar CF-Connecting-IP e retornar o remoteAddr real
            assertEquals("192.168.1.50", resolver.extrairIp(request));
        }

        /**
         * Cenário 2: Cliente direto falsifica X-Real-IP.
         */
        @Test
        @DisplayName("2. Cliente direto falsificando X-Real-IP → header ignorado, usa remoteAddr")
        void clienteDiretoFalsificaXRealIpDeveSerIgnorado() {
            IpAddressResolver resolver = semProxy();
            HttpServletRequest request = req(
                    "192.168.1.50",
                    null,
                    "10.0.0.1",   // X-Real-IP falsificado
                    null
            );
            assertEquals("192.168.1.50", resolver.extrairIp(request));
        }

        /**
         * Cenário 3: Cliente direto falsifica X-Forwarded-For.
         */
        @Test
        @DisplayName("3. Cliente direto falsificando X-Forwarded-For → header ignorado, usa remoteAddr")
        void clienteDiretoFalsificaXffDeveSerIgnorado() {
            IpAddressResolver resolver = semProxy();
            HttpServletRequest request = req(
                    "192.168.1.50",
                    null,
                    null,
                    "127.0.0.1, 10.0.0.1"   // XFF falsificado
            );
            assertEquals("192.168.1.50", resolver.extrairIp(request));
        }

        /**
         * Cenário 4: Requisição proveniente de proxy confiável + CF-Connecting-IP válido.
         */
        @Test
        @DisplayName("4. Proxy confiável + CF-Connecting-IP válido → IP do header utilizado")
        void proxyConfivelComCfConnectingIpValido() {
            IpAddressResolver resolver = comProxy("10.0.0.1");
            HttpServletRequest request = req(
                    "10.0.0.1",          // remoteAddr = proxy confiável (Cloudflare edge)
                    "203.0.113.50",      // CF-Connecting-IP = IP do cliente real
                    null,
                    null
            );
            assertEquals("203.0.113.50", resolver.extrairIp(request));
        }

        /**
         * Cenário 5: Proxy confiável + header com valor inválido → fallback seguro (remoteAddr do proxy).
         */
        @Test
        @DisplayName("5. Proxy confiável + CF-Connecting-IP inválido → fallback para remoteAddr do proxy")
        void proxyConfivelComCfConnectingIpInvalido() {
            IpAddressResolver resolver = comProxy("10.0.0.1");
            HttpServletRequest request = req(
                    "10.0.0.1",
                    "valor-invalido",    // CF-Connecting-IP inválido
                    null,
                    null
            );
            // Fallback: remoteAddr do proxy (não usa o header inválido)
            assertEquals("10.0.0.1", resolver.extrairIp(request));
        }

        /**
         * Cenário 6: Nenhum header → usa request.getRemoteAddr() sempre.
         */
        @Test
        @DisplayName("6. Sem nenhum header de proxy → usa getRemoteAddr()")
        void semNenhumHeaderUsaRemoteAddr() {
            IpAddressResolver resolver = semProxy();
            HttpServletRequest request = req("203.0.113.100");
            assertEquals("203.0.113.100", resolver.extrairIp(request));
        }

        /**
         * Cenário 7: IPv4 válido via proxy confiável.
         */
        @Test
        @DisplayName("7. IPv4 válido via proxy confiável → aceito corretamente")
        void ipv4ValidoViaProxy() {
            IpAddressResolver resolver = comProxy("10.0.0.1");
            HttpServletRequest request = req("10.0.0.1", "198.51.100.42", null, null);
            assertEquals("198.51.100.42", resolver.extrairIp(request));
        }

        /**
         * Cenário 8: IPv6 válido via proxy confiável.
         */
        @Test
        @DisplayName("8. IPv6 válido via proxy confiável → aceito corretamente")
        void ipv6ValidoViaProxy() {
            IpAddressResolver resolver = comProxy("10.0.0.1");
            HttpServletRequest request = req("10.0.0.1", "2001:db8::cafe", null, null);
            assertEquals("2001:db8::cafe", resolver.extrairIp(request));
        }

        /**
         * Cenário 9: X-Forwarded-For com múltiplos valores — extrai o cliente não-proxy.
         * O cliente pode tentar injetar IPs no início da cadeia; o sistema deve ignorar
         * valores à esquerda que parecem legítimos mas vêm de clientes diretos.
         */
        @Test
        @DisplayName("9. X-Forwarded-For com múltiplos valores → extrai cliente real ignorando proxies")
        void xffMultiplosValoresExtraiClienteReal() {
            // Proxies confiáveis: 10.0.0.1, 10.0.0.2
            IpAddressResolver resolver = comProxy("10.0.0.1", "10.0.0.2");
            // XFF: "203.0.113.50, 10.0.0.2"  (cliente → proxy2)
            // remoteAddr = 10.0.0.1 (proxy1 mais próximo ao servidor)
            HttpServletRequest request = req("10.0.0.1", null, null, "203.0.113.50, 10.0.0.2");
            assertEquals("203.0.113.50", resolver.extrairIp(request));
        }

        /**
         * Cenário 10: Nenhum mecanismo de spoofing funciona — prova end-to-end.
         * Cliente direto com TODOS os headers falsificados: nenhum deve ser aceito.
         */
        @Test
        @DisplayName("10. Todos os headers falsificados por cliente direto → todos ignorados")
        void todosFalsificadosClienteDiretoDeveUsarRemoteAddr() {
            IpAddressResolver resolver = semProxy();
            HttpServletRequest request = req(
                    "192.168.99.1",      // remoteAddr real do cliente malicioso
                    "127.0.0.1",         // CF-Connecting-IP falsificado (tenta bypass local)
                    "10.0.0.1",          // X-Real-IP falsificado
                    "1.2.3.4, 5.6.7.8"  // X-Forwarded-For falsificado
            );
            // Nenhum header é aceito — retorna o remoteAddr TCP real
            assertEquals("192.168.99.1", resolver.extrairIp(request));
        }

        /**
         * Verificação adicional: proxy não na lista também não habilita headers.
         */
        @Test
        @DisplayName("Proxy não registrado também não habilita leitura de headers")
        void proxyNaoRegistradoNaoHabilitaHeaders() {
            // Proxy confiável configurado é 10.0.0.1; requisição vem de 10.0.0.99
            IpAddressResolver resolver = comProxy("10.0.0.1");
            HttpServletRequest request = req(
                    "10.0.0.99",         // remoteAddr NÃO está na lista
                    "203.0.113.50",      // CF-Connecting-IP
                    null,
                    null
            );
            // 10.0.0.99 não é proxy confiável → header ignorado → retorna 10.0.0.99
            assertEquals("10.0.0.99", resolver.extrairIp(request));
        }
    }

    // =========================================================================
    // Validação de formato
    // =========================================================================

    @Nested
    @DisplayName("Validação de formato IPv4 / IPv6")
    class ValidacaoDeFormato {

        @Test
        @DisplayName("isIpValido: null e blank são inválidos")
        void nullEBlankInvalidos() {
            IpAddressResolver resolver = semProxy();
            assertFalse(resolver.isIpValido(null));
            assertFalse(resolver.isIpValido(""));
            assertFalse(resolver.isIpValido("   "));
        }

        @Test
        @DisplayName("isIpValido: 'unknown' e 'null' são inválidos")
        void unknownENullInvalidos() {
            IpAddressResolver resolver = semProxy();
            assertFalse(resolver.isIpValido("unknown"));
            assertFalse(resolver.isIpValido("UNKNOWN"));
            assertFalse(resolver.isIpValido("null"));
        }

        @Test
        @DisplayName("isIpValido: IPv4 válido")
        void ipv4Valido() {
            IpAddressResolver resolver = semProxy();
            assertTrue(resolver.isIpValido("192.168.1.1"));
            assertTrue(resolver.isIpValido("255.255.255.255"));
            assertTrue(resolver.isIpValido("203.0.113.50"));
        }

        @Test
        @DisplayName("isIpValido: IPv6 válido")
        void ipv6Valido() {
            IpAddressResolver resolver = semProxy();
            assertTrue(resolver.isIpValido("2001:db8::1"));
            assertTrue(resolver.isIpValido("::1"));
        }

        @Test
        @DisplayName("isTrustedProxy: lista vazia nunca é confiável")
        void listaVaziaNuncaConfiavel() {
            IpAddressResolver resolver = semProxy();
            assertFalse(resolver.isTrustedProxy("10.0.0.1"));
            assertFalse(resolver.isTrustedProxy("127.0.0.1"));
            assertFalse(resolver.isTrustedProxy(null));
        }

        @Test
        @DisplayName("isTrustedProxy: apenas IPs na lista são confiáveis")
        void apenasIpsDaListaSaoConfiáveis() {
            IpAddressResolver resolver = comProxy("10.0.0.1", "172.16.0.5");
            assertTrue(resolver.isTrustedProxy("10.0.0.1"));
            assertTrue(resolver.isTrustedProxy("172.16.0.5"));
            assertFalse(resolver.isTrustedProxy("10.0.0.2"));
            assertFalse(resolver.isTrustedProxy("192.168.1.1"));
        }
    }
}
