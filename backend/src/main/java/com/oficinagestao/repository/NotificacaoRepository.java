package com.oficinagestao.repository;

import com.oficinagestao.entity.Notificacao;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface NotificacaoRepository extends JpaRepository<Notificacao, Long> {

    Optional<Notificacao> findByChaveUnica(String chaveUnica);

    List<Notificacao> findByAtivoTrueOrderByCriadoEmDesc(Pageable pageable);

    long countByAtivoTrue();

    long countByLidaFalseAndAtivoTrue();

    @Modifying
    @Query("UPDATE Notificacao n SET n.lida = true, n.lidoEm = :agora WHERE n.lida = false AND n.ativo = true")
    int marcarTodasComoLidas(@Param("agora") OffsetDateTime agora);

    @Modifying
    @Query(value = """
        INSERT INTO notificacoes (tipo, titulo, mensagem, lida, criado_em, recurso_tipo, recurso_id, link, chave_unica, ativo)
        VALUES (:tipo, :titulo, :mensagem, false, :agora, :recursoTipo, :recursoId, :link, :chaveUnica, true)
        ON CONFLICT (chave_unica) DO UPDATE
        SET ativo = true,
            titulo = EXCLUDED.titulo,
            mensagem = EXCLUDED.mensagem,
            link = EXCLUDED.link,
            criado_em = CASE WHEN notificacoes.ativo = false THEN :agora ELSE notificacoes.criado_em END,
            lida = CASE WHEN notificacoes.ativo = false THEN false ELSE notificacoes.lida END,
            lido_em = CASE WHEN notificacoes.ativo = false THEN null ELSE notificacoes.lido_em END
        """, nativeQuery = true)
    int upsertNotificacao(
            @Param("tipo") String tipo,
            @Param("titulo") String titulo,
            @Param("mensagem") String mensagem,
            @Param("agora") OffsetDateTime agora,
            @Param("recursoTipo") String recursoTipo,
            @Param("recursoId") Long recursoId,
            @Param("link") String link,
            @Param("chaveUnica") String chaveUnica
    );
}
