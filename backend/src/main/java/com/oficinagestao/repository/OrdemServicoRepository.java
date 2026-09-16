package com.oficinagestao.repository;

import com.oficinagestao.entity.*;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.Optional;

@Repository
public interface OrdemServicoRepository extends JpaRepository<OrdemServico, Long> {

    @Query("SELECT os FROM OrdemServico os " +
           "JOIN FETCH os.cliente c " +
           "JOIN FETCH os.maquina m " +
           "LEFT JOIN FETCH os.tecnicoResponsavel " +
           "WHERE os.id = :id")
    Optional<OrdemServico> findByIdWithClienteAndMaquina(@Param("id") Long id);

    Optional<OrdemServico> findByNumeroOs(String numeroOs);

    boolean existsByNumeroOs(String numeroOs);

    @Query("SELECT COUNT(os) FROM OrdemServico os WHERE os.numeroOs LIKE :prefixo%")
    long countByPrefixo(@Param("prefixo") String prefixo);

    long countByClienteId(Long clienteId);

    long countByMaquinaId(Long maquinaId);

    /**
     * Pesquisa global com filtros por termo (nÃºmero OS, cliente, equipamento, nÃºmero de sÃ©rie),
     * status e perÃ­odo de entrada.
     */
    @Query("SELECT os FROM OrdemServico os " +
           "JOIN FETCH os.cliente c " +
           "JOIN FETCH os.maquina m " +
           "WHERE (:termo IS NULL OR (" +
           "   LOWER(os.numeroOs) LIKE LOWER(CONCAT('%', :termo, '%')) OR " +
           "   LOWER(c.nomeRazaoSocial) LIKE LOWER(CONCAT('%', :termo, '%')) OR " +
           "   (c.cpfCnpj IS NOT NULL AND c.cpfCnpj LIKE CONCAT('%', :termo, '%')) OR " +
           "   LOWER(m.marca) LIKE LOWER(CONCAT('%', :termo, '%')) OR " +
           "   LOWER(m.modelo) LIKE LOWER(CONCAT('%', :termo, '%')) OR " +
           "   (m.numeroSerie IS NOT NULL AND LOWER(m.numeroSerie) LIKE LOWER(CONCAT('%', :termo, '%'))) " +
           ")) " +
           "AND (:status IS NULL OR os.status = :status) " +
           "AND (CAST(:dataInicio AS java.time.OffsetDateTime) IS NULL OR os.dataEntrada >= :dataInicio) " +
           "AND (CAST(:dataFim AS java.time.OffsetDateTime) IS NULL OR os.dataEntrada <= :dataFim)")
    Page<OrdemServico> pesquisarGlobal(
            @Param("termo") String termo,
            @Param("status") StatusOrdemServico status,
            @Param("dataInicio") OffsetDateTime dataInicio,
            @Param("dataFim") OffsetDateTime dataFim,
            Pageable pageable
    );

    /**
     * Consulta paginada do histÃ³rico de Ordens de ServiÃ§o de um cliente especÃ­fico.
     */
    @Query("SELECT os FROM OrdemServico os " +
           "JOIN FETCH os.cliente c " +
           "JOIN FETCH os.maquina m " +
           "WHERE c.id = :clienteId " +
           "AND (:status IS NULL OR os.status = :status)")
    Page<OrdemServico> pesquisarPorCliente(
            @Param("clienteId") Long clienteId,
            @Param("status") StatusOrdemServico status,
            Pageable pageable
    );

    /**
     * Consulta paginada do histÃ³rico completo de manutenÃ§Ãµes de um equipamento especÃ­fico.
     */
    @Query("SELECT os FROM OrdemServico os " +
           "JOIN FETCH os.cliente c " +
           "JOIN FETCH os.maquina m " +
           "WHERE m.id = :maquinaId")
    Page<OrdemServico> pesquisarPorMaquina(
            @Param("maquinaId") Long maquinaId,
            Pageable pageable
    );
}
