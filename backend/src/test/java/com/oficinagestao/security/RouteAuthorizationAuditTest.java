package com.oficinagestao.security;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpMethod;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;
import org.springframework.web.bind.annotation.RequestMethod;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;

import static com.oficinagestao.testsupport.CsrfMockMvc.withCsrf;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc(printOnlyOnFailure = false, print = org.springframework.boot.test.autoconfigure.web.servlet.MockMvcPrint.NONE)
class RouteAuthorizationAuditTest {
    @Autowired MockMvc mvc;
    @Autowired @Qualifier("requestMappingHandlerMapping") RequestMappingHandlerMapping mappings;

    @Test void everyRegisteredApiRouteHasAuthorizationAndCookieCsrf() throws Exception {
        List<String> inventory = new ArrayList<>();
        int tested = 0;
        for (var entry : mappings.getHandlerMethods().entrySet()) {
            var info = entry.getKey();
            for (String path : info.getPatternValues()) {
                if (!path.startsWith("/api/")) continue;
                assertFalse(info.getMethodsCondition().getMethods().isEmpty(), "Unbounded HTTP methods: " + path);
                for (var method : info.getMethodsCondition().getMethods()) {
                    String url = path.replaceAll("\\{[^}]+}", "999999999");
                    boolean publicRoute = path.equals("/api/health") || (method == RequestMethod.GET && path.equals("/api/auth/csrf"))
                            || (method == RequestMethod.POST && Set.of("/api/auth/login", "/api/auth/refresh",
                            "/api/auth/logout", "/api/auth/2fa/verify", "/api/auth/2fa/resend").contains(path));
                    boolean mutation = method != RequestMethod.GET && method != RequestMethod.HEAD && method != RequestMethod.OPTIONS;
                    inventory.add(method + "\t" + path + "\t" + entry.getValue().getBeanType().getSimpleName() + "#"
                            + entry.getValue().getMethod().getName() + "\t" + (publicRoute ? "PUBLIC" : "ADMIN"));
                    if (!publicRoute) {
                        mvc.perform(withCsrf(mvc, request(HttpMethod.valueOf(method.name()), url))).andExpect(status().isUnauthorized());
                        mvc.perform(withCsrf(mvc, request(HttpMethod.valueOf(method.name()), url).with(user("audit").roles("USER"))))
                                .andExpect(status().isForbidden());
                        if (method == RequestMethod.GET) {
                            mvc.perform(head(url)).andExpect(status().isUnauthorized());
                        }
                    }
                    if (mutation) {
                        mvc.perform(request(HttpMethod.valueOf(method.name()), url).cookie(new Cookie("access_token", "invalid")))
                                .andExpect(status().isForbidden()).andExpect(jsonPath("$.error").value("CSRF_INVALID"));
                        mvc.perform(request(HttpMethod.valueOf(method.name()), url).cookie(new Cookie("access_token", "invalid"),
                                        new Cookie("XSRF-TOKEN", "cookie-value")).header("X-XSRF-TOKEN", "different"))
                                .andExpect(status().isForbidden());
                    }
                    tested++;
                }
            }
        }
        assertTrue(tested >= 70, "Inventory unexpectedly incomplete: " + tested);
        Collections.sort(inventory);
        Files.write(Path.of("target/audit-routes.tsv"), inventory);
        System.out.println("AUDIT_ROUTE_MAPPINGS=" + tested);
    }

    @Test void boundedSortRejectsRecursiveUnknownAndPollutedPathsBeforeDataParsing() throws Exception {
        for (String sort : List.of("cliente.cliente.cliente.id", "x".repeat(3000), "untrustedProperty", "id,asc,desc", "id,,asc")) {
            mvc.perform(get("/api/clientes").param("sort", sort).with(user("audit").roles("ADMIN")))
                    .andExpect(status().isBadRequest());
        }
        mvc.perform(get("/api/clientes").param("sort", "id", "nomeRazaoSocial", "ativo", "id").with(user("audit").roles("ADMIN")))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/clientes").param("sort", "nomeRazaoSocial,asc").with(user("audit").roles("ADMIN")))
                .andExpect(status().isOk());
    }

    @Test void controlledInjectionAndMalformedIdsDoNotExposeInternals() throws Exception {
        mvc.perform(get("/api/clientes").param("termo", "' OR 1=1 --").with(user("audit").roles("ADMIN")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(get("/api/clientes/not-a-number").with(user("audit").roles("ADMIN")))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.trace").doesNotExist());
        mvc.perform(get("/api/does-not-exist").with(user("audit").roles("ADMIN")))
                .andExpect(status().isNotFound()).andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("X-Frame-Options", "DENY"));
        mvc.perform(get("/actuator/env")).andExpect(status().isUnauthorized());
    }
}
