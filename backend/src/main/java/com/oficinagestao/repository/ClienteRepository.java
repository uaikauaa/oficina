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
public interface ClienteRepository extends JpaRepository<Cliente, Long> {

    @Query("SELECT c FROM Cliente c WHERE " +
           "CAST(c.id AS string) = CAST(:termo AS string) OR " +
           "LOWER(c.nomeRazaoSocial) LIKE LOWER(CONCAT('%', CAST(:termo AS string), '%')) OR " +
           "LOWER(COALESCE(c.nomeFantasia, '')) LIKE LOWER(CONCAT('%', CAST(:termo AS string), '%')) OR " +
           "c.cpfCnpj LIKE CONCAT('%', CAST(:termo AS string), '%') OR " +
           "c.telefone LIKE CONCAT('%', CAST(:termo AS string), '%') OR " +
           "c.celular LIKE CONCAT('%', CAST(:termo AS string), '%')")
    List<Cliente> buscarRapida(@Param("termo") String termo, Pageable pageable);

    // Verificações de duplicidade para criação
    boolean existsByCpfCnpj(String cpfCnpj);

    @Query("SELECT CASE WHEN COUNT(c) > 0 THEN true ELSE false END FROM Cliente c " +
           "WHERE (c.telefone = :telefone AND :telefone IS NOT NULL AND :telefone != '') " +
           "   OR (c.celular = :telefone AND :telefone IS NOT NULL AND :telefone != '')")
    boolean existsByTelefoneOuCelular(@Param("telefone") String telefone);

    boolean existsByNomeRazaoSocialIgnoreCase(String nomeRazaoSocial);

    // Verificações de duplicidade para atualização (excluindo o próprio ID)
    boolean existsByCpfCnpjAndIdNot(String cpfCnpj, Long id);

    @Query("SELECT CASE WHEN COUNT(c) > 0 THEN true ELSE false END FROM Cliente c " +
           "WHERE c.id != :id AND (" +
           "   (c.telefone = :telefone AND :telefone IS NOT NULL AND :telefone != '') " +
           "OR (c.celular = :telefone AND :telefone IS NOT NULL AND :telefone != ''))")
    boolean existsByTelefoneOuCelularAndIdNot(@Param("telefone") String telefone, @Param("id") Long id);

    boolean existsByNomeRazaoSocialIgnoreCaseAndIdNot(String nomeRazaoSocial, Long id);

    // Busca detalhada com JOIN FETCH dos endereços (evita N+1 na visualização/edição)
    @Query("SELECT c FROM Cliente c LEFT JOIN FETCH c.enderecos WHERE c.id = :id")
    Optional<Cliente> findByIdWithEnderecos(@Param("id") Long id);

    // Pesquisa paginada com múltiplos critérios
    @Query(value = "SELECT c FROM Cliente c WHERE " +
           "(:ativo IS NULL OR c.ativo = :ativo) AND " +
           "(:tipoPessoa IS NULL OR c.tipoPessoa = :tipoPessoa) AND " +
           "(CAST(:termo AS string) IS NULL OR CAST(:termo AS string) = '' OR " +
           " CAST(c.id AS string) = CAST(:termo AS string) OR " +
           " LOWER(c.nomeRazaoSocial) LIKE LOWER(CONCAT('%', CAST(:termo AS string), '%')) OR " +
           " LOWER(COALESCE(c.nomeFantasia, '')) LIKE LOWER(CONCAT('%', CAST(:termo AS string), '%')) OR " +
           " LOWER(COALESCE(c.email, '')) LIKE LOWER(CONCAT('%', CAST(:termo AS string), '%')) OR " +
           " c.cpfCnpj LIKE CONCAT('%', CAST(:termo AS string), '%') OR " +
           " c.telefone LIKE CONCAT('%', CAST(:termo AS string), '%') OR " +
           " c.celular LIKE CONCAT('%', CAST(:termo AS string), '%'))")
    Page<Cliente> pesquisar(
            @Param("termo") String termo,
            @Param("tipoPessoa") TipoPessoa tipoPessoa,
            @Param("ativo") Boolean ativo,
            Pageable pageable
    );

    @Query("SELECT new com.oficinagestao.dto.RelatorioClienteItemDTO(" +
           "c.id, c.nomeRazaoSocial, c.cpfCnpj, COALESCE(c.telefone, c.celular), " +
           "(SELECT COUNT(m) FROM Maquina m WHERE m.cliente.id = c.id AND m.ativo = true), " +
           "(SELECT COUNT(os) FROM OrdemServico os WHERE os.cliente.id = c.id), " +
           "(SELECT MAX(os.dataEntrada) FROM OrdemServico os WHERE os.cliente.id = c.id), " +
           "(SELECT COALESCE(SUM(os.valorTotal), 0) FROM OrdemServico os WHERE os.cliente.id = c.id AND os.status = com.oficinagestao.entity.StatusOrdemServico.CONCLUIDA)) " +
           "FROM Cliente c WHERE c.ativo = true " +
           "ORDER BY c.nomeRazaoSocial ASC")
    Page<com.oficinagestao.dto.RelatorioClienteItemDTO> relatorioClientes(Pageable pageable);
}
