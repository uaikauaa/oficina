package com.oficinagestao.repository;

import com.oficinagestao.entity.OrdemServico;
import com.oficinagestao.entity.StatusOrdemServico;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface OrdemServicoRepository extends JpaRepository<OrdemServico, Long> {

    @Query("SELECT os FROM OrdemServico os " +
           "JOIN FETCH os.cliente c " +
           "JOIN FETCH os.maquina m " +
           "LEFT JOIN FETCH os.tecnicoResponsavel " +
           "WHERE os.id = :id")
    Optional<OrdemServico> findByIdWithClienteAndMaquina(@Param("id") Long id);

    boolean existsByNumeroOs(String numeroOs);

    @Query(value = "SELECT nextval('ordens_servico_seq')", nativeQuery = true)
    Long getProximoSequencialOs();

    @Query("SELECT COUNT(os) FROM OrdemServico os WHERE os.numeroOs LIKE :prefixo%")
    long countByPrefixo(@Param("prefixo") String prefixo);

    long countByClienteId(Long clienteId);

    long countByMaquinaId(Long maquinaId);

    @Query("SELECT COALESCE(SUM(os.valorTotal), 0) FROM OrdemServico os " +
           "WHERE os.maquina.id = :maquinaId AND os.status = com.oficinagestao.entity.StatusOrdemServico.CONCLUIDA")
    BigDecimal somarValorTotalConcluidasPorMaquina(@Param("maquinaId") Long maquinaId);

    @Query("SELECT COALESCE(SUM(os.valorTotal), 0) FROM OrdemServico os " +
           "WHERE os.cliente.id = :clienteId AND os.status = com.oficinagestao.entity.StatusOrdemServico.CONCLUIDA")
    BigDecimal somarValorTotalConcluidasPorCliente(@Param("clienteId") Long clienteId);

    @Query("SELECT COUNT(os) FROM OrdemServico os " +
           "WHERE os.cliente.id = :clienteId AND os.status NOT IN (com.oficinagestao.entity.StatusOrdemServico.CONCLUIDA, com.oficinagestao.entity.StatusOrdemServico.CANCELADA)")
    long countOsAbertasPorCliente(@Param("clienteId") Long clienteId);

    Optional<OrdemServico> findFirstByMaquinaIdOrderByDataEntradaDesc(Long maquinaId);

    Optional<OrdemServico> findFirstByClienteIdOrderByDataEntradaDesc(Long clienteId);

    @Query("SELECT os FROM OrdemServico os " +
           "JOIN FETCH os.cliente c " +
           "JOIN FETCH os.maquina m " +
           "WHERE LOWER(os.numeroOs) LIKE LOWER(CONCAT('%', CAST(:termo AS string), '%')) " +
           "   OR LOWER(c.nomeRazaoSocial) LIKE LOWER(CONCAT('%', CAST(:termo AS string), '%')) " +
           "   OR (m.numeroSerie IS NOT NULL AND LOWER(m.numeroSerie) LIKE LOWER(CONCAT('%', CAST(:termo AS string), '%')))")
    List<OrdemServico> buscarRapidaOs(@Param("termo") String termo, Pageable pageable);

    /**
     * Pesquisa global com filtros por termo (número OS, cliente, equipamento, número de série),
     * status e período de entrada.
     */
    @Query("SELECT os FROM OrdemServico os " +
           "JOIN FETCH os.cliente c " +
           "JOIN FETCH os.maquina m " +
           "WHERE (CAST(:termo AS string) IS NULL OR (" +
           "   LOWER(os.numeroOs) LIKE LOWER(CONCAT('%', CAST(:termo AS string), '%')) OR " +
           "   LOWER(c.nomeRazaoSocial) LIKE LOWER(CONCAT('%', CAST(:termo AS string), '%')) OR " +
           "   (c.cpfCnpj IS NOT NULL AND c.cpfCnpj LIKE CONCAT('%', CAST(:termo AS string), '%')) OR " +
           "   LOWER(m.marca) LIKE LOWER(CONCAT('%', CAST(:termo AS string), '%')) OR " +
           "   LOWER(m.modelo) LIKE LOWER(CONCAT('%', CAST(:termo AS string), '%')) OR " +
           "   (m.numeroSerie IS NOT NULL AND LOWER(m.numeroSerie) LIKE LOWER(CONCAT('%', CAST(:termo AS string), '%'))) " +
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
     * Consulta paginada do histórico de Ordens de Serviço de um cliente específico.
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
     * Consulta paginada do histórico completo de manutenções de um equipamento específico.
     */
    @Query("SELECT os FROM OrdemServico os " +
           "JOIN FETCH os.cliente c " +
           "JOIN FETCH os.maquina m " +
           "WHERE m.id = :maquinaId")
    Page<OrdemServico> pesquisarPorMaquina(
            @Param("maquinaId") Long maquinaId,
            Pageable pageable
    );

    @Query("SELECT COUNT(os) FROM OrdemServico os " +
           "WHERE (CAST(:dataInicio AS java.time.OffsetDateTime) IS NULL OR os.dataEntrada >= :dataInicio) " +
           "AND (CAST(:dataFim AS java.time.OffsetDateTime) IS NULL OR os.dataEntrada <= :dataFim) " +
           "AND (:status IS NULL OR os.status = :status)")
    long contarPorPeriodoEStatus(
            @Param("dataInicio") OffsetDateTime dataInicio,
            @Param("dataFim") OffsetDateTime dataFim,
            @Param("status") StatusOrdemServico status
    );

    @Query("SELECT COUNT(os) FROM OrdemServico os " +
           "WHERE (CAST(:dataInicio AS java.time.OffsetDateTime) IS NULL OR os.dataEntrada >= :dataInicio) " +
           "AND (CAST(:dataFim AS java.time.OffsetDateTime) IS NULL OR os.dataEntrada <= :dataFim) " +
           "AND os.status NOT IN (com.oficinagestao.entity.StatusOrdemServico.CONCLUIDA, com.oficinagestao.entity.StatusOrdemServico.CANCELADA)")
    long contarAbertasPorPeriodo(
            @Param("dataInicio") OffsetDateTime dataInicio,
            @Param("dataFim") OffsetDateTime dataFim
    );

    @Query("SELECT COALESCE(SUM(os.valorTotal), 0) FROM OrdemServico os " +
           "WHERE (CAST(:dataInicio AS java.time.OffsetDateTime) IS NULL OR os.dataEntrada >= :dataInicio) " +
           "AND (CAST(:dataFim AS java.time.OffsetDateTime) IS NULL OR os.dataEntrada <= :dataFim) " +
           "AND os.status = com.oficinagestao.entity.StatusOrdemServico.CONCLUIDA")
    BigDecimal somarValorConcluidasPorPeriodo(
            @Param("dataInicio") OffsetDateTime dataInicio,
            @Param("dataFim") OffsetDateTime dataFim
    );

    @Query("SELECT COALESCE(SUM(os.valorTotal), 0) FROM OrdemServico os " +
           "WHERE (CAST(:dataInicio AS java.time.OffsetDateTime) IS NULL OR os.dataEntrada >= :dataInicio) " +
           "AND (CAST(:dataFim AS java.time.OffsetDateTime) IS NULL OR os.dataEntrada <= :dataFim) " +
           "AND os.status NOT IN (com.oficinagestao.entity.StatusOrdemServico.CONCLUIDA, com.oficinagestao.entity.StatusOrdemServico.CANCELADA)")
    BigDecimal somarValorAReceberPorPeriodo(
            @Param("dataInicio") OffsetDateTime dataInicio,
            @Param("dataFim") OffsetDateTime dataFim
    );
}
