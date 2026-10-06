package com.oficinagestao.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.core.env.Environment;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("ACH-01: Testes de Configuração de Timeouts SMTP")
class SmtpConfigurationTest {

    private static final String STRONG_SECRET = "chave-secreta-de-producao-com-mais-de-32-caracteres-para-hmac-sha256";
    private static final String VALID_PROD_CORS = "https://app.oficinagestao.com.br";

    @Test
    @DisplayName("ACH-01: Defaults de timeout SMTP devem ser 15s (conexão), 25s (leitura) e 25s (escrita)")
    void shouldUseDefaultTimeoutsWhenPropertiesNotProvided() {
        new ApplicationContextRunner()
                .withInitializer(new org.springframework.boot.test.context.ConfigDataApplicationContextInitializer())
                .run(context -> {
                    Environment env = context.getEnvironment();
                    assertEquals("15000", env.getProperty("spring.mail.properties.mail.smtp.connectiontimeout"));
                    assertEquals("25000", env.getProperty("spring.mail.properties.mail.smtp.timeout"));
                    assertEquals("25000", env.getProperty("spring.mail.properties.mail.smtp.writetimeout"));
                });
    }

    @Test
    @DisplayName("ACH-01: Deve permitir override dos timeouts via variáveis de ambiente/properties")
    void shouldAllowOverridingTimeoutsViaEnvironmentProperties() {
        new ApplicationContextRunner()
                .withInitializer(new org.springframework.boot.test.context.ConfigDataApplicationContextInitializer())
                .withPropertyValues(
                        "MAIL_CONNECTION_TIMEOUT=8000",
                        "MAIL_READ_TIMEOUT=12000",
                        "MAIL_WRITE_TIMEOUT=14000"
                )
                .run(context -> {
                    Environment env = context.getEnvironment();
                    assertEquals("8000", env.getProperty("spring.mail.properties.mail.smtp.connectiontimeout"));
                    assertEquals("12000", env.getProperty("spring.mail.properties.mail.smtp.timeout"));
                    assertEquals("14000", env.getProperty("spring.mail.properties.mail.smtp.writetimeout"));
                });
    }

    @Test
    @DisplayName("ACH-01: Profile prod deve adotar os defaults seguros de 15s/25s/25s na ausência de override")
    void shouldResolveTimeoutsInProdProfileWithDefaults() {
        new ApplicationContextRunner()
                .withInitializer(context -> context.getEnvironment().setActiveProfiles("prod"))
                .withInitializer(new org.springframework.boot.test.context.ConfigDataApplicationContextInitializer())
                .withPropertyValues(
                        "JWT_SECRET=" + STRONG_SECRET,
                        "CORS_ALLOWED_ORIGINS=" + VALID_PROD_CORS,
                        "MAIL_HOST=smtp.example.invalid",
                        "MAIL_USERNAME=mailer@example.invalid",
                        "MAIL_PASSWORD=synthetic-password",
                        "MAIL_SMTP_AUTH=true",
                        "MAIL_SMTP_STARTTLS=true"
                )
                .run(context -> {
                    Environment env = context.getEnvironment();
                    assertEquals("15000", env.getProperty("spring.mail.properties.mail.smtp.connectiontimeout"));
                    assertEquals("25000", env.getProperty("spring.mail.properties.mail.smtp.timeout"));
                    assertEquals("25000", env.getProperty("spring.mail.properties.mail.smtp.writetimeout"));
                });
    }

    @Test
    @DisplayName("ACH-01: Profile prod deve respeitar override dos timeouts fornecidos no ambiente")
    void shouldAllowOverridingTimeoutsInProdProfile() {
        new ApplicationContextRunner()
                .withInitializer(context -> context.getEnvironment().setActiveProfiles("prod"))
                .withInitializer(new org.springframework.boot.test.context.ConfigDataApplicationContextInitializer())
                .withPropertyValues(
                        "JWT_SECRET=" + STRONG_SECRET,
                        "CORS_ALLOWED_ORIGINS=" + VALID_PROD_CORS,
                        "MAIL_HOST=smtp.example.invalid",
                        "MAIL_USERNAME=mailer@example.invalid",
                        "MAIL_PASSWORD=synthetic-password",
                        "MAIL_SMTP_AUTH=true",
                        "MAIL_SMTP_STARTTLS=true",
                        "MAIL_CONNECTION_TIMEOUT=20000",
                        "MAIL_READ_TIMEOUT=35000",
                        "MAIL_WRITE_TIMEOUT=30000"
                )
                .run(context -> {
                    Environment env = context.getEnvironment();
                    assertEquals("20000", env.getProperty("spring.mail.properties.mail.smtp.connectiontimeout"));
                    assertEquals("35000", env.getProperty("spring.mail.properties.mail.smtp.timeout"));
                    assertEquals("30000", env.getProperty("spring.mail.properties.mail.smtp.writetimeout"));
                });
    }
}
