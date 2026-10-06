package com.oficinagestao.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.core.env.Environment;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.Profiles;
import org.springframework.core.env.StandardEnvironment;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProductionSecurityValidatorTest {

    @Mock
    private Environment environment;

    private static final String STRONG_SECRET = "chave-secreta-de-producao-com-mais-de-32-caracteres-para-hmac-sha256";
    private static final String VALID_PROD_CORS = "https://app.oficinagestao.com.br";

    private void stubSecureSmtp() {
        when(environment.getProperty("spring.mail.host")).thenReturn("smtp.example.invalid");
        when(environment.getProperty("spring.mail.username")).thenReturn("mailer@example.invalid");
        when(environment.getProperty("spring.mail.password")).thenReturn("synthetic-password");
        when(environment.getProperty("app.mail.from")).thenReturn("mailer@example.invalid");
        when(environment.getProperty("spring.mail.properties.mail.smtp.auth")).thenReturn("true");
        when(environment.getProperty("spring.mail.properties.mail.smtp.starttls.enable")).thenReturn("true");
        when(environment.getProperty("spring.mail.properties.mail.smtp.connectiontimeout")).thenReturn("15000");
        when(environment.getProperty("spring.mail.properties.mail.smtp.timeout")).thenReturn("25000");
        when(environment.getProperty("spring.mail.properties.mail.smtp.writetimeout")).thenReturn("25000");
    }

    @Test
    @DisplayName("PROD001-01: Profile prod com secret ausente deve falhar de forma segura")
    void shouldFailInProductionWhenSecretIsMissing() {
        when(environment.acceptsProfiles(any(Profiles.class))).thenReturn(true);
        when(environment.getProperty("security.jwt.secret")).thenReturn(null);
        when(environment.getProperty("cors.allowed-origins")).thenReturn(VALID_PROD_CORS);

        ProductionSecurityValidator validator = new ProductionSecurityValidator(environment);

        IllegalStateException ex = assertThrows(IllegalStateException.class, validator::validate);
        assertTrue(ex.getMessage().contains("JWT_SECRET é mandatória e não foi fornecida"));
    }

    @Test
    @DisplayName("PROD001-01: Profile prod com secret default de desenvolvimento deve ser rejeitado")
    void shouldFailInProductionWhenDefaultSecretIsUsed() {
        when(environment.acceptsProfiles(any(Profiles.class))).thenReturn(true);
        when(environment.getProperty("security.jwt.secret")).thenReturn(ProductionSecurityValidator.DEFAULT_DEV_JWT_SECRET);
        when(environment.getProperty("cors.allowed-origins")).thenReturn(VALID_PROD_CORS);

        ProductionSecurityValidator validator = new ProductionSecurityValidator(environment);

        IllegalStateException ex = assertThrows(IllegalStateException.class, validator::validate);
        assertTrue(ex.getMessage().contains("O segredo JWT padrão de desenvolvimento foi detectado"));
    }

    @Test
    @DisplayName("PROD001-01: Profile prod com secret menor que 32 caracteres deve ser rejeitado")
    void shouldFailInProductionWhenSecretIsTooShort() {
        when(environment.acceptsProfiles(any(Profiles.class))).thenReturn(true);
        when(environment.getProperty("security.jwt.secret")).thenReturn("chave-curta-1234");
        when(environment.getProperty("cors.allowed-origins")).thenReturn(VALID_PROD_CORS);

        ProductionSecurityValidator validator = new ProductionSecurityValidator(environment);

        IllegalStateException ex = assertThrows(IllegalStateException.class, validator::validate);
        assertTrue(ex.getMessage().contains("mínimo 32 caracteres"));
    }

    @Test
    @DisplayName("PROD001-03: Profile prod com CORS vazio ou contendo localhost deve ser rejeitado")
    void shouldFailInProductionWhenCorsIsLocalhost() {
        when(environment.acceptsProfiles(any(Profiles.class))).thenReturn(true);
        when(environment.getProperty("security.jwt.secret")).thenReturn(STRONG_SECRET);
        when(environment.getProperty("cors.allowed-origins")).thenReturn("http://localhost:3000");

        ProductionSecurityValidator validator = new ProductionSecurityValidator(environment);

        IllegalStateException ex = assertThrows(IllegalStateException.class, validator::validate);
        assertTrue(ex.getMessage().contains("não pode conter referências a 'localhost'"));
    }

    @Test
    @DisplayName("PROD001-03: Profile prod com CORS contendo wildcard '*' deve ser rejeitado")
    void shouldFailInProductionWhenCorsIsWildcard() {
        when(environment.acceptsProfiles(any(Profiles.class))).thenReturn(true);
        when(environment.getProperty("security.jwt.secret")).thenReturn(STRONG_SECRET);
        when(environment.getProperty("cors.allowed-origins")).thenReturn("*");

        ProductionSecurityValidator validator = new ProductionSecurityValidator(environment);

        IllegalStateException ex = assertThrows(IllegalStateException.class, validator::validate);
        assertTrue(ex.getMessage().contains("não pode conter wildcard '*'"));
    }

    @Test
    @DisplayName("PROD001-01 & PROD001-03: Profile prod com secret forte e CORS válido deve inicializar com sucesso")
    void shouldSucceedInProductionWithValidConfigurations() {
        when(environment.acceptsProfiles(any(Profiles.class))).thenReturn(true);
        when(environment.getProperty("security.jwt.secret")).thenReturn(STRONG_SECRET);
        when(environment.getProperty("cors.allowed-origins")).thenReturn(VALID_PROD_CORS);
        when(environment.getProperty("security.cookie.secure")).thenReturn("true");
        stubSecureSmtp();

        ProductionSecurityValidator validator = new ProductionSecurityValidator(environment);

        assertDoesNotThrow(validator::validate);
    }

    @Test
    @DisplayName("Ambiente de desenvolvimento/testes: permite chave padrão sem bloquear inicialização")
    void shouldAllowDefaultSecretInDevelopment() {
        when(environment.acceptsProfiles(any(Profiles.class))).thenReturn(false);
        when(environment.getProperty("security.jwt.secret")).thenReturn(ProductionSecurityValidator.DEFAULT_DEV_JWT_SECRET);
        when(environment.getProperty("cors.allowed-origins")).thenReturn("http://localhost:3000");
        when(environment.getProperty("security.cookie.secure")).thenReturn("false");

        ProductionSecurityValidator validator = new ProductionSecurityValidator(environment);

        assertDoesNotThrow(validator::validate);
    }

    @Test
    @DisplayName("HARD-01: Profile prod com cookie Secure=false deve abortar a inicialização")
    void shouldFailInProductionWhenCookieSecureIsFalse() {
        when(environment.acceptsProfiles(any(Profiles.class))).thenReturn(true);
        when(environment.getProperty("security.jwt.secret")).thenReturn(STRONG_SECRET);
        when(environment.getProperty("cors.allowed-origins")).thenReturn(VALID_PROD_CORS);
        when(environment.getProperty("security.cookie.secure")).thenReturn("false");

        ProductionSecurityValidator validator = new ProductionSecurityValidator(environment);

        IllegalStateException ex = assertThrows(IllegalStateException.class, validator::validate);
        assertTrue(ex.getMessage().contains("security.cookie.secure deve ser true"));
        assertFalse(ex.getMessage().contains(STRONG_SECRET));
    }

    @Test
    @DisplayName("HARD-01: Contexto Spring de produção aborta quando cookie Secure=false")
    void shouldAbortProductionSpringContextWhenCookieSecureIsFalse() {
        new ApplicationContextRunner()
                .withInitializer(context -> context.getEnvironment().setActiveProfiles("prod"))
                .withBean(ProductionSecurityValidator.class)
                .withPropertyValues(
                        "security.jwt.secret=" + STRONG_SECRET,
                        "cors.allowed-origins=" + VALID_PROD_CORS,
                        "security.cookie.secure=false"
                )
                .run(context -> {
                    Throwable startupFailure = context.getStartupFailure();
                    assertNotNull(startupFailure);
                    Throwable rootCause = startupFailure;
                    while (rootCause.getCause() != null) {
                        rootCause = rootCause.getCause();
                    }
                    assertTrue(rootCause.getMessage().contains("security.cookie.secure deve ser true"));
                    assertFalse(rootCause.getMessage().contains(STRONG_SECRET));
                });
    }

    @Test
    @DisplayName("HARD-01: Profile prod sem propriedade explícita usa o default seguro e inicializa")
    void shouldSucceedInProductionWhenCookieSecurePropertyIsAbsent() {
        when(environment.acceptsProfiles(any(Profiles.class))).thenReturn(true);
        when(environment.getProperty("security.jwt.secret")).thenReturn(STRONG_SECRET);
        when(environment.getProperty("cors.allowed-origins")).thenReturn(VALID_PROD_CORS);
        when(environment.getProperty("security.cookie.secure")).thenReturn(null);
        stubSecureSmtp();

        ProductionSecurityValidator validator = new ProductionSecurityValidator(environment);

        assertDoesNotThrow(validator::validate);
    }

    @Test
    @DisplayName("HARD-01: Dev/test continuam aceitando cookie Secure=false")
    void shouldAllowCookieSecureFalseOutsideProduction() {
        when(environment.acceptsProfiles(any(Profiles.class))).thenReturn(false);
        when(environment.getProperty("security.jwt.secret")).thenReturn(ProductionSecurityValidator.DEFAULT_DEV_JWT_SECRET);
        when(environment.getProperty("cors.allowed-origins")).thenReturn("http://localhost:3000");
        when(environment.getProperty("security.cookie.secure")).thenReturn("false");

        ProductionSecurityValidator validator = new ProductionSecurityValidator(environment);

        assertDoesNotThrow(validator::validate);
    }

    @Test
    @DisplayName("HARD-01: Property sources de maior precedência não burlam o fail-fast")
    void shouldRejectEffectiveFalseFromHigherPrecedencePropertySources() {
        for (String sourceName : new String[]{"systemProperties", "systemEnvironment", "spring.application.json"}) {
            StandardEnvironment effectiveEnvironment = new StandardEnvironment();
            effectiveEnvironment.setActiveProfiles("prod");
            effectiveEnvironment.getPropertySources().addLast(new MapPropertySource("secureProdDefaults", Map.ofEntries(
                    Map.entry("security.jwt.secret", STRONG_SECRET),
                    Map.entry("cors.allowed-origins", VALID_PROD_CORS),
                    Map.entry("security.cookie.secure", "true"),
                    Map.entry("spring.mail.host", "smtp.example.invalid"),
                    Map.entry("spring.mail.username", "mailer@example.invalid"),
                    Map.entry("spring.mail.password", "synthetic-password"),
                    Map.entry("app.mail.from", "mailer@example.invalid"),
                    Map.entry("spring.mail.properties.mail.smtp.auth", "true"),
                    Map.entry("spring.mail.properties.mail.smtp.starttls.enable", "true"),
                    Map.entry("spring.mail.properties.mail.smtp.connectiontimeout", "15000"),
                    Map.entry("spring.mail.properties.mail.smtp.timeout", "25000"),
                    Map.entry("spring.mail.properties.mail.smtp.writetimeout", "25000")
            )));
            effectiveEnvironment.getPropertySources().addFirst(new MapPropertySource(sourceName + "-hard01", Map.of(
                    "security.cookie.secure", "false"
            )));

            ProductionSecurityValidator validator = new ProductionSecurityValidator(effectiveEnvironment);
            IllegalStateException ex = assertThrows(IllegalStateException.class, validator::validate, sourceName);
            assertTrue(ex.getMessage().contains("security.cookie.secure deve ser true"), sourceName);
        }
    }

    @Test
    @DisplayName("ACH-01: Profile prod com timeout zero (infinito) deve ser rejeitado")
    void shouldFailInProductionWhenTimeoutIsZero() {
        when(environment.acceptsProfiles(any(Profiles.class))).thenReturn(true);
        when(environment.getProperty("security.jwt.secret")).thenReturn(STRONG_SECRET);
        when(environment.getProperty("cors.allowed-origins")).thenReturn(VALID_PROD_CORS);
        when(environment.getProperty("security.cookie.secure")).thenReturn("true");
        when(environment.getProperty("spring.mail.host")).thenReturn("smtp.example.invalid");
        when(environment.getProperty("spring.mail.username")).thenReturn("mailer@example.invalid");
        when(environment.getProperty("spring.mail.password")).thenReturn("synthetic-password");
        when(environment.getProperty("app.mail.from")).thenReturn("mailer@example.invalid");
        when(environment.getProperty("spring.mail.properties.mail.smtp.auth")).thenReturn("true");
        when(environment.getProperty("spring.mail.properties.mail.smtp.starttls.enable")).thenReturn("true");
        when(environment.getProperty("spring.mail.properties.mail.smtp.connectiontimeout")).thenReturn("0");

        ProductionSecurityValidator validator = new ProductionSecurityValidator(environment);

        IllegalStateException ex = assertThrows(IllegalStateException.class, validator::validate);
        assertTrue(ex.getMessage().contains("MAIL_CONNECTION_TIMEOUT"));
        assertTrue(ex.getMessage().contains("maior que zero"));
    }

    @Test
    @DisplayName("ACH-01: Profile prod com timeout menor que 1000ms deve ser rejeitado")
    void shouldFailInProductionWhenTimeoutIsTooLow() {
        when(environment.acceptsProfiles(any(Profiles.class))).thenReturn(true);
        when(environment.getProperty("security.jwt.secret")).thenReturn(STRONG_SECRET);
        when(environment.getProperty("cors.allowed-origins")).thenReturn(VALID_PROD_CORS);
        when(environment.getProperty("security.cookie.secure")).thenReturn("true");
        when(environment.getProperty("spring.mail.host")).thenReturn("smtp.example.invalid");
        when(environment.getProperty("spring.mail.username")).thenReturn("mailer@example.invalid");
        when(environment.getProperty("spring.mail.password")).thenReturn("synthetic-password");
        when(environment.getProperty("app.mail.from")).thenReturn("mailer@example.invalid");
        when(environment.getProperty("spring.mail.properties.mail.smtp.auth")).thenReturn("true");
        when(environment.getProperty("spring.mail.properties.mail.smtp.starttls.enable")).thenReturn("true");
        when(environment.getProperty("spring.mail.properties.mail.smtp.connectiontimeout")).thenReturn("15000");
        when(environment.getProperty("spring.mail.properties.mail.smtp.timeout")).thenReturn("500");

        ProductionSecurityValidator validator = new ProductionSecurityValidator(environment);

        IllegalStateException ex = assertThrows(IllegalStateException.class, validator::validate);
        assertTrue(ex.getMessage().contains("MAIL_READ_TIMEOUT"));
        assertTrue(ex.getMessage().contains("pelo menos 1000ms"));
    }

    @Test
    @DisplayName("ACH-01: Profile prod com timeout não numérico deve ser rejeitado")
    void shouldFailInProductionWhenTimeoutIsNonNumeric() {
        when(environment.acceptsProfiles(any(Profiles.class))).thenReturn(true);
        when(environment.getProperty("security.jwt.secret")).thenReturn(STRONG_SECRET);
        when(environment.getProperty("cors.allowed-origins")).thenReturn(VALID_PROD_CORS);
        when(environment.getProperty("security.cookie.secure")).thenReturn("true");
        when(environment.getProperty("spring.mail.host")).thenReturn("smtp.example.invalid");
        when(environment.getProperty("spring.mail.username")).thenReturn("mailer@example.invalid");
        when(environment.getProperty("spring.mail.password")).thenReturn("synthetic-password");
        when(environment.getProperty("app.mail.from")).thenReturn("mailer@example.invalid");
        when(environment.getProperty("spring.mail.properties.mail.smtp.auth")).thenReturn("true");
        when(environment.getProperty("spring.mail.properties.mail.smtp.starttls.enable")).thenReturn("true");
        when(environment.getProperty("spring.mail.properties.mail.smtp.connectiontimeout")).thenReturn("15000");
        when(environment.getProperty("spring.mail.properties.mail.smtp.timeout")).thenReturn("25000");
        when(environment.getProperty("spring.mail.properties.mail.smtp.writetimeout")).thenReturn("invalid-text");

        ProductionSecurityValidator validator = new ProductionSecurityValidator(environment);

        IllegalStateException ex = assertThrows(IllegalStateException.class, validator::validate);
        assertTrue(ex.getMessage().contains("MAIL_WRITE_TIMEOUT"));
        assertTrue(ex.getMessage().contains("numero inteiro valido"));
    }
}
