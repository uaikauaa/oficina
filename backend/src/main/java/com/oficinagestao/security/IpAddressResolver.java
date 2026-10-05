package com.oficinagestao.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Utilitário seguro para resolução do endereço IP real do cliente.
 *
 * <p><b>SEC-03 — Correção de IP Spoofing / Trusted Proxy:</b><br>
 * Headers de proxy reverso ({@code CF-Connecting-IP}, {@code X-Real-IP}, {@code X-Forwarded-For})
 * somente são considerados quando a requisição chega de um endereço {@code remoteAddr} que
 * pertence explicitamente à lista {@code security.trusted-proxies}.
 *
 * <p>Quando a origem imediata <em>não</em> for um proxy confiável, todos os headers são
 * ignorados e o IP real retornado é {@code request.getRemoteAddr()}, impossibilitando
 * o bypass de rate-limiting ou auditoria via headers falsificados.
 *
 * <p>Issue: AUDIT-005 / SEC-03
 */
@Component
public class IpAddressResolver {

    static final String DEFAULT_IP = "127.0.0.1";

    private static final Pattern IPV4_PATTERN = Pattern.compile(
            "^((25[0-5]|(2[0-4]|1\\d|[1-9]|)\\d)\\.){3}(25[0-5]|(2[0-4]|1\\d|[1-9]|)\\d)$"
    );

    private static final Pattern IPV6_PATTERN = Pattern.compile(
            "^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|" +
            "^::1$|" +
            "^(?:[0-9a-fA-F]{1,4}:)*:[0-9a-fA-F]{1,4}$"
    );

    /**
     * Conjunto imutável de endereços IP de proxies confiáveis.
     * Configurável via {@code security.trusted-proxies} (lista separada por vírgula).
     * Se vazio, nenhum header de proxy é aceito — comportamento seguro por padrão.
     */
    private final Set<String> trustedProxies;

    /**
     * Construtor Spring principal — recebe a lista de proxies confiáveis das propriedades.
     *
     * @param trustedProxyList lista de IPs confiáveis injetada de {@code security.trusted-proxies}
     */
    @Autowired
    public IpAddressResolver(
            @Value("${security.trusted-proxies:}") List<String> trustedProxyList
    ) {
        this.trustedProxies = buildTrustedSet(trustedProxyList);
    }

    /**
     * Construtor sem-args para uso em construtores legados de services/controllers que
     * instanciam {@code new IpAddressResolver()} diretamente (sem Spring Context).
     *
     * <p>Usa lista <em>vazia</em> de proxies — comportamento 100% seguro:
     * nenhum header de proxy será aceito; sempre retorna {@code remoteAddr}.
     */
    public IpAddressResolver() {
        this.trustedProxies = Collections.emptySet();
    }

    /**
     * Construtor package-private para testes unitários e de integração que precisam
     * injetar proxies confiáveis sem depender do contexto Spring.
     *
     * <p>Recebe um {@code Set<String>} (diferente de {@code List<String>} do construtor Spring)
     * para evitar ambiguidade de assinatura.
     *
     * @param trustedProxySet conjunto de IPs de proxies confiáveis
     */
    IpAddressResolver(Set<String> trustedProxySet) {
        this.trustedProxies = trustedProxySet != null
                ? Collections.unmodifiableSet(new HashSet<>(trustedProxySet))
                : Collections.emptySet();
    }

    private static Set<String> buildTrustedSet(Collection<String> list) {
        if (list == null || list.isEmpty()) {
            return Collections.emptySet();
        }
        Set<String> set = new HashSet<>();
        for (String proxy : list) {
            String trimmed = proxy.trim();
            if (!trimmed.isEmpty()) {
                set.add(trimmed);
            }
        }
        return Collections.unmodifiableSet(set);
    }

    /**
     * Extrai e valida o endereço IP do cliente a partir do request HTTP.
     *
     * <p>O IP real do cliente somente é derivado de headers de proxy quando a conexão
     * TCP imediata ({@code remoteAddr}) pertence à lista de proxies confiáveis
     * ({@code security.trusted-proxies}). Caso contrário, {@code remoteAddr} é
     * retornado diretamente, independentemente de quaisquer headers presentes.
     *
     * @param request HttpServletRequest
     * @return IP do cliente (IPv4 ou IPv6) ou {@value DEFAULT_IP} em caso de ausência/invalidade
     */
    public String extrairIp(HttpServletRequest request) {
        if (request == null) {
            return DEFAULT_IP;
        }

        String remoteAddr = resolverRemoteAddr(request.getRemoteAddr());

        // SEC-03: Somente aceita headers de proxy quando a origem imediata é confiável.
        if (!isTrustedProxy(remoteAddr)) {
            // Acesso direto (ou proxy não configurado): ignora todos os headers de proxy.
            return remoteAddr;
        }

        // Origem confiável: lê headers em ordem de prioridade.

        // 1. Cloudflare header prioritário (CF-Connecting-IP)
        String cfConnectingIp = request.getHeader("CF-Connecting-IP");
        if (isIpValido(cfConnectingIp)) {
            return limparIp(cfConnectingIp);
        }

        // 2. X-Real-IP (comum em Nginx, Traefik, AWS ALB)
        String xRealIp = request.getHeader("X-Real-IP");
        if (isIpValido(xRealIp)) {
            return limparIp(xRealIp);
        }

        // 3. X-Forwarded-For: extrai o IP do cliente real percorrendo a cadeia
        //    da direita para esquerda, ignorando IPs de proxies confiáveis.
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            String clientIp = extrairClienteIpDeXff(xForwardedFor);
            if (isIpValido(clientIp)) {
                return limparIp(clientIp);
            }
        }

        // 4. Fallback para o remoteAddr já resolvido (proxy confiável sem header de cliente)
        return remoteAddr;
    }

    /**
     * Verifica se o endereço remoto da conexão TCP pertence à lista de proxies confiáveis.
     */
    boolean isTrustedProxy(String remoteAddr) {
        if (remoteAddr == null || remoteAddr.isBlank() || trustedProxies.isEmpty()) {
            return false;
        }
        return trustedProxies.contains(remoteAddr.trim());
    }

    /**
     * Extrai o IP do cliente real de um cabeçalho X-Forwarded-For percorrendo
     * da direita para a esquerda (da borda mais próxima ao servidor em direção ao cliente).
     * O primeiro IP não pertencente à lista de proxies confiáveis é o cliente real.
     *
     * <p>Exemplo: {@code "203.0.113.50, 10.0.0.1, 10.0.0.2"}
     * — se 10.0.0.1 e 10.0.0.2 forem proxies confiáveis, retorna {@code "203.0.113.50"}.
     */
    private String extrairClienteIpDeXff(String xff) {
        String[] segmentos = xff.split(",");
        for (int i = segmentos.length - 1; i >= 0; i--) {
            String limpo = limparIp(segmentos[i].trim());
            if (!isTrustedProxy(limpo) && isIpValido(limpo)) {
                return limpo;
            }
        }
        // Todos os IPs da cadeia são proxies confiáveis — retorna o primeiro (cliente original)
        return limparIp(segmentos[0].trim());
    }

    private String resolverRemoteAddr(String remoteAddr) {
        if (remoteAddr == null || remoteAddr.isBlank()) {
            return DEFAULT_IP;
        }
        String limpo = remoteAddr.trim();
        if ("0:0:0:0:0:0:0:1".equals(limpo)) {
            return DEFAULT_IP;
        }
        if (isIpValido(limpo)) {
            return limpo;
        }
        return DEFAULT_IP;
    }

    boolean isIpValido(String ip) {
        if (ip == null || ip.isBlank()) {
            return false;
        }
        String limpo = limparIp(ip);
        if ("unknown".equalsIgnoreCase(limpo) || "null".equalsIgnoreCase(limpo)) {
            return false;
        }
        return IPV4_PATTERN.matcher(limpo).matches()
                || IPV6_PATTERN.matcher(limpo).matches()
                || DEFAULT_IP.equals(limpo);
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
