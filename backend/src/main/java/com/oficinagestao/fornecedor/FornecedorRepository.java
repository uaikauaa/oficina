package com.oficinagestao.fornecedor;

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
            "(:termo IS NULL OR LOWER(f.razaoSocial) LIKE LOWER(CONCAT('%', :termo, '%')) " +
            "OR LOWER(f.nomeFantasia) LIKE LOWER(CONCAT('%', :termo, '%')) " +
            "OR f.cnpj LIKE CONCAT('%', :termo, '%')) " +
            "AND (:ativo IS NULL OR f.ativo = :ativo)")
    Page<Fornecedor> pesquisarGlobal(
            @Param("termo") String termo,
            @Param("ativo") Boolean ativo,
            Pageable pageable
    );
}
