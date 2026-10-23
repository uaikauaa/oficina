package com.oficinagestao.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.oficinagestao.controller.AuthController;
import com.oficinagestao.controller.CsrfController;
import com.oficinagestao.dto.LoginChallengeResponse;
import com.oficinagestao.repository.UsuarioRepository;
import com.oficinagestao.service.AuthService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.MappingMatch;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockHttpServletMapping;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.junit.jupiter.SpringExtension;
import org.springframework.test.context.web.WebAppConfiguration;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

import java.net.URI;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;

import static com.oficinagestao.testsupport.CsrfMockMvc.withCsrf;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Real production security chain + MVC, with no Boot, datasource, JPA or mail infrastructure. */
@ExtendWith(SpringExtension.class)
@WebAppConfiguration
@ContextConfiguration(classes = CsrfMvcRoutingTest.WebConfig.class)
class CsrfMvcRoutingTest {
    @Configuration
    @EnableWebMvc
    @Import({SecurityConfig.class, AuthController.class, CsrfController.class, Probe.class})
    static class WebConfig {
        @Bean ObjectMapper objectMapper() { return new ObjectMapper().findAndRegisterModules(); }
        @Bean AuthService authService() { return mock(AuthService.class); }
        @Bean JwtService jwtService() { return mock(JwtService.class); }
        @Bean UsuarioRepository users() { return mock(UsuarioRepository.class); }
        @Bean JwtAuthenticationFilter jwtFilter(JwtService jwt, UsuarioRepository users) {
            return new JwtAuthenticationFilter(jwt, users);
        }
    }

    @RestController
    static class Probe {
        final AtomicInteger calls = new AtomicInteger();
        @PostMapping("/api/csrf-probe") String mutate() { calls.incrementAndGet(); return "ok"; }
    }

    @Autowired WebApplicationContext context;
    @Autowired AuthService auth;
    @Autowired JwtService jwt;
    @Autowired UsuarioRepository users;
    @Autowired Probe probe;
    MockMvc mvc;

    @BeforeEach void setUp() {
        reset(auth, jwt, users);
        probe.calls.set(0);
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        when(auth.login(any(), any())).thenReturn(new LoginChallengeResponse(true, "synthetic", "challenge"));
        when(jwt.validateToken("synthetic-valid")).thenReturn(true);
        when(jwt.extractEmail("synthetic-valid")).thenReturn("csrf@example.invalid");
        when(jwt.extractUserId("synthetic-valid")).thenReturn(71L);
        when(jwt.extractRoles("synthetic-valid")).thenReturn(Set.of("ROLE_ADMIN"));
        when(jwt.extractTokenVersion("synthetic-valid")).thenReturn(0);
        when(users.findActiveTokenVersionById(71L)).thenReturn(Optional.of(0));
    }

    private MockHttpServletRequestBuilder login(String path) {
        return post(URI.create(path)).contentType("application/json")
                .content("{\"email\":\"csrf@example.invalid\",\"senha\":\"Synthetic123!\"}");
    }

    @ParameterizedTest
    @ValueSource(strings = {"/api/auth/login", "/api/%61uth/login", "/%61pi/auth/login", "/api/auth/%6cogin"})
    void mvcRecognizedRoutesRequireCsrfBeforeController(String path) throws Exception {
        mvc.perform(login(path)).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("CSRF_INVALID"));
        verifyNoInteractions(auth);
        mvc.perform(withCsrf(mvc, login(path))).andExpect(status().isOk())
                .andExpect(jsonPath("$.challengeToken").value("synthetic"));
        verify(auth, times(1)).login(any(), any());
    }

    @ParameterizedTest
    @ValueSource(strings = {"2fa/verify", "2fa/resend", "refresh", "logout"})
    void authenticationMutationsWithoutHeaderNeverReachService(String route) throws Exception {
        mvc.perform(post("/api/auth/" + route).cookie(new Cookie("refresh_token", "synthetic")))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.error").value("CSRF_INVALID"));
        verifyNoInteractions(auth);
    }

    @Test void invalidHeaderAndFormParameterAreRejected() throws Exception {
        var response = mvc.perform(get("/api/auth/csrf")).andReturn().getResponse();
        Cookie cookie = response.getCookie("XSRF-TOKEN");
        String token = new ObjectMapper().readTree(response.getContentAsString()).path("token").asText();
        mvc.perform(login("/api/auth/login").cookie(cookie).header("X-XSRF-TOKEN", "invalid"))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.error").value("CSRF_INVALID"));
        mvc.perform(login("/api/auth/login").cookie(cookie).param("_csrf", token))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.error").value("CSRF_INVALID"));
        verifyNoInteractions(auth);
    }

    @Test void bearerOnlyBusinessWorksButCookiesCannotBypassCsrf() throws Exception {
        mvc.perform(post("/api/csrf-probe").header("Authorization", "Bearer synthetic-valid"))
                .andExpect(status().isOk());
        for (String bearer : new String[]{"synthetic-valid", "forged"}) {
            mvc.perform(post("/api/csrf-probe").header("Authorization", "Bearer " + bearer)
                            .cookie(new Cookie("access_token", "synthetic-valid")))
                    .andExpect(status().isForbidden()).andExpect(jsonPath("$.error").value("CSRF_INVALID"));
        }
        mvc.perform(withCsrf(mvc, post("/api/csrf-probe"))
                        .cookie(new Cookie("access_token", "synthetic-valid"))).andExpect(status().isOk());
        mvc.perform(post("/api/csrf-probe").header("Authorization", "Bearer forged"))
                .andExpect(status().isUnauthorized());
        assertEquals(2, probe.calls.get());
    }

    @Test void contextPathDoesNotChangeProtectionOrMvcRouting() throws Exception {
        mvc.perform(login("/workshop/api/%61uth/login").contextPath("/workshop"))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.error").value("CSRF_INVALID"));
        verifyNoInteractions(auth);
        mvc.perform(withCsrf(mvc, login("/workshop/api/%61uth/login").contextPath("/workshop")))
                .andExpect(status().isOk());
        verify(auth).login(any(), any());
    }

    @Test void servletPrefixAndMalformedPathsFailClosedInMatcher() {
        var request = new MockHttpServletRequest("POST", "/workshop/rest/api/%61uth/login");
        request.setContextPath("/workshop");
        request.setServletPath("/rest");
        request.setPathInfo("/api/auth/login");
        request.setHttpServletMapping(new MockHttpServletMapping("api/auth/login", "/rest/*", "dispatcher", MappingMatch.PATH));
        assertTrue(new CookieAuthenticationCsrfMatcher().matches(request));
        assertTrue(new CookieAuthenticationCsrfMatcher().matches(new MockHttpServletRequest("POST", "/api/%ZZ")));
    }

    @Test void safeRequestsRemainUsable() throws Exception {
        mvc.perform(get("/api/auth/csrf")).andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"));
        mvc.perform(options("/api/auth/login").header("Origin", "http://localhost:3000")
                        .header("Access-Control-Request-Method", "POST")
                        .header("Access-Control-Request-Headers", "X-XSRF-TOKEN"))
                .andExpect(status().isOk());
        verifyNoInteractions(auth);
    }

    @Test void firewallRejectionIsDistinctFromCsrfAndNeverReachesController() throws Exception {
        mvc.perform(login("/api/auth%2Flogin")).andExpect(status().isBadRequest());
        verifyNoInteractions(auth);
        assertTrue(context.getBeansOfType(javax.sql.DataSource.class).isEmpty());
    }

    @Test void validCsrfDoesNotGrantAdministrativeAuthority() throws Exception {
        when(jwt.extractRoles("synthetic-valid")).thenReturn(Set.of("ROLE_USER"));
        mvc.perform(withCsrf(mvc, post("/api/csrf-probe"))
                        .cookie(new Cookie("access_token", "synthetic-valid")))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.error").value("FORBIDDEN"));
        assertEquals(0, probe.calls.get());
    }
}
