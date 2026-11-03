package com.oficinagestao.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.oficinagestao.exception.ApiErrorResponse;
import com.oficinagestao.exception.BusinessException;
import com.oficinagestao.exception.RateLimitException;
import com.oficinagestao.security.IpAddressResolver;
import com.oficinagestao.security.SharedRateLimitService;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.data.web.config.PageableHandlerMethodArgumentResolverCustomizer;
import java.io.*;
import java.time.Duration;
import java.util.Set;

@Configuration
public class ResourceLimitsConfiguration {
    public static final int MAX_BODY = 65536;

    @Bean
    PageableHandlerMethodArgumentResolverCustomizer boundedPages() {
        return resolver -> resolver.setMaxPageSize(200);
    }

    @Bean
    WebMvcConfigurer resourceBudgets(SharedRateLimitService limits, IpAddressResolver ips) {
        return new WebMvcConfigurer() {
            @Override public void addInterceptors(org.springframework.web.servlet.config.annotation.InterceptorRegistry registry) {
                registry.addInterceptor(new HandlerInterceptor() {
                    @Override public boolean preHandle(HttpServletRequest req, HttpServletResponse res, Object handler) {
                        String path = req.getRequestURI();
                        if (path.equals("/api/health") || req.getMethod().equals("OPTIONS")) return true;
                        res.setHeader("Cache-Control", "no-store");
                        validatePage(req, "size", 1, 200);
                        validatePage(req, "page", 0, 10000);
                        if (req.getParameterMap().size() > 30 || req.getParameterMap().values().stream()
                                .anyMatch(v -> v.length > 3 || java.util.Arrays.stream(v).anyMatch(s -> s.length() > 512)))
                            throw new BusinessException("Parametros excedem os limites permitidos.");
                        String ip = ips.extrairIp(req);
                        var auth = SecurityContextHolder.getContext().getAuthentication();
                        String subject = auth != null && !(auth instanceof org.springframework.security.authentication.AnonymousAuthenticationToken)
                                ? "user:" + auth.getName() : "ip:" + ip;
                        take(limits, "api-client", subject, 600);
                        if (path.contains("/pdf") || path.contains("/recibo") || path.contains("/documento-servico")) take(limits, "pdf-request", subject, 10);
                        else if (path.startsWith("/api/relatorios")) take(limits, "report-request", subject, 120);
                        else if (path.startsWith("/api/busca")) take(limits, "search-request", subject, 60);
                        else if (!Set.of("GET", "HEAD").contains(req.getMethod())) take(limits, "mutation-request", subject, 60);
                        return true;
                    }
                }).addPathPatterns("/api/**");
            }
        };
    }

    private static void take(SharedRateLimitService store, String scope, String subject, int count) {
        var decision = store.consume(scope, subject, count, Duration.ofMinutes(1));
        if (!decision.allowed()) throw new RateLimitException(decision.retryAfterSeconds());
    }

    private static void validatePage(HttpServletRequest req, String name, int min, int max) {
        String[] values = req.getParameterValues(name);
        if (values == null) return;
        try {
            if (values.length != 1 || !values[0].matches("[0-9]{1,5}")) throw new NumberFormatException();
            int value = Integer.parseInt(values[0]);
            if (value < min || value > max) throw new NumberFormatException();
        } catch (NumberFormatException e) { throw new BusinessException("Paginacao invalida ou excede o limite permitido."); }
    }

    @Bean
    FilterRegistrationBean<OncePerRequestFilter> boundedPayload(ObjectMapper mapper, SharedRateLimitService limits, IpAddressResolver ips) {
        var bean = new FilterRegistrationBean<OncePerRequestFilter>();
        bean.setFilter(new OncePerRequestFilter() {
            @Override protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
                    throws ServletException, IOException {
                if ((req.getQueryString() != null && req.getQueryString().length() > 4096)
                        || req.getContentLengthLong() > MAX_BODY) { deny(req, res, mapper, 413); return; }
                if (req.getQueryString() != null && req.getQueryString().split("&", -1).length > 30) {
                    deny(req, res, mapper, 400); return;
                }
                if (req.getHeader("Content-Encoding") != null && !req.getHeader("Content-Encoding").equalsIgnoreCase("identity")) {
                    deny(req, res, mapper, 415); return;
                }
                if (!req.getRequestURI().equals("/api/health") && !req.getMethod().equals("OPTIONS")) {
                    String path = req.getRequestURI();
                    try {
                        String ip = ips.extrairIp(req);
                        take(limits, "api-total", "all", 5000);
                        take(limits, "api-peer", ip, 600);
                        if (path.equals("/api/auth/login")) take(limits, "login-request", ip, 10);
                        else if (path.equals("/api/auth/2fa/resend")) take(limits, "resend-request", ip, 5);
                        else if (path.equals("/api/auth/2fa/verify")) take(limits, "verify-request", ip, 20);
                        else if (path.startsWith("/api/auth/")) take(limits, "session-request", ip, 60);
                    } catch (SecurityException exception) {
                        deny(req, res, mapper, 403); return;
                    } catch (RateLimitException exception) {
                        res.setHeader("Retry-After", Long.toString(exception.getRetryAfterSeconds()));
                        deny(req, res, mapper, 429); return;
                    } catch (org.springframework.dao.DataAccessException | org.springframework.transaction.TransactionException exception) {
                        res.setHeader("Retry-After", "5");
                        deny(req, res, mapper, 503); return;
                    }
                }
                // Count actual bytes, including chunked requests with no Content-Length.
                byte[] body = req.getInputStream().readNBytes(MAX_BODY + 1);
                if (body.length > MAX_BODY) { deny(req, res, mapper, 413); return; }
                chain.doFilter(new HttpServletRequestWrapper(req) {
                    @Override public ServletInputStream getInputStream() {
                        var input = new ByteArrayInputStream(body);
                        return new ServletInputStream() {
                            public int read() { return input.read(); }
                            public boolean isFinished() { return input.available() == 0; }
                            public boolean isReady() { return true; }
                            public void setReadListener(ReadListener listener) { throw new UnsupportedOperationException(); }
                        };
                    }
                    @Override public BufferedReader getReader() {
                        return new BufferedReader(new InputStreamReader(getInputStream(), java.nio.charset.StandardCharsets.UTF_8));
                    }
                }, res);
            }
        });
        bean.addUrlPatterns("/api/*");
        bean.setOrder(Ordered.HIGHEST_PRECEDENCE + 10);
        return bean;
    }

    private static void deny(HttpServletRequest req, HttpServletResponse res, ObjectMapper mapper, int status) throws IOException {
        res.setStatus(status);
        res.setContentType("application/json");
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("X-Content-Type-Options", "nosniff");
        String code = switch (status) {
            case 413 -> "PAYLOAD_TOO_LARGE";
            case 415 -> "UNSUPPORTED_ENCODING";
            case 429 -> "RATE_LIMITED";
            case 403 -> "INVALID_CLIENT_CONTEXT";
            case 400 -> "INVALID_PARAMETERS";
            default -> "SERVICE_UNAVAILABLE";
        };
        mapper.writeValue(res.getOutputStream(), ApiErrorResponse.of(status, code,
                "Requisicao nao pode ser processada neste momento.", req.getRequestURI()));
    }
}
