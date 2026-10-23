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

@Repository
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<RefreshToken> findByTokenHash(String tokenHash);

    @Modifying
    @Query("UPDATE RefreshToken r SET r.revogado = true WHERE r.usuario.id = :usuarioId AND r.revogado = false")
    void revokeAllByUsuarioId(@Param("usuarioId") Long usuarioId);

    // Inclusive retention boundary: even revoked tokens remain when expiration equals limite.
    // Historical method name retained for compatibility; revocation alone never permits deletion.
    @Modifying
    @Query("DELETE FROM RefreshToken r WHERE r.dataExpiracao < :limite")
    int deleteExpiredOrRevoked(@Param("limite") java.time.OffsetDateTime limite);
}
