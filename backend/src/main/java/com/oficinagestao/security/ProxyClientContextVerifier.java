package com.oficinagestao.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.util.Base64;
import java.util.HexFormat;

/** Authenticates the frontend's client context independently of user JWTs and Google IAM. */
@Component
public class ProxyClientContextVerifier {
    private final String secret;
    private final boolean required;
    private final Clock clock;
    @Autowired
    public ProxyClientContextVerifier(@Value("${security.proxy.secret:}") String secret, Environment environment) {
        this(secret, environment.containsProperty("K_SERVICE"), Clock.systemUTC());
    }
    ProxyClientContextVerifier(String secret, boolean required, Clock clock) {
        if ((required || !secret.isBlank()) && secret.length() < 32) throw new IllegalStateException("SERVICE_PROXY_SECRET must have at least 32 characters");
        this.secret = secret; this.required = required; this.clock = clock;
    }
    String verifiedIp(HttpServletRequest request) {
        if (secret.isBlank() && !required) return null;
        // Cloud Run health probes and read-only IAM checks carry no application client context.
        if ("/api/health".equals(request.getRequestURI())) return null;
        String header = request.getHeader("X-Oficina-Client-Context");
        if (header == null && !required) return null;
        if (secret.isBlank() && !required) return null;
        try {
            if (header == null || header.length() > 256) throw new IllegalArgumentException();
            String[] parts = header.split("\\.");
            if (parts.length != 4 || !parts[0].equals("v1")) throw new IllegalArgumentException();
            long timestamp = Long.parseLong(parts[1]), now = clock.instant().getEpochSecond();
            if (timestamp < now - 30 || timestamp > now + 5) throw new IllegalArgumentException();
            String ip = new String(Base64.getUrlDecoder().decode(parts[2]), StandardCharsets.UTF_8);
            if (!ip.matches("[0-9a-fA-F:.]{3,45}") || (!ip.contains(":") && !ip.matches("[0-9.]+"))) throw new IllegalArgumentException();
            java.net.InetAddress.getByName(ip); // Input is restricted to literal IP characters; no DNS names.
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] expected = mac.doFinal((parts[1] + "\n" + ip + "\n" + request.getMethod() + "\n" + request.getRequestURI()).getBytes(StandardCharsets.UTF_8));
            if (!MessageDigest.isEqual(expected, HexFormat.of().parseHex(parts[3]))) throw new IllegalArgumentException();
            return ip;
        } catch (Exception e) { throw new SecurityException("Invalid service client context"); }
    }
}
