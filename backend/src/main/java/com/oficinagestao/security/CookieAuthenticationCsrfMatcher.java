package com.oficinagestao.security;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.web.util.matcher.RequestMatcher;
import org.springframework.web.util.ServletRequestPathUtils;
import org.springframework.web.util.pattern.PathPattern;
import org.springframework.web.util.pattern.PathPatternParser;

/** Keeps CSRF mandatory for cookie authentication, including refresh and logout. */
final class CookieAuthenticationCsrfMatcher implements RequestMatcher {
    private static final PathPattern AUTH_PATH = PathPatternParser.defaultInstance.parse("/api/auth/**");

    @Override
    public boolean matches(HttpServletRequest request) {
        String method = request.getMethod();
        if ("GET".equals(method) || "HEAD".equals(method) || "OPTIONS".equals(method) || "TRACE".equals(method)) {
            return false;
        }
        try {
            // Use MVC's segment decoding and servlet/context-prefix semantics.
            // Do not alter the request or repeatedly decode its raw URI.
            if (AUTH_PATH.matches(ServletRequestPathUtils.parse(request).pathWithinApplication())) {
                return true;
            }
        } catch (IllegalArgumentException ex) {
            // An unparseable path must never receive a CSRF exemption.
            return true;
        }
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return false;
        for (Cookie cookie : cookies) {
            if ("access_token".equals(cookie.getName()) || "refresh_token".equals(cookie.getName())) {
                return true;
            }
        }
        return false;
    }
}
