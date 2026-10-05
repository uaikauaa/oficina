package com.oficinagestao.config;

import jakarta.annotation.PostConstruct;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/**
 * Keeps the socket peer intact until IpAddressResolver evaluates proxy trust.
 */
@Component
public class ForwardedHeadersSecurityValidator {

    static final String REQUIRED_STRATEGY = "none";

    private final Environment environment;

    public ForwardedHeadersSecurityValidator(Environment environment) {
        this.environment = environment;
    }

    @PostConstruct
    public void validate() {
        String strategy = environment.getProperty("server.forward-headers-strategy", REQUIRED_STRATEGY);
        if (!REQUIRED_STRATEGY.equalsIgnoreCase(strategy != null ? strategy.trim() : "")) {
            throw new IllegalStateException(
                    "SEC-03: server.forward-headers-strategy must be 'none' so request.getRemoteAddr() " +
                            "remains the socket peer used by IpAddressResolver."
            );
        }
    }
}
