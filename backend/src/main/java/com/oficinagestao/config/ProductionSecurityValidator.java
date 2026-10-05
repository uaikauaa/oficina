package com.oficinagestao.config;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/**
 * Validador de Segurança de Produção (PROD001-01 & PROD001-03).
 * Garante que a aplicação falhe de forma segura durante a inicialização (fail-fast)
 * se estiver em ambiente de produção (profile 'prod' ou 'production') e secrets
 * obrigatórios ou configurações inseguras forem detectadas.
 */
@Component
public class ProductionSecurityValidator {

    private static final Logger log = LoggerFactory.getLogger(ProductionSecurityValidator.class);

    public static final String DEFAULT_DEV_JWT_SECRET = com.oficinagestao.security.JwtService.DEFAULT_DEV_SECRET;

    private final Environment environment;

    public ProductionSecurityValidator(Environment environment) {
        this.environment = environment;
    }

    @PostConstruct
    public void validate() {
        boolean isProduction = com.oficinagestao.security.JwtService.isProductionEnvironment(environment);

        String jwtSecret = environment.getProperty("security.jwt.secret");
        String corsOrigins = environment.getProperty("cors.allowed-origins");
        String cookieSecure = environment.getProperty("security.cookie.secure");

        if (isProduction) {
            log.info("Executando validação mandatória de segurança para o profile de Produção...");

            // 1. Validação centralizada e unificada do JWT_SECRET via JwtService
            com.oficinagestao.security.JwtService.validarSecretParaAmbiente(jwtSecret, environment);

            // 2. Validação de CORS
            if (corsOrigins == null || corsOrigins.isBlank()) {
                throw new IllegalStateException("FALHA DE CONFIGURAÇÃO EM PRODUÇÃO: A variável CORS_ALLOWED_ORIGINS é mandatória e não pode estar vazia.");
            }

            if (corsOrigins.contains("localhost") || corsOrigins.contains("127.0.0.1")) {
                throw new IllegalStateException("FALHA DE SEGURANÇA EM PRODUÇÃO: CORS_ALLOWED_ORIGINS não pode conter referências a 'localhost' ou '127.0.0.1' em ambiente de produção.");
            }

            if (corsOrigins.contains("*")) {
                throw new IllegalStateException("FALHA DE SEGURANÇA EM PRODUÇÃO: CORS_ALLOWED_ORIGINS não pode conter wildcard '*' quando autenticação com cookies seguros está habilitada.");
            }

            // HARD-01: valida o valor efetivo do Environment, incluindo qualquer
            // override de maior precedência (env, system property ou JSON).
            // Ausência é permitida porque o profile prod possui default seguro=true.
            if (cookieSecure != null && !"true".equalsIgnoreCase(cookieSecure.trim())) {
                throw new IllegalStateException("FALHA DE SEGURANÇA EM PRODUÇÃO: security.cookie.secure deve ser true para cookies de autenticação.");
            }

            // SMTP transporta o segundo fator de autenticacao. Em producao, os
            // valores efetivos do Environment devem impedir credenciais vazias e
            // transporte sem autenticacao ou STARTTLS.
            requireNonBlank("MAIL_HOST", "spring.mail.host");
            requireNonBlank("MAIL_USERNAME", "spring.mail.username");
            requireNonBlank("MAIL_PASSWORD", "spring.mail.password");
            requireNonBlank("MAIL_FROM", "app.mail.from");
            requireTrue("MAIL_SMTP_AUTH", "spring.mail.properties.mail.smtp.auth");
            requireTrue("MAIL_SMTP_STARTTLS", "spring.mail.properties.mail.smtp.starttls.enable");

            log.info("Validação de segurança de produção aprovada com sucesso. JWT_SECRET forte, CORS estrito, cookies Secure e SMTP seguro validados.");
        } else {
            // Em desenvolvimento / testes
            if (jwtSecret != null && DEFAULT_DEV_JWT_SECRET.equals(jwtSecret.trim())) {
                log.info("Ambiente de desenvolvimento/testes: utilizando chave JWT padrão de desenvolvimento.");
            }
        }
    }

    private void requireNonBlank(String environmentName, String propertyName) {
        String value = environment.getProperty(propertyName);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(
                    "FALHA DE CONFIGURACAO EM PRODUCAO: " + environmentName + " e obrigatoria e nao pode estar vazia."
            );
        }
    }

    private void requireTrue(String environmentName, String propertyName) {
        String value = environment.getProperty(propertyName);
        if (!"true".equalsIgnoreCase(value != null ? value.trim() : "")) {
            throw new IllegalStateException(
                    "FALHA DE SEGURANCA EM PRODUCAO: " + environmentName + " deve ser true."
            );
        }
    }
}
