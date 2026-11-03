package com.oficinagestao.security;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class ProxyClientContextVerifierTest {
    final String secret = "synthetic-shared-service-context-secret-2026";
    final Clock clock = Clock.fixed(Instant.parse("2026-11-03T12:00:00Z"), ZoneOffset.UTC);
    final ProxyClientContextVerifier verifier = new ProxyClientContextVerifier(secret, true, clock);
    MockHttpServletRequest request(String method, String path, long timestamp, String ip) throws Exception {
        var request = new MockHttpServletRequest(method, path);
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        String signature = HexFormat.of().formatHex(mac.doFinal((timestamp + "\n" + ip + "\n" + method + "\n" + path).getBytes(StandardCharsets.UTF_8)));
        request.addHeader("X-Oficina-Client-Context", "v1." + timestamp + "." + Base64.getUrlEncoder().withoutPadding()
                .encodeToString(ip.getBytes(StandardCharsets.UTF_8)) + "." + signature);
        return request;
    }
    @Test void acceptsAuthenticatedContextAndIgnoresUnsignedXff() throws Exception {
        var request = request("POST", "/api/auth/login", clock.instant().getEpochSecond(), "203.0.113.20");
        request.addHeader("X-Forwarded-For", "198.51.100.99");
        var resolver = new IpAddressResolver(List.of(), verifier);
        assertEquals("203.0.113.20", resolver.extrairIp(request));
    }
    @Test void rejectsTamperedSignatureMethodAndPath() throws Exception {
        var request = request("POST", "/api/auth/login", clock.instant().getEpochSecond(), "203.0.113.20");
        request.setMethod("GET"); assertThrows(SecurityException.class, () -> verifier.verifiedIp(request));
        request.setMethod("POST"); request.setRequestURI("/api/auth/2fa/verify");
        assertThrows(SecurityException.class, () -> verifier.verifiedIp(request));
        request.setRequestURI("/api/auth/login"); request.removeHeader("X-Oficina-Client-Context");
        request.addHeader("X-Oficina-Client-Context", "v1.1.invalid.invalid");
        assertThrows(SecurityException.class, () -> verifier.verifiedIp(request));
    }
    @Test void rejectsExpiredFutureAndMissingContexts() throws Exception {
        for (long delta : new long[]{-31, 6}) {
            var request = request("POST", "/api/auth/login", clock.instant().getEpochSecond() + delta, "203.0.113.20");
            assertThrows(SecurityException.class, () -> verifier.verifiedIp(request));
        }
        assertThrows(SecurityException.class, () -> verifier.verifiedIp(new MockHttpServletRequest("GET", "/api/clientes")));
    }
    @Test void cloudRunRequiresASeparateStrongServiceSecret() {
        assertThrows(IllegalStateException.class, () -> new ProxyClientContextVerifier("", true, clock));
        assertNull(new ProxyClientContextVerifier("", false, clock).verifiedIp(new MockHttpServletRequest("GET", "/api/clientes")));
        assertNull(verifier.verifiedIp(new MockHttpServletRequest("GET", "/api/health")));
    }
}
