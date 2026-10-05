package com.oficinagestao.config;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ForwardedHeadersSecurityValidatorTest {

    @Test
    void acceptsNone() {
        MockEnvironment environment = new MockEnvironment()
                .withProperty("server.forward-headers-strategy", "none");

        assertDoesNotThrow(() -> new ForwardedHeadersSecurityValidator(environment).validate());
    }

    @Test
    void rejectsFramework() {
        MockEnvironment environment = new MockEnvironment()
                .withProperty("server.forward-headers-strategy", "framework");

        assertThrows(IllegalStateException.class,
                () -> new ForwardedHeadersSecurityValidator(environment).validate());
    }

    @Test
    void rejectsNative() {
        MockEnvironment environment = new MockEnvironment()
                .withProperty("server.forward-headers-strategy", "native");

        assertThrows(IllegalStateException.class,
                () -> new ForwardedHeadersSecurityValidator(environment).validate());
    }
}
