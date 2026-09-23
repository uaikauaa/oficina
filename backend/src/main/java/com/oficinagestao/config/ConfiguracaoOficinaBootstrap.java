package com.oficinagestao.config;

import com.oficinagestao.entity.ConfiguracaoOficina;
import com.oficinagestao.repository.ConfiguracaoOficinaRepository;
import com.oficinagestao.service.ConfiguracaoOficinaService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Bootstrap da configuração da oficina.
 *
 * Garante que a oficina Bruno Soldas esteja inicializada no banco de dados na inicialização
 * da aplicação, evitando qualquer possibilidade de retorno 404 em /api/configuracao-oficina.
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
    @Transactional
    public void run(ApplicationArguments args) {
        if (repository.count() == 0) {
            ConfiguracaoOficina config = ConfiguracaoOficinaService.criarConfiguracaoPadrao();
            repository.save(config);
            log.info("Inicialização: Configuração inicial da oficina criada com sucesso para: [{}] (CNPJ: {}).",
                    config.getNomeFantasia(), config.getCnpj());
        } else {
            log.info("Inicialização: Configuração da oficina já presente no banco de dados.");
        }
    }
}
