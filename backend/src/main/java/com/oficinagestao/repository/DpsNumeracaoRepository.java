package com.oficinagestao.repository;

import com.oficinagestao.entity.DpsNumeracao;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface DpsNumeracaoRepository extends JpaRepository<DpsNumeracao, Long> {

    Optional<DpsNumeracao> findBySerie(String serie);

    /**
     * Busca a numeração da série com lock pessimista para escrita,
     * garantindo incremento atômico e evitando concorrência/duplicidade.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT d FROM DpsNumeracao d WHERE d.serie = :serie")
    Optional<DpsNumeracao> findBySerieWithLock(@Param("serie") String serie);
}
