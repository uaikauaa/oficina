package com.oficinagestao.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;

/** Accepts the CSRF token only in a custom header, never in a simple HTML form. */
final class HeaderOnlyCsrfTokenRequestHandler extends CsrfTokenRequestAttributeHandler {
    @Override
    public String resolveCsrfTokenValue(HttpServletRequest request, CsrfToken csrfToken) {
        return request.getHeader("X-XSRF-TOKEN");
    }
}
