package com.oficinagestao.ordem;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface OrdemServicoItemRepository extends JpaRepository<OrdemServicoItem, Long> {

    @Query("SELECT i FROM OrdemServicoItem i JOIN FETCH i.produto p WHERE i.ordemServico.id = :ordemServicoId ORDER BY i.id ASC")
    List<OrdemServicoItem> findByOrdemServicoIdComProduto(@Param("ordemServicoId") Long ordemServicoId);

    Optional<OrdemServicoItem> findByIdAndOrdemServicoId(Long id, Long ordemServicoId);
}
