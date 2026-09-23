package com.oficinagestao.repository;

import com.oficinagestao.entity.EstoqueMovimentacao;
import com.oficinagestao.entity.TipoMovimentacaoEstoque;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;

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
            "AND (CAST(:numeroOs AS string) IS NULL OR (os IS NOT NULL AND LOWER(os.numeroOs) LIKE LOWER(CONCAT('%', CAST(:numeroOs AS string), '%')))) " +
            "AND (CAST(:termo AS string) IS NULL OR CAST(:termo AS string) = '' OR " +
            "     LOWER(p.nome) LIKE LOWER(CONCAT('%', CAST(:termo AS string), '%')) OR " +
            "     LOWER(p.codigo) LIKE LOWER(CONCAT('%', CAST(:termo AS string), '%')) OR " +
            "     (u IS NOT NULL AND LOWER(u.nome) LIKE LOWER(CONCAT('%', CAST(:termo AS string), '%'))))",
            countQuery = "SELECT COUNT(m) FROM EstoqueMovimentacao m " +
                    "LEFT JOIN m.produto p " +
                    "LEFT JOIN m.usuario u " +
                    "LEFT JOIN m.ordemServico os " +
                    "WHERE (:produtoId IS NULL OR p.id = :produtoId) " +
                    "AND (:tipo IS NULL OR m.tipoMovimentacao = :tipo) " +
                    "AND (CAST(:dataInicio AS java.time.OffsetDateTime) IS NULL OR m.dataMovimentacao >= :dataInicio) " +
                    "AND (CAST(:dataFim AS java.time.OffsetDateTime) IS NULL OR m.dataMovimentacao <= :dataFim) " +
                    "AND (CAST(:numeroOs AS string) IS NULL OR (os IS NOT NULL AND LOWER(os.numeroOs) LIKE LOWER(CONCAT('%', CAST(:numeroOs AS string), '%')))) " +
                    "AND (CAST(:termo AS string) IS NULL OR CAST(:termo AS string) = '' OR " +
                    "     LOWER(p.nome) LIKE LOWER(CONCAT('%', CAST(:termo AS string), '%')) OR " +
                    "     LOWER(p.codigo) LIKE LOWER(CONCAT('%', CAST(:termo AS string), '%')) OR " +
                    "     (u IS NOT NULL AND LOWER(u.nome) LIKE LOWER(CONCAT('%', CAST(:termo AS string), '%'))))")
    Page<EstoqueMovimentacao> pesquisarHistorico(
            @Param("produtoId") Long produtoId,
            @Param("tipo") TipoMovimentacaoEstoque tipo,
            @Param("dataInicio") OffsetDateTime dataInicio,
            @Param("dataFim") OffsetDateTime dataFim,
            @Param("numeroOs") String numeroOs,
            @Param("termo") String termo,
            Pageable pageable
    );
}
