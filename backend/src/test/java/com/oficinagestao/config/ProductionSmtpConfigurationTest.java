package com.oficinagestao.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ProductionSmtpConfigurationTest {

    private static final String STRONG_SECRET =
            "chave-secreta-de-producao-com-mais-de-32-caracteres-para-hmac-sha256";

    private ApplicationContextRunner productionRunner(Map<String, String> overrides) {
        Map<String, String> properties = new LinkedHashMap<>();
        properties.put("security.jwt.secret", STRONG_SECRET);
        properties.put("cors.allowed-origins", "https://app.example.invalid");
        properties.put("security.cookie.secure", "true");
        properties.put("spring.mail.host", "smtp.example.invalid");
        properties.put("spring.mail.username", "mailer@example.invalid");
        properties.put("spring.mail.password", "synthetic-password");
        properties.put("app.mail.from", "mailer@example.invalid");
        properties.put("spring.mail.properties.mail.smtp.auth", "true");
        properties.put("spring.mail.properties.mail.smtp.starttls.enable", "true");
        properties.put("spring.mail.properties.mail.smtp.connectiontimeout", "15000");
        properties.put("spring.mail.properties.mail.smtp.timeout", "25000");
        properties.put("spring.mail.properties.mail.smtp.writetimeout", "25000");
        properties.putAll(overrides);

        String[] values = properties.entrySet().stream()
                .map(entry -> entry.getKey() + "=" + entry.getValue())
                .toArray(String[]::new);

        return new ApplicationContextRunner()
                .withInitializer(context -> context.getEnvironment().setActiveProfiles("prod"))
                .withBean(ProductionSecurityValidator.class)
                .withPropertyValues(values);
    }

    @Test
    @DisplayName("Produção com SMTP seguro inicializa")
    void shouldAcceptSecureProductionSmtp() {
        productionRunner(Map.of()).run(context -> assertThat(context).hasNotFailed());
    }

    @Test
    @DisplayName("Produção com SMTP auth=false aborta o startup")
    void shouldRejectDisabledAuthentication() {
        assertStartupFailure(Map.of("spring.mail.properties.mail.smtp.auth", "false"), "MAIL_SMTP_AUTH");
    }

    @Test
    @DisplayName("Produção com SMTP STARTTLS=false aborta o startup")
    void shouldRejectDisabledStartTls() {
        assertStartupFailure(Map.of("spring.mail.properties.mail.smtp.starttls.enable", "false"), "MAIL_SMTP_STARTTLS");
    }

    @Test
    @DisplayName("Produção com senha SMTP vazia aborta o startup")
    void shouldRejectBlankPassword() {
        assertStartupFailure(Map.of("spring.mail.password", ""), "MAIL_PASSWORD");
    }

    @Test
    @DisplayName("Produção com usuário SMTP vazio aborta o startup")
    void shouldRejectBlankUsername() {
        assertStartupFailure(Map.of("spring.mail.username", ""), "MAIL_USERNAME");
    }

    @Test
    @DisplayName("Produção com host SMTP vazio aborta o startup")
    void shouldRejectBlankHost() {
        assertStartupFailure(Map.of("spring.mail.host", ""), "MAIL_HOST");
    }

    @Test
    @DisplayName("Produção com remetente SMTP vazio aborta o startup")
    void shouldRejectBlankFrom() {
        assertStartupFailure(Map.of("app.mail.from", ""), "MAIL_FROM");
    }

    @Test
    @DisplayName("Dev preserva configuração SMTP sintética permissiva")
    void shouldPreserveDevelopmentBehavior() {
        new ApplicationContextRunner()
                .withInitializer(context -> context.getEnvironment().setActiveProfiles("dev"))
                .withBean(ProductionSecurityValidator.class)
                .withPropertyValues(
                        "security.jwt.secret=" + ProductionSecurityValidator.DEFAULT_DEV_JWT_SECRET,
                        "cors.allowed-origins=http://localhost:3000",
                        "security.cookie.secure=false",
                        "spring.mail.host=",
                        "spring.mail.username=",
                        "spring.mail.password=",
                        "app.mail.from=",
                        "spring.mail.properties.mail.smtp.auth=false",
                        "spring.mail.properties.mail.smtp.starttls.enable=false"
                )
                .run(context -> assertThat(context).hasNotFailed());
    }

    @Test
    @DisplayName("Produção com timeout de conexão zero aborta o startup")
    void shouldRejectZeroConnectionTimeout() {
        assertStartupFailure(Map.of("spring.mail.properties.mail.smtp.connectiontimeout", "0"), "MAIL_CONNECTION_TIMEOUT");
    }

    @Test
    @DisplayName("Produção com timeout de leitura negativo aborta o startup")
    void shouldRejectNegativeReadTimeout() {
        assertStartupFailure(Map.of("spring.mail.properties.mail.smtp.timeout", "-1000"), "MAIL_READ_TIMEOUT");
    }

    @Test
    @DisplayName("Produção com timeout de escrita não numérico aborta o startup")
    void shouldRejectNonNumericWriteTimeout() {
        assertStartupFailure(Map.of("spring.mail.properties.mail.smtp.writetimeout", "invalid"), "MAIL_WRITE_TIMEOUT");
    }

    @Test
    @DisplayName("Produção com timeout menor que 1000ms aborta o startup")
    void shouldRejectTooLowTimeout() {
        assertStartupFailure(Map.of("spring.mail.properties.mail.smtp.timeout", "500"), "MAIL_READ_TIMEOUT");
    }

    @Test
    @DisplayName("Produção com timeouts customizados válidos inicializa")
    void shouldAcceptCustomValidTimeouts() {
        productionRunner(Map.of(
                "spring.mail.properties.mail.smtp.connectiontimeout", "20000",
                "spring.mail.properties.mail.smtp.timeout", "35000",
                "spring.mail.properties.mail.smtp.writetimeout", "30000"
        )).run(context -> assertThat(context).hasNotFailed());
    }

    private void assertStartupFailure(Map<String, String> overrides, String expectedProperty) {
        productionRunner(overrides).run(context -> {
            assertThat(context).hasFailed();
            Throwable rootCause = context.getStartupFailure();
            while (rootCause != null && rootCause.getCause() != null) {
                rootCause = rootCause.getCause();
            }
            assertTrue(rootCause != null && rootCause.getMessage().contains(expectedProperty));
            assertTrue(rootCause == null || !rootCause.getMessage().contains("synthetic-password"));
        });
    }
}
