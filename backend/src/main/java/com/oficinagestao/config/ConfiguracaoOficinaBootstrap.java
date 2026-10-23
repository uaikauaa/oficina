package com.oficinagestao.config;

import com.oficinagestao.exception.ConfiguracaoOficinaIndisponivelException;
import com.oficinagestao.repository.ConfiguracaoOficinaRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Valida a configuração criada pelas migrations, sem inserir ou reparar dados.
 * Inconsistências permitem o startup degradado; os consumidores falham de forma controlada.
 */
@Component
@Order(10)
public class ConfiguracaoOficinaBootstrap implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(ConfiguracaoOficinaBootstrap.class);

    private final ConfiguracaoOficinaRepository repository;

    public ConfiguracaoOficinaBootstrap(ConfiguracaoOficinaRepository repository) {
        this.repository = repository;
    }

    @Override
    @Transactional(readOnly = true)
    public void run(ApplicationArguments args) {
        long quantidade = repository.count();
        if (quantidade == 0) {
            log.error("{}: configuração da oficina ausente; necessária recuperação administrativa controlada. Operação degradada.",
                    ConfiguracaoOficinaIndisponivelException.MISSING_CODE);
        } else if (quantidade != 1) {
            log.error("{}: anomalia de integridade na configuração da oficina; necessária investigação administrativa. Operação degradada.",
                    ConfiguracaoOficinaIndisponivelException.INTEGRITY_CODE);
        } else {
            log.info("Validação da configuração da oficina concluída com sucesso.");
        }
    }
}
