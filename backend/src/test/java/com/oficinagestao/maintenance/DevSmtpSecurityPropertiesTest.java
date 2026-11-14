package com.oficinagestao.maintenance;

import org.junit.jupiter.api.Test;

import java.util.Properties;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DevSmtpSecurityPropertiesTest {
    @Test
    void realDevelopmentSmtpRequiresAuthenticationVerifiedStartTlsAndFiniteTimeouts() throws Exception {
        Properties base = new Properties();
        Properties dev = new Properties();
        try (var stream = getClass().getResourceAsStream("/application.properties")) {
            base.load(stream);
        }
        try (var stream = getClass().getResourceAsStream("/application-dev.properties")) {
            dev.load(stream);
        }
        for (String key : new String[] {"auth", "starttls.enable", "starttls.required",
                "ssl.checkserveridentity"}) {
            assertEquals("true", dev.getProperty("spring.mail.properties.mail.smtp." + key), key);
        }
        for (String key : new String[] {"connectiontimeout", "timeout", "writetimeout"}) {
            String property = base.getProperty("spring.mail.properties.mail.smtp." + key);
            assertTrue(property != null && property.matches("\\$\\{MAIL_[A-Z_]+:[1-9][0-9]*}"), key);
            int defaultMillis = Integer.parseInt(property.substring(property.indexOf(':') + 1, property.length() - 1));
            assertTrue(defaultMillis >= 1000 && defaultMillis <= 30000, key);
        }
    }
}
