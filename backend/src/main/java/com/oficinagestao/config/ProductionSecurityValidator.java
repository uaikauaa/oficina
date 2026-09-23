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

            log.info("Validação de segurança de produção aprovada com sucesso. JWT_SECRET forte e CORS estrito validados.");
        } else {
            // Em desenvolvimento / testes
            if (jwtSecret != null && DEFAULT_DEV_JWT_SECRET.equals(jwtSecret.trim())) {
                log.info("Ambiente de desenvolvimento/testes: utilizando chave JWT padrão de desenvolvimento.");
            }
        }
    }
}
