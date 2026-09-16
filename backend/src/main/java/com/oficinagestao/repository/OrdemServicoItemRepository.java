package com.oficinagestao.repository;

import com.oficinagestao.entity.*;

import com.oficinagestao.dto.PecaMaisUtilizadaDTO;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
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

    boolean existsByOrdemServicoIdAndTipoItem(Long ordemServicoId, TipoItemOrdemServico tipoItem);

    @Query("SELECT new com.oficinagestao.dto.PecaMaisUtilizadaDTO(" +
           "p.id, p.codigo, p.nome, p.marca, SUM(i.quantidade), COUNT(DISTINCT i.ordemServico.id)) " +
           "FROM OrdemServicoItem i JOIN i.produto p " +
           "WHERE i.tipoItem = com.oficinagestao.entity.TipoItemOrdemServico.PECA " +
           "GROUP BY p.id, p.codigo, p.nome, p.marca " +
           "ORDER BY SUM(i.quantidade) DESC")
    Page<PecaMaisUtilizadaDTO> relatorioPecasMaisUtilizadas(Pageable pageable);
}
