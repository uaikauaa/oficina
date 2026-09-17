package com.oficinagestao.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProductionSecurityValidatorTest {

    @Mock
    private Environment environment;

    private static final String STRONG_SECRET = "chave-secreta-de-producao-com-mais-de-32-caracteres-para-hmac-sha256";
    private static final String VALID_PROD_CORS = "https://app.oficinagestao.com.br";

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
    @DisplayName("PROD001-01 & PROD001-03: Profile prod com secret forte e CORS válido deve inicializar com sucesso")
    void shouldSucceedInProductionWithValidConfigurations() {
        when(environment.acceptsProfiles(any(Profiles.class))).thenReturn(true);
        when(environment.getProperty("security.jwt.secret")).thenReturn(STRONG_SECRET);
        when(environment.getProperty("cors.allowed-origins")).thenReturn(VALID_PROD_CORS);

        ProductionSecurityValidator validator = new ProductionSecurityValidator(environment);

        assertDoesNotThrow(validator::validate);
    }

    @Test
    @DisplayName("Ambiente de desenvolvimento/testes: permite chave padrão sem bloquear inicialização")
    void shouldAllowDefaultSecretInDevelopment() {
        when(environment.acceptsProfiles(any(Profiles.class))).thenReturn(false);
        when(environment.getProperty("security.jwt.secret")).thenReturn(ProductionSecurityValidator.DEFAULT_DEV_JWT_SECRET);
        when(environment.getProperty("cors.allowed-origins")).thenReturn("http://localhost:3000");

        ProductionSecurityValidator validator = new ProductionSecurityValidator(environment);

        assertDoesNotThrow(validator::validate);
    }
}
