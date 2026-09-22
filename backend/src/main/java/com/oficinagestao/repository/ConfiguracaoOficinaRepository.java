package com.oficinagestao.repository;

import com.oficinagestao.entity.ConfiguracaoOficina;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Repositório da configuração singleton da oficina.
 * A tabela contém exatamente um registro; utilize findFirstById para recuperar.
 */
@Repository
public interface ConfiguracaoOficinaRepository extends JpaRepository<ConfiguracaoOficina, Long> {

    /** Retorna o primeiro (e único) registro de configuração da oficina. */
    Optional<ConfiguracaoOficina> findFirstByOrderByIdAsc();
}
