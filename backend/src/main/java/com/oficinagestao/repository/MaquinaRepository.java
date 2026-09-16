package com.oficinagestao.repository;

import com.oficinagestao.entity.*;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MaquinaRepository extends JpaRepository<Maquina, Long> {

    @Query("SELECT m FROM Maquina m JOIN FETCH m.cliente c WHERE " +
           "LOWER(m.marca) LIKE LOWER(CONCAT('%', :termo, '%')) OR " +
           "LOWER(m.modelo) LIKE LOWER(CONCAT('%', :termo, '%')) OR " +
           "LOWER(COALESCE(m.numeroSerie, '')) LIKE LOWER(CONCAT('%', :termo, '%')) OR " +
           "LOWER(c.nomeRazaoSocial) LIKE LOWER(CONCAT('%', :termo, '%'))")
    List<Maquina> buscarRapida(@Param("termo") String termo, Pageable pageable);

    /** Conta quantos equipamentos (ativos ou não) pertencem a um cliente. */
    long countByClienteId(Long clienteId);

    /** Conta equipamentos ativos de um cliente (para exibiÃ§Ã£o no card do cliente). */
    long countByClienteIdAndAtivo(Long clienteId, Boolean ativo);

    /** Busca equipamento por ID com JOIN FETCH do cliente (evita N+1). */
    @Query("SELECT m FROM Maquina m JOIN FETCH m.cliente WHERE m.id = :id")
    Optional<Maquina> findByIdWithCliente(@Param("id") Long id);

    /**
     * Pesquisa paginada de equipamentos de um cliente especÃ­fico.
     * Filtros opcionais: tipo e status ativo.
     */
    @Query("SELECT m FROM Maquina m JOIN FETCH m.cliente c WHERE c.id = :clienteId " +
           "AND (:ativo IS NULL OR m.ativo = :ativo) " +
           "AND (:tipoEquipamento IS NULL OR m.tipoEquipamento = :tipoEquipamento) " +
           "AND (:termo IS NULL OR :termo = '' OR " +
           "     LOWER(m.marca) LIKE LOWER(CONCAT('%', :termo, '%')) OR " +
           "     LOWER(m.modelo) LIKE LOWER(CONCAT('%', :termo, '%')) OR " +
           "     LOWER(COALESCE(m.numeroSerie, '')) LIKE LOWER(CONCAT('%', :termo, '%')))")
    Page<Maquina> pesquisarPorCliente(
            @Param("clienteId") Long clienteId,
            @Param("termo") String termo,
            @Param("tipoEquipamento") TipoEquipamento tipoEquipamento,
            @Param("ativo") Boolean ativo,
            Pageable pageable
    );

    /**
     * Pesquisa paginada global de equipamentos (todos os clientes).
     * Filtros opcionais: tipo, ativo, e termo (marca, modelo, nÃºmero de sÃ©rie, nome do cliente).
     */
    @Query("SELECT m FROM Maquina m JOIN FETCH m.cliente c WHERE " +
           "(:ativo IS NULL OR m.ativo = :ativo) " +
           "AND (:tipoEquipamento IS NULL OR m.tipoEquipamento = :tipoEquipamento) " +
           "AND (:termo IS NULL OR :termo = '' OR " +
           "     LOWER(m.marca) LIKE LOWER(CONCAT('%', :termo, '%')) OR " +
           "     LOWER(m.modelo) LIKE LOWER(CONCAT('%', :termo, '%')) OR " +
           "     LOWER(COALESCE(m.numeroSerie, '')) LIKE LOWER(CONCAT('%', :termo, '%')) OR " +
           "     LOWER(c.nomeRazaoSocial) LIKE LOWER(CONCAT('%', :termo, '%')))")
    Page<Maquina> pesquisarGlobal(
            @Param("termo") String termo,
            @Param("tipoEquipamento") TipoEquipamento tipoEquipamento,
            @Param("ativo") Boolean ativo,
            Pageable pageable
    );
}
