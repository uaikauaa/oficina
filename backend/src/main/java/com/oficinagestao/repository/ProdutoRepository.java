package com.oficinagestao.repository;

import com.oficinagestao.entity.*;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.Optional;

@Repository
public interface ProdutoRepository extends JpaRepository<Produto, Long> {

    boolean existsByCodigo(String codigo);

    boolean existsByCodigoAndIdNot(String codigo, Long id);

    Optional<Produto> findByCodigo(String codigo);

    /**
     * Busca o produto aplicando Lock Pessimista de Escrita (SELECT ... FOR UPDATE).
     * Essencial para garantir a consistÃªncia de estoque contra condiÃ§Ãµes de corrida (race conditions)
     * quando mÃºltiplas transaÃ§Ãµes simultÃ¢neas tentam baixar o saldo do mesmo componente.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Produto p WHERE p.id = :id")
    Optional<Produto> findByIdWithLock(@Param("id") Long id);

    @Query(value = "SELECT p FROM Produto p LEFT JOIN FETCH p.fornecedor f WHERE " +
            "(:termo IS NULL OR LOWER(p.codigo) LIKE LOWER(CONCAT('%', :termo, '%')) " +
            "  OR LOWER(p.nome) LIKE LOWER(CONCAT('%', :termo, '%')) " +
            "  OR (p.codigoBarras IS NOT NULL AND p.codigoBarras LIKE CONCAT('%', :termo, '%'))) " +
            "AND (:tipo IS NULL OR p.tipo = :tipo) " +
            "AND (:fornecedorId IS NULL OR f.id = :fornecedorId) " +
            "AND (:ativo IS NULL OR p.ativo = :ativo) " +
            "AND (:estoqueBaixo IS NULL OR (:estoqueBaixo = true AND p.estoqueAtual <= p.estoqueMinimo) " +
            "                           OR (:estoqueBaixo = false AND p.estoqueAtual > p.estoqueMinimo))",
            countQuery = "SELECT COUNT(p) FROM Produto p LEFT JOIN p.fornecedor f WHERE " +
                    "(:termo IS NULL OR LOWER(p.codigo) LIKE LOWER(CONCAT('%', :termo, '%')) " +
                    "  OR LOWER(p.nome) LIKE LOWER(CONCAT('%', :termo, '%')) " +
                    "  OR (p.codigoBarras IS NOT NULL AND p.codigoBarras LIKE CONCAT('%', :termo, '%'))) " +
                    "AND (:tipo IS NULL OR p.tipo = :tipo) " +
                    "AND (:fornecedorId IS NULL OR f.id = :fornecedorId) " +
                    "AND (:ativo IS NULL OR p.ativo = :ativo) " +
                    "AND (:estoqueBaixo IS NULL OR (:estoqueBaixo = true AND p.estoqueAtual <= p.estoqueMinimo) " +
                    "                           OR (:estoqueBaixo = false AND p.estoqueAtual > p.estoqueMinimo))")
    Page<Produto> pesquisarGlobal(
            @Param("termo") String termo,
            @Param("tipo") TipoProduto tipo,
            @Param("fornecedorId") Long fornecedorId,
            @Param("ativo") Boolean ativo,
            @Param("estoqueBaixo") Boolean estoqueBaixo,
            Pageable pageable
    );

    @Query("SELECT COUNT(p) FROM Produto p WHERE p.ativo = true AND p.estoqueAtual <= p.estoqueMinimo")
    long countEstoqueBaixo();

    @Query("SELECT COUNT(p) FROM Produto p WHERE p.ativo = true AND p.estoqueAtual <= 0")
    long countSemEstoque();

    @Query("SELECT COALESCE(SUM(p.estoqueAtual * p.precoCusto), 0) FROM Produto p WHERE p.ativo = true")
    BigDecimal somarValorTotalEstoque();
}
