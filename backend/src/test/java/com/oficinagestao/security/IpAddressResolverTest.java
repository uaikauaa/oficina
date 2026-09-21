package com.oficinagestao.security;

import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Testes unitários para IpAddressResolver (AUDIT-005).
 */
class IpAddressResolverTest {

    private IpAddressResolver resolver;
    private HttpServletRequest request;

    @BeforeEach
    void setUp() {
        resolver = new IpAddressResolver();
        request = mock(HttpServletRequest.class);
    }

    @Test
    @DisplayName("Request nulo deve retornar 127.0.0.1")
    void requestNuloRetornaDefault() {
        assertEquals("127.0.0.1", resolver.extrairIp(null));
    }

    @Test
    @DisplayName("Sem headers de proxy deve retornar getRemoteAddr")
    void semHeadersRetornaRemoteAddr() {
        when(request.getRemoteAddr()).thenReturn("192.168.1.50");

        assertEquals("192.168.1.50", resolver.extrairIp(request));
    }

    @Test
    @DisplayName("Loopback IPv6 deve ser normalizado para 127.0.0.1")
    void loopbackIpv6Normalizado() {
        when(request.getRemoteAddr()).thenReturn("0:0:0:0:0:0:0:1");

        assertEquals("127.0.0.1", resolver.extrairIp(request));
    }

    @Test
    @DisplayName("CF-Connecting-IP deve ter prioridade máxima")
    void cfConnectingIpPrioritario() {
        when(request.getHeader("CF-Connecting-IP")).thenReturn("198.51.100.1");
        when(request.getHeader("X-Real-IP")).thenReturn("10.0.0.1");
        when(request.getHeader("X-Forwarded-For")).thenReturn("10.0.0.2");
        when(request.getRemoteAddr()).thenReturn("10.0.0.3");

        assertEquals("198.51.100.1", resolver.extrairIp(request));
    }

    @Test
    @DisplayName("X-Real-IP deve ser utilizado quando CF-Connecting-IP ausente")
    void xRealIpUtilizado() {
        when(request.getHeader("X-Real-IP")).thenReturn("198.51.100.2");
        when(request.getHeader("X-Forwarded-For")).thenReturn("10.0.0.2");
        when(request.getRemoteAddr()).thenReturn("10.0.0.3");

        assertEquals("198.51.100.2", resolver.extrairIp(request));
    }

    @Test
    @DisplayName("X-Forwarded-For com IP único deve extrair o IP")
    void xForwardedForUnico() {
        when(request.getHeader("X-Forwarded-For")).thenReturn("203.0.113.195");
        when(request.getRemoteAddr()).thenReturn("10.0.0.3");

        assertEquals("203.0.113.195", resolver.extrairIp(request));
    }

    @Test
    @DisplayName("X-Forwarded-For com múltiplos IPs deve extrair o primeiro IP (cliente real)")
    void xForwardedForMultiplosIps() {
        when(request.getHeader("X-Forwarded-For")).thenReturn("203.0.113.195, 10.0.0.1, 172.16.0.1");
        when(request.getRemoteAddr()).thenReturn("10.0.0.3");

        assertEquals("203.0.113.195", resolver.extrairIp(request));
    }

    @Test
    @DisplayName("IP com porta em IPv4 deve ser sanitizado removendo a porta")
    void ipComPortaRemovida() {
        when(request.getHeader("X-Forwarded-For")).thenReturn("203.0.113.195:8080");
        when(request.getRemoteAddr()).thenReturn("10.0.0.3");

        assertEquals("203.0.113.195", resolver.extrairIp(request));
    }

    @Test
    @DisplayName("Header com valor inválido deve fazer fallback seguro para getRemoteAddr")
    void headerInvalidoFallbackRemoteAddr() {
        when(request.getHeader("X-Forwarded-For")).thenReturn("unknown");
        when(request.getRemoteAddr()).thenReturn("192.168.1.100");

        assertEquals("192.168.1.100", resolver.extrairIp(request));
    }

    @Test
    @DisplayName("Endereço IPv6 válido deve ser preservado")
    void ipv6ValidoPreservado() {
        when(request.getHeader("X-Forwarded-For")).thenReturn("2001:db8::1");
        when(request.getRemoteAddr()).thenReturn("10.0.0.3");

        assertEquals("2001:db8::1", resolver.extrairIp(request));
    }
}
