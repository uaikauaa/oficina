package com.oficinagestao.repository;

import com.oficinagestao.entity.RefreshToken;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.time.OffsetDateTime;
import java.util.UUID;

@Repository
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {

    @Query("SELECT r.usuario.id FROM RefreshToken r WHERE r.tokenHash = :hash")
    Optional<Long> findUsuarioIdByTokenHash(@Param("hash") String hash);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<RefreshToken> findByTokenHash(String tokenHash);

    @Query("SELECT CASE WHEN COUNT(r) > 0 THEN true ELSE false END FROM RefreshToken r "
            + "WHERE r.usuario.id = :usuarioId AND r.sessionId = :sessionId "
            + "AND r.revogado = false AND r.dataExpiracao > :now")
    Optional<Boolean> existsActiveSession(@Param("usuarioId") Long usuarioId,
                                          @Param("sessionId") UUID sessionId,
                                          @Param("now") OffsetDateTime now);

    @Query(value = "SELECT CASE WHEN COUNT(*) > 0 THEN true ELSE false END "
            + "FROM eventos_administrativos WHERE acao = 'SESSAO_REVOGADA' "
            + "AND detalhes LIKE CONCAT('%', CAST(:sessionId AS text), '%')",
            nativeQuery = true)
    Optional<Boolean> wasExplicitlyRevoked(@Param("sessionId") UUID sessionId);

    @Modifying
    @Query("UPDATE RefreshToken r SET r.revogado = true WHERE r.usuario.id = :usuarioId AND r.revogado = false")
    void revokeAllByUsuarioId(@Param("usuarioId") Long usuarioId);

    // Inclusive retention boundary: even revoked tokens remain when expiration equals limite.
    // Historical method name retained for compatibility; revocation alone never permits deletion.
    @Modifying
    @Query("DELETE FROM RefreshToken r WHERE r.dataExpiracao < :limite")
    int deleteExpiredOrRevoked(@Param("limite") java.time.OffsetDateTime limite);
}
