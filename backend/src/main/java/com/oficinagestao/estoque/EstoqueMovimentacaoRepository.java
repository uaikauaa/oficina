package com.oficinagestao.estoque;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;

@Repository
public interface EstoqueMovimentacaoRepository extends JpaRepository<EstoqueMovimentacao, Long> {

    @Query(value = "SELECT m FROM EstoqueMovimentacao m " +
            "JOIN FETCH m.produto p " +
            "LEFT JOIN FETCH m.usuario u " +
            "LEFT JOIN FETCH m.ordemServico os " +
            "WHERE (:produtoId IS NULL OR p.id = :produtoId) " +
            "AND (:tipo IS NULL OR m.tipoMovimentacao = :tipo) " +
            "AND (CAST(:dataInicio AS java.time.OffsetDateTime) IS NULL OR m.dataMovimentacao >= :dataInicio) " +
            "AND (CAST(:dataFim AS java.time.OffsetDateTime) IS NULL OR m.dataMovimentacao <= :dataFim) " +
            "AND (:numeroOs IS NULL OR (os IS NOT NULL AND LOWER(os.numeroOs) LIKE LOWER(CONCAT('%', :numeroOs, '%'))))",
            countQuery = "SELECT COUNT(m) FROM EstoqueMovimentacao m " +
                    "LEFT JOIN m.ordemServico os " +
                    "WHERE (:produtoId IS NULL OR m.produto.id = :produtoId) " +
                    "AND (:tipo IS NULL OR m.tipoMovimentacao = :tipo) " +
                    "AND (CAST(:dataInicio AS java.time.OffsetDateTime) IS NULL OR m.dataMovimentacao >= :dataInicio) " +
                    "AND (CAST(:dataFim AS java.time.OffsetDateTime) IS NULL OR m.dataMovimentacao <= :dataFim) " +
                    "AND (:numeroOs IS NULL OR (os IS NOT NULL AND LOWER(os.numeroOs) LIKE LOWER(CONCAT('%', :numeroOs, '%'))))")
    Page<EstoqueMovimentacao> pesquisarHistorico(
            @Param("produtoId") Long produtoId,
            @Param("tipo") TipoMovimentacaoEstoque tipo,
            @Param("dataInicio") OffsetDateTime dataInicio,
            @Param("dataFim") OffsetDateTime dataFim,
            @Param("numeroOs") String numeroOs,
            Pageable pageable
    );

    List<EstoqueMovimentacao> findByOrdemServicoId(Long ordemServicoId);
}
