package com.oficinagestao.security;

import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.core.env.Environment;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.filter.ForwardedHeaderFilter;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "security.trusted-proxies=10.0.0.1,172.16.0.1")
@AutoConfigureMockMvc
class ForwardedHeadersSpringIntegrationTest {

    private static final String SOCKET_PEER_HEADER = "X-Test-Socket-Peer";
    private static final String RESOLVED_IP_HEADER = "X-Test-Resolved-Ip";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ApplicationContext applicationContext;

    @Autowired
    private Environment environment;

    @Test
    void springChainPreservesSocketPeerAndIgnoresSpoofedForwardedHeaders() throws Exception {
        assertEquals("none", environment.getProperty("server.forward-headers-strategy"));
        assertTrue(applicationContext.getBeansOfType(ForwardedHeaderFilter.class).isEmpty());

        mockMvc.perform(get("/api/health")
                        .with(request -> {
                            request.setRemoteAddr("198.51.100.10");
                            return request;
                        })
                        .header("CF-Connecting-IP", "1.2.3.4")
                        .header("X-Real-IP", "192.0.2.25")
                        .header("X-Forwarded-For", "203.0.113.77"))
                .andExpect(status().isOk())
                .andExpect(header().string(SOCKET_PEER_HEADER, "198.51.100.10"))
                .andExpect(header().string(RESOLVED_IP_HEADER, "198.51.100.10"));
    }

    @Test
    void springChainAllowsConfiguredProxyToSupplyClientIp() throws Exception {
        mockMvc.perform(get("/api/health")
                        .with(request -> {
                            request.setRemoteAddr("10.0.0.1");
                            return request;
                        })
                        .header("CF-Connecting-IP", "203.0.113.50"))
                .andExpect(status().isOk())
                .andExpect(header().string(SOCKET_PEER_HEADER, "10.0.0.1"))
                .andExpect(header().string(RESOLVED_IP_HEADER, "203.0.113.50"));
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class ObservedIpConfiguration {

        @Bean
        WebMvcConfigurer observedIpWebMvcConfigurer(IpAddressResolver ipAddressResolver) {
            return new WebMvcConfigurer() {
                @Override
                public void addInterceptors(InterceptorRegistry registry) {
                    registry.addInterceptor(new HandlerInterceptor() {
                        @Override
                        public boolean preHandle(
                                HttpServletRequest request,
                                jakarta.servlet.http.HttpServletResponse response,
                                Object handler
                        ) {
                            response.setHeader(SOCKET_PEER_HEADER, request.getRemoteAddr());
                            response.setHeader(RESOLVED_IP_HEADER, ipAddressResolver.extrairIp(request));
                            return true;
                        }
                    });
                }
            };
        }
    }
}
