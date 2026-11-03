package com.oficinagestao.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Date;
import static org.junit.jupiter.api.Assertions.*;

class JwtBoundaryAuditTest {
    @Test void rejectsUnsignedTamperedFutureExpiredAndWrongAlgorithmTokens() throws Exception {
        String secret = "independent-jwt-boundary-audit-synthetic-key-2026";
        var service = new JwtService(secret, 900000L);
        var key = Keys.hmacShaKeyFor(MessageDigest.getInstance("SHA-256").digest(secret.getBytes(StandardCharsets.UTF_8)));
        long now = System.currentTimeMillis();
        java.util.function.Supplier<io.jsonwebtoken.JwtBuilder> claims = () -> Jwts.builder()
                .subject("audit@oficina.invalid").issuer(JwtService.ISSUER)
                .audience().add(JwtService.AUDIENCE).and()
                .issuedAt(new Date(now - 1000)).expiration(new Date(now + 60000));
        assertFalse(service.validateToken(claims.get().compact()));
        assertFalse(service.validateToken(claims.get().issuedAt(new Date(now + 60000)).signWith(key).compact()));
        assertFalse(service.validateToken(claims.get().notBefore(new Date(now + 60000)).signWith(key).compact()));
        assertFalse(service.validateToken(claims.get().expiration(new Date(now - 500)).signWith(key).compact()));
        var wideKey = Keys.hmacShaKeyFor(MessageDigest.getInstance("SHA-512").digest(secret.getBytes(StandardCharsets.UTF_8)));
        assertFalse(service.validateToken(claims.get().signWith(wideKey, Jwts.SIG.HS512).compact()));
        String valid = claims.get().signWith(key, Jwts.SIG.HS256).compact();
        assertTrue(service.validateToken(valid));
        String[] parts = valid.split("\\.");
        String payload = java.util.Base64.getUrlEncoder().withoutPadding().encodeToString("{\"sub\":\"admin@oficina.invalid\"}".getBytes(StandardCharsets.UTF_8));
        assertFalse(service.validateToken(parts[0] + "." + payload + "." + parts[2]));
    }
}
