package com.oficinagestao.repository;

import com.oficinagestao.entity.Categoria;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CategoriaRepository extends JpaRepository<Categoria, Long> {

    boolean existsByNomeIgnoreCase(String nome);

    boolean existsByNomeIgnoreCaseAndIdNot(String nome, Long id);

    Optional<Categoria> findByNomeIgnoreCase(String nome);

    List<Categoria> findByAtivoTrueOrderByNomeAsc();

    @Query("SELECT c FROM Categoria c WHERE " +
            "(CAST(:termo AS string) IS NULL OR LOWER(c.nome) LIKE LOWER(CONCAT('%', CAST(:termo AS string), '%')) " +
            "  OR (c.descricao IS NOT NULL AND LOWER(c.descricao) LIKE LOWER(CONCAT('%', CAST(:termo AS string), '%')))) " +
            "AND (:ativo IS NULL OR c.ativo = :ativo)")
    Page<Categoria> pesquisar(
            @Param("termo") String termo,
            @Param("ativo") Boolean ativo,
            Pageable pageable
    );
}
