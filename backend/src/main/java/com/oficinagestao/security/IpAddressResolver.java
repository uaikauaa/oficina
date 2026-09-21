package com.oficinagestao.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;

import java.util.regex.Pattern;

/**
 * Utilitário seguro para resolução do endereço IP real do cliente.
 * Suporta headers de proxy reverso padronizados (CF-Connecting-IP, X-Real-IP, X-Forwarded-For)
 * com proteção contra spoofing simples, validação de formato e fallback seguro.
 * <p>
 * Issue: AUDIT-005
 */
@Component
public class IpAddressResolver {

    private static final String DEFAULT_IP = "127.0.0.1";

    private static final Pattern IPV4_PATTERN = Pattern.compile(
            "^((25[0-5]|(2[0-4]|1\\d|[1-9]|)\\d)\\.){3}(25[0-5]|(2[0-4]|1\\d|[1-9]|)\\d)$"
    );

    private static final Pattern IPV6_PATTERN = Pattern.compile(
            "^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|" +
            "^::1$|" +
            "^(?:[0-9a-fA-F]{1,4}:)*:[0-9a-fA-F]{1,4}$"
    );

    /**
     * Extrai e valida o endereço IP do cliente a partir do request HTTP.
     *
     * @param request HttpServletRequest
     * @return IP formatado ou 127.0.0.1 em caso de ausência/invalidade
     */
    public String extrairIp(HttpServletRequest request) {
        if (request == null) {
            return DEFAULT_IP;
        }

        // 1. Cloudflare header prioritário (se presente)
        String cfConnectingIp = request.getHeader("CF-Connecting-IP");
        if (isIpValido(cfConnectingIp)) {
            return limparIp(cfConnectingIp);
        }

        // 2. X-Real-IP (comum em Nginx, Traefik, AWS ALB)
        String xRealIp = request.getHeader("X-Real-IP");
        if (isIpValido(xRealIp)) {
            return limparIp(xRealIp);
        }

        // 3. X-Forwarded-For (padrão de proxies reversos: client, proxy1, proxy2)
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            String[] ips = xForwardedFor.split(",");
            if (ips.length > 0) {
                String primeiroIp = ips[0].trim();
                if (isIpValido(primeiroIp)) {
                    return limparIp(primeiroIp);
                }
            }
        }

        // 4. Fallback para o endereço remoto nativo da conexão TCP / servlet wrapper
        String remoteAddr = request.getRemoteAddr();
        if (remoteAddr != null && !remoteAddr.isBlank()) {
            if ("0:0:0:0:0:0:0:1".equals(remoteAddr.trim())) {
                return DEFAULT_IP;
            }
            if (isIpValido(remoteAddr)) {
                return limparIp(remoteAddr);
            }
        }

        return DEFAULT_IP;
    }

    private boolean isIpValido(String ip) {
        if (ip == null || ip.isBlank()) {
            return false;
        }
        String limpo = limparIp(ip);
        if ("unknown".equalsIgnoreCase(limpo) || "null".equalsIgnoreCase(limpo)) {
            return false;
        }
        return IPV4_PATTERN.matcher(limpo).matches() || IPV6_PATTERN.matcher(limpo).matches() || "127.0.0.1".equals(limpo);
    }

    private String limparIp(String ip) {
        if (ip == null) return DEFAULT_IP;
        String limpo = ip.trim();
        // Remove porta de IPv4 se presente (ex: 192.168.1.1:8080)
        if (limpo.contains(":") && !limpo.contains("::") && limpo.indexOf(':') == limpo.lastIndexOf(':')) {
            limpo = limpo.substring(0, limpo.indexOf(':'));
        }
        return limpo;
    }
}
