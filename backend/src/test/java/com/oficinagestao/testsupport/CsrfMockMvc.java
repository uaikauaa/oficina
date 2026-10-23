package com.oficinagestao.testsupport;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/** Explicitly obtains the real cookie/header pair for legacy authenticated MockMvc flows. */
public final class CsrfMockMvc {
    private CsrfMockMvc() { }

    public static MockHttpServletRequestBuilder withCsrf(MockMvc mvc, MockHttpServletRequestBuilder request)
            throws Exception {
        MvcResult tokenResponse = mvc.perform(get("/api/auth/csrf")).andReturn();
        if (tokenResponse.getResponse().getStatus() != 200) {
            throw new IllegalStateException("CSRF token endpoint failed in test");
        }
        Cookie cookie = tokenResponse.getResponse().getCookie("XSRF-TOKEN");
        if (cookie == null) {
            throw new IllegalStateException("CSRF token cookie missing in test");
        }
        String token = new ObjectMapper().readTree(tokenResponse.getResponse().getContentAsString())
                .path("token").asText();
        if (token.isBlank()) {
            throw new IllegalStateException("CSRF token missing in test");
        }
        return request.cookie(cookie).header("X-XSRF-TOKEN", token);
    }
}
