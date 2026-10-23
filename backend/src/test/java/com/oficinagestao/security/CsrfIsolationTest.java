package com.oficinagestao.security;

import com.oficinagestao.controller.CsrfController;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfFilter;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.DefaultCsrfToken;
import org.springframework.web.filter.CorsFilter;

import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;

/** Runs only the real Spring Security CSRF filter; it starts no application or database. */
class CsrfIsolationTest {
    private final CookieCsrfTokenRepository repository = new CookieCsrfTokenRepository();
    private final CsrfFilter filter = new CsrfFilter(repository);

    CsrfIsolationTest() {
        repository.setCookieCustomizer(cookie -> cookie.httpOnly(true).secure(true).sameSite("Strict").path("/"));
        filter.setRequestHandler(new HeaderOnlyCsrfTokenRequestHandler());
        filter.setRequireCsrfProtectionMatcher(new CookieAuthenticationCsrfMatcher());
    }

    private String issueToken() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/auth/csrf");
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicReference<String> value = new AtomicReference<>();
        filter.doFilter(request, response, (req, res) -> {
            CsrfToken token = (CsrfToken) req.getAttribute(CsrfToken.class.getName());
            value.set(token.getToken());
        });
        assertNotNull(response.getHeader("Set-Cookie"));
        assertNotNull(response.getCookie("XSRF-TOKEN"));
        assertEquals("Strict", response.getCookie("XSRF-TOKEN").getAttribute("SameSite"));
        assertTrue(response.getHeader("Set-Cookie").contains("HttpOnly"));
        assertTrue(response.getHeader("Set-Cookie").contains("Secure"));
        return value.get();
    }

    private int perform(String method, String path, String token, String header, boolean authCookie,
                        boolean bearer, AtomicInteger calls) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest(method, path);
        if (token != null) {
            if (authCookie) request.setCookies(new Cookie("XSRF-TOKEN", token), new Cookie("access_token", "jwt"));
            else request.setCookies(new Cookie("XSRF-TOKEN", token));
        }
        if (bearer) request.addHeader("Authorization", "Bearer jwt");
        if (header != null) request.addHeader("X-XSRF-TOKEN", header);
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, (req, res) -> {
            calls.incrementAndGet();
            ((MockHttpServletResponse) res).setStatus(200);
        });
        return response.getStatus();
    }

    @Test
    void cookieMutationsRequireValidHeaderWithoutBusinessEffectsOnRejection() throws Exception {
        String token = issueToken();
        AtomicInteger calls = new AtomicInteger();
        for (String method : new String[] {"POST", "PUT", "PATCH", "DELETE"}) {
            assertEquals(403, perform(method, "/api/produtos", token, null, true, false, calls));
        }
        assertEquals(403, perform("POST", "/api/produtos", token, "invalid", true, false, calls));
        assertEquals(0, calls.get());
        assertEquals(200, perform("POST", "/api/produtos", token, token, true, false, calls));
        assertEquals(1, calls.get());
    }

    @Test
    void bearerOnlyIsExemptButBearerWithCookieIsProtected() throws Exception {
        String token = issueToken();
        AtomicInteger calls = new AtomicInteger();
        assertEquals(200, perform("POST", "/api/produtos", null, null, false, true, calls));
        assertEquals(403, perform("POST", "/api/produtos", token, null, true, true, calls));
        assertEquals(200, perform("GET", "/api/produtos", token, null, true, false, calls));
        assertEquals(2, calls.get());
    }

    @Test
    void authenticationRoutesRequireHeaderIncludingLoginRefreshAndLogout() throws Exception {
        String token = issueToken();
        AtomicInteger calls = new AtomicInteger();
        for (String path : new String[] {"login", "2fa/verify", "2fa/resend", "refresh", "logout"}) {
            assertEquals(403, perform("POST", "/api/auth/" + path, token, null, false, false, calls));
            assertEquals(200, perform("POST", "/api/auth/" + path, token, token, false, false, calls));
        }
        assertEquals(5, calls.get());
    }

    @Test
    void corsRejectsMaliciousAndSameSiteOriginsBeforeTheyReachBusinessCode() throws Exception {
        String token = issueToken();
        CorsFilter cors = new CorsFilter(new SecurityConfig(null, new ObjectMapper(),
                "http://localhost:3000", true, false).corsConfigurationSource());
        AtomicInteger calls = new AtomicInteger();
        for (String origin : new String[] {"https://evil.example.invalid", "http://evil.localhost:3001"}) {
            MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/produtos");
            request.addHeader("Origin", origin);
            request.addHeader("X-XSRF-TOKEN", token);
            request.setCookies(new Cookie("XSRF-TOKEN", token), new Cookie("access_token", "jwt"));
            MockHttpServletResponse response = new MockHttpServletResponse();
            cors.doFilter(request, response, (req, res) -> filter.doFilter(req, res, (r, s) -> calls.incrementAndGet()));
            assertEquals(403, response.getStatus());
            assertNull(response.getHeader("Access-Control-Allow-Origin"));
        }
        assertEquals(0, calls.get());

        MockHttpServletRequest preflight = new MockHttpServletRequest("OPTIONS", "/api/produtos");
        preflight.addHeader("Origin", "http://localhost:3000");
        preflight.addHeader("Access-Control-Request-Method", "POST");
        preflight.addHeader("Access-Control-Request-Headers", "X-XSRF-TOKEN");
        MockHttpServletResponse response = new MockHttpServletResponse();
        cors.doFilter(preflight, response, (req, res) -> fail("Preflight should be handled by CORS"));
        assertEquals(200, response.getStatus());
        assertEquals("http://localhost:3000", response.getHeader("Access-Control-Allow-Origin"));

        MockHttpServletRequest allowed = new MockHttpServletRequest("POST", "/api/produtos");
        allowed.addHeader("Origin", "http://localhost:3000");
        allowed.addHeader("X-XSRF-TOKEN", token);
        allowed.setCookies(new Cookie("XSRF-TOKEN", token), new Cookie("access_token", "jwt"));
        MockHttpServletResponse allowedResponse = new MockHttpServletResponse();
        cors.doFilter(allowed, allowedResponse,
                (req, res) -> filter.doFilter(req, res, (r, s) -> calls.incrementAndGet()));
        assertEquals(200, allowedResponse.getStatus());
        assertEquals(1, calls.get());
    }

    @Test
    void tokenEndpointDisablesCaching() {
        var response = new CsrfController().token(new DefaultCsrfToken("X-XSRF-TOKEN", "_csrf", "synthetic"));
        assertEquals("no-store", response.getHeaders().getCacheControl());
        assertEquals("synthetic", response.getBody().get("token"));
    }
}
