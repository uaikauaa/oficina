package com.oficinagestao.repository;

import com.oficinagestao.entity.Produto;
import com.oficinagestao.entity.TipoProduto;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Repository
public interface ProdutoRepository extends JpaRepository<Produto, Long> {

    @Query("SELECT p FROM Produto p WHERE " +
           "p.ativo = true AND (" +
           "  LOWER(p.codigo) LIKE LOWER(CONCAT('%', CAST(:termo AS string), '%')) " +
           "  OR LOWER(p.nome) LIKE LOWER(CONCAT('%', CAST(:termo AS string), '%')) " +
           "  OR (p.marca IS NOT NULL AND LOWER(p.marca) LIKE LOWER(CONCAT('%', CAST(:termo AS string), '%'))))")
    List<Produto> buscarRapida(@Param("termo") String termo, Pageable pageable);

    boolean existsByCodigo(String codigo);

    boolean existsByCodigoAndIdNot(String codigo, Long id);

    /**
     * Busca o produto aplicando Lock Pessimista de Escrita (SELECT ... FOR UPDATE).
     * Essencial para garantir a consistência de estoque contra condições de corrida (race conditions)
     * quando múltiplas transações simultâneas tentam baixar o saldo do mesmo componente.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Produto p WHERE p.id = :id")
    Optional<Produto> findByIdWithLock(@Param("id") Long id);

    @Query(value = "SELECT p FROM Produto p " +
            "LEFT JOIN FETCH p.categoria c " +
            "LEFT JOIN FETCH p.fornecedor f WHERE " +
            "(CAST(:termo AS string) IS NULL OR LOWER(p.codigo) LIKE LOWER(CONCAT('%', CAST(:termo AS string), '%')) " +
            "  OR LOWER(p.nome) LIKE LOWER(CONCAT('%', CAST(:termo AS string), '%')) " +
            "  OR (p.marca IS NOT NULL AND LOWER(p.marca) LIKE LOWER(CONCAT('%', CAST(:termo AS string), '%'))) " +
            "  OR (p.codigoBarras IS NOT NULL AND p.codigoBarras LIKE CONCAT('%', CAST(:termo AS string), '%'))) " +
            "AND (:tipo IS NULL OR p.tipo = :tipo) " +
            "AND (:categoriaId IS NULL OR (c IS NOT NULL AND c.id = :categoriaId)) " +
            "AND (:fornecedorId IS NULL OR (f IS NOT NULL AND f.id = :fornecedorId)) " +
            "AND (:ativo IS NULL OR p.ativo = :ativo) " +
            "AND (:estoqueBaixo IS NULL OR (:estoqueBaixo = true AND p.estoqueAtual <= p.estoqueMinimo) " +
            "                           OR (:estoqueBaixo = false AND p.estoqueAtual > p.estoqueMinimo))",
            countQuery = "SELECT COUNT(p) FROM Produto p " +
                    "LEFT JOIN p.categoria c " +
                    "LEFT JOIN p.fornecedor f WHERE " +
                    "(CAST(:termo AS string) IS NULL OR LOWER(p.codigo) LIKE LOWER(CONCAT('%', CAST(:termo AS string), '%')) " +
                    "  OR LOWER(p.nome) LIKE LOWER(CONCAT('%', CAST(:termo AS string), '%')) " +
                    "  OR (p.marca IS NOT NULL AND LOWER(p.marca) LIKE LOWER(CONCAT('%', CAST(:termo AS string), '%'))) " +
                    "  OR (p.codigoBarras IS NOT NULL AND p.codigoBarras LIKE CONCAT('%', CAST(:termo AS string), '%'))) " +
                    "AND (:tipo IS NULL OR p.tipo = :tipo) " +
                    "AND (:categoriaId IS NULL OR (c IS NOT NULL AND c.id = :categoriaId)) " +
                    "AND (:fornecedorId IS NULL OR (f IS NOT NULL AND f.id = :fornecedorId)) " +
                    "AND (:ativo IS NULL OR p.ativo = :ativo) " +
                    "AND (:estoqueBaixo IS NULL OR (:estoqueBaixo = true AND p.estoqueAtual <= p.estoqueMinimo) " +
                    "                           OR (:estoqueBaixo = false AND p.estoqueAtual > p.estoqueMinimo))")
    Page<Produto> pesquisarGlobal(
            @Param("termo") String termo,
            @Param("tipo") TipoProduto tipo,
            @Param("categoriaId") Long categoriaId,
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

    @Query(value = "SELECT p FROM Produto p " +
            "LEFT JOIN FETCH p.categoria c " +
            "LEFT JOIN FETCH p.fornecedor f WHERE " +
            "p.ativo = true " +
            "AND (:categoriaId IS NULL OR (c IS NOT NULL AND c.id = :categoriaId)) " +
            "AND (:fornecedorId IS NULL OR (f IS NOT NULL AND f.id = :fornecedorId)) " +
            "AND (:estoqueBaixo IS NULL OR (:estoqueBaixo = true AND p.estoqueAtual <= p.estoqueMinimo)) " +
            "AND (:zerado IS NULL OR (:zerado = true AND p.estoqueAtual <= 0))",
            countQuery = "SELECT COUNT(p) FROM Produto p " +
                    "LEFT JOIN p.categoria c " +
                    "LEFT JOIN p.fornecedor f WHERE " +
                    "p.ativo = true " +
                    "AND (:categoriaId IS NULL OR (c IS NOT NULL AND c.id = :categoriaId)) " +
                    "AND (:fornecedorId IS NULL OR (f IS NOT NULL AND f.id = :fornecedorId)) " +
                    "AND (:estoqueBaixo IS NULL OR (:estoqueBaixo = true AND p.estoqueAtual <= p.estoqueMinimo)) " +
                    "AND (:zerado IS NULL OR (:zerado = true AND p.estoqueAtual <= 0))")
    Page<Produto> relatorioEstoque(
            @Param("categoriaId") Long categoriaId,
            @Param("fornecedorId") Long fornecedorId,
            @Param("estoqueBaixo") Boolean estoqueBaixo,
            @Param("zerado") Boolean zerado,
            Pageable pageable
    );
}
