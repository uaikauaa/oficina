package com.oficinagestao.repository;

import com.oficinagestao.entity.DpsFiscal;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DpsFiscalRepository extends JpaRepository<DpsFiscal, Long> {

    List<DpsFiscal> findByOrdemServicoIdOrderByDataEmissaoDesc(Long ordemServicoId);

    Optional<DpsFiscal> findTopByOrdemServicoIdOrderByDataEmissaoDesc(Long ordemServicoId);

    Optional<DpsFiscal> findBySerieAndNumero(String serie, Long numero);

    boolean existsBySerieAndNumero(String serie, Long numero);

    Page<DpsFiscal> findAllByOrderByDataEmissaoDesc(Pageable pageable);
}
