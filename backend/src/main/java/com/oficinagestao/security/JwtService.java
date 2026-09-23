package com.oficinagestao.security;

import com.oficinagestao.entity.Role;
import com.oficinagestao.entity.Usuario;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Date;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class JwtService {

    public static final String DEFAULT_DEV_SECRET = "default-secret-key-oficina-gestao-dev-environment-2026-secure-token";
    public static final int MIN_SECRET_LENGTH = 32;

    private final SecretKey secretKey;
    private final long expirationMs;

    @Autowired
    public JwtService(
            @Value("${security.jwt.secret:default-secret-key-oficina-gestao-dev-environment-2026-secure-token}") String secret,
            @Value("${security.jwt.expiration-ms:900000}") long expirationMs,
            Environment environment
    ) {
        validarSecretParaAmbiente(secret, environment);
        this.secretKey = deriveKey(secret);
        this.expirationMs = expirationMs;
    }

    // Construtor de conveniência para testes unitários isolados
    public JwtService(String secret, long expirationMs) {
        this(secret, expirationMs, null);
    }

    public static boolean isProductionEnvironment(Environment environment) {
        if (environment != null && environment.acceptsProfiles(Profiles.of("prod", "production"))) {
            return true;
        }
        String envVar = System.getenv("ENVIRONMENT");
        return "prod".equalsIgnoreCase(envVar)
                || "production".equalsIgnoreCase(envVar)
                || Boolean.parseBoolean(System.getenv("RENDER"))
                || System.getenv("RAILWAY_ENVIRONMENT") != null;
    }

    public static void validarSecretParaAmbiente(String secret, Environment environment) {
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException("FALHA DE INICIALIZAÇÃO EM PRODUÇÃO (CRITICAL SECURITY CONFIGURATION ERROR): A variável de ambiente JWT_SECRET é mandatória e não foi fornecida.");
        }

        boolean isProduction = isProductionEnvironment(environment);

        if (isProduction) {
            if (DEFAULT_DEV_SECRET.equals(secret.trim())) {
                throw new IllegalStateException("FALHA DE SEGURANÇA EM PRODUÇÃO (CRITICAL SECURITY CONFIGURATION ERROR): O segredo JWT padrão de desenvolvimento foi detectado. O valor padrão de desenvolvimento é estritamente proibido em produção. Forneça uma chave secreta exclusiva via variável de ambiente JWT_SECRET.");
            }
            if (secret.trim().length() < MIN_SECRET_LENGTH) {
                throw new IllegalStateException("FALHA DE SEGURANÇA EM PRODUÇÃO (CRITICAL SECURITY CONFIGURATION ERROR): A chave JWT_SECRET em produção deve possuir no mínimo 32 caracteres (pelo menos 32 caracteres / 256 bits) para conformidade com HMAC-SHA256.");
            }
        }
    }

    private SecretKey deriveKey(String secret) {
        try {
            // Garante uma chave segura de 256 bits via SHA-256
            MessageDigest sha256 = MessageDigest.getInstance("SHA-256");
            byte[] hash = sha256.digest(secret.getBytes(StandardCharsets.UTF_8));
            return Keys.hmacShaKeyFor(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("Algoritmo SHA-256 não disponível", e);
        }
    }

    public String generateToken(Usuario usuario) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + expirationMs);

        List<String> roles = usuario.getRoles().stream()
                .map(Role::getNome)
                .collect(Collectors.toList());

        return Jwts.builder()
                .subject(usuario.getEmail())
                .claim("userId", usuario.getId())
                .claim("nome", usuario.getNome())
                .claim("roles", roles)
                .issuedAt(now)
                .expiration(expiryDate)
                .signWith(secretKey)
                .compact();
    }

    public boolean validateToken(String token) {
        try {
            Jwts.parser()
                    .verifyWith(secretKey)
                    .build()
                    .parseSignedClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    public String extractEmail(String token) {
        return extractClaims(token).getSubject();
    }

    public Long extractUserId(String token) {
        Claims claims = extractClaims(token);
        Object userId = claims.get("userId");
        if (userId instanceof Number number) {
            return number.longValue();
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    public Set<String> extractRoles(String token) {
        List<String> roles = extractClaims(token).get("roles", List.class);
        return roles != null ? Set.copyOf(roles) : Set.of();
    }

    public Claims extractClaims(String token) {
        return Jwts.parser()
                .verifyWith(secretKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public boolean isTokenExpired(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(secretKey)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            return claims.getExpiration().before(new Date());
        } catch (io.jsonwebtoken.ExpiredJwtException e) {
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    public long getExpirationMs() {
        return expirationMs;
    }
}
