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
           "CAST(c.id AS string) = :termo OR " +
           "LOWER(c.nomeRazaoSocial) LIKE LOWER(CONCAT('%', :termo, '%')) OR " +
           "LOWER(COALESCE(c.nomeFantasia, '')) LIKE LOWER(CONCAT('%', :termo, '%')) OR " +
           "c.cpfCnpj LIKE CONCAT('%', :termo, '%') OR " +
           "c.telefone LIKE CONCAT('%', :termo, '%') OR " +
           "c.celular LIKE CONCAT('%', :termo, '%')")
    List<Cliente> buscarRapida(@Param("termo") String termo, Pageable pageable);

    // Verificações de duplicidade para criação
    boolean existsByCpfCnpj(String cpfCnpj);

    @Query("SELECT CASE WHEN COUNT(c) > 0 THEN true ELSE false END FROM Cliente c " +
           "WHERE (c.telefone = :telefone AND :telefone IS NOT NULL AND :telefone != '') " +
           "   OR (c.celular = :telefone AND :telefone IS NOT NULL AND :telefone != '')")
    boolean existsByTelefoneOuCelular(@Param("telefone") String telefone);

    boolean existsByNomeRazaoSocialIgnoreCase(String nomeRazaoSocial);

    // VerificaÃ§Ãµes de duplicidade para atualizaÃ§Ã£o (excluindo o prÃ³prio ID)
    boolean existsByCpfCnpjAndIdNot(String cpfCnpj, Long id);

    @Query("SELECT CASE WHEN COUNT(c) > 0 THEN true ELSE false END FROM Cliente c " +
           "WHERE c.id != :id AND (" +
           "   (c.telefone = :telefone AND :telefone IS NOT NULL AND :telefone != '') " +
           "OR (c.celular = :telefone AND :telefone IS NOT NULL AND :telefone != ''))")
    boolean existsByTelefoneOuCelularAndIdNot(@Param("telefone") String telefone, @Param("id") Long id);

    boolean existsByNomeRazaoSocialIgnoreCaseAndIdNot(String nomeRazaoSocial, Long id);

    // Busca detalhada com JOIN FETCH dos endereÃ§os (evita N+1 na visualizaÃ§Ã£o/ediÃ§Ã£o)
    @Query("SELECT c FROM Cliente c LEFT JOIN FETCH c.enderecos WHERE c.id = :id")
    Optional<Cliente> findByIdWithEnderecos(@Param("id") Long id);

    // Pesquisa paginada com mÃºltiplos critÃ©rios
    @Query(value = "SELECT c FROM Cliente c WHERE " +
           "(:ativo IS NULL OR c.ativo = :ativo) AND " +
           "(:tipoPessoa IS NULL OR c.tipoPessoa = :tipoPessoa) AND " +
           "(:termo IS NULL OR :termo = '' OR " +
           " CAST(c.id AS string) = :termo OR " +
           " LOWER(c.nomeRazaoSocial) LIKE LOWER(CONCAT('%', :termo, '%')) OR " +
           " LOWER(COALESCE(c.nomeFantasia, '')) LIKE LOWER(CONCAT('%', :termo, '%')) OR " +
           " LOWER(COALESCE(c.email, '')) LIKE LOWER(CONCAT('%', :termo, '%')) OR " +
           " c.cpfCnpj LIKE CONCAT('%', :termo, '%') OR " +
           " c.telefone LIKE CONCAT('%', :termo, '%') OR " +
           " c.celular LIKE CONCAT('%', :termo, '%'))")
    Page<Cliente> pesquisar(
            @Param("termo") String termo,
            @Param("tipoPessoa") TipoPessoa tipoPessoa,
            @Param("ativo") Boolean ativo,
            Pageable pageable
    );
}
