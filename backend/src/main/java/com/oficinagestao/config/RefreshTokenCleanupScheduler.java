package com.oficinagestao.config;

import com.oficinagestao.service.AuthService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Agendador periódico de limpeza e purga de Refresh Tokens expirados ou revogados (ISSUE-08).
 * Executa rotineiramente na madrugada (padrão: 03:00 da manhã) para manter a tabela de tokens enxuta
 * e com desempenho otimizado no PostgreSQL.
 */
@Component
public class RefreshTokenCleanupScheduler {

    private static final Logger log = LoggerFactory.getLogger(RefreshTokenCleanupScheduler.class);

    private final AuthService authService;

    public RefreshTokenCleanupScheduler(AuthService authService) {
        this.authService = authService;
    }

    /**
     * Executa diariamente às 03:00 da manhã no fuso do servidor.
     */
    @Scheduled(cron = "${security.jwt.refresh-token-cleanup-cron:0 0 3 * * ?}")
    public void limparRefreshTokensExpirados() {
        log.info("Iniciando rotina agendada de purga de refresh tokens expirados e revogados...");
        try {
            int totalRemovidos = authService.purgarTokensExpiradosOuRevogados();
            log.info("Rotina agendada de purga finalizada com sucesso. {} token(s) removido(s).", totalRemovidos);
        } catch (Exception e) {
            log.error("Erro durante a execução da purga agendada de refresh tokens: {}", e.getMessage(), e);
        }
    }
}
