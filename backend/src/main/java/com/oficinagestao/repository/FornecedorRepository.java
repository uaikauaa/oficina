package com.oficinagestao.repository;

import com.oficinagestao.entity.*;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface FornecedorRepository extends JpaRepository<Fornecedor, Long> {

    boolean existsByCnpj(String cnpj);

    boolean existsByCnpjAndIdNot(String cnpj, Long id);

    Optional<Fornecedor> findByCnpj(String cnpj);

    Page<Fornecedor> findByAtivoTrue(Pageable pageable);

    @Query("SELECT f FROM Fornecedor f WHERE " +
            "(CAST(:termo AS string) IS NULL OR LOWER(f.razaoSocial) LIKE LOWER(CONCAT('%', CAST(:termo AS string), '%')) " +
            "OR LOWER(f.nomeFantasia) LIKE LOWER(CONCAT('%', CAST(:termo AS string), '%')) " +
            "OR f.cnpj LIKE CONCAT('%', CAST(:termo AS string), '%')) " +
            "AND (:ativo IS NULL OR f.ativo = :ativo)")
    Page<Fornecedor> pesquisarGlobal(
            @Param("termo") String termo,
            @Param("ativo") Boolean ativo,
            Pageable pageable
    );
}
