package com.oficinagestao.repository;

import com.oficinagestao.entity.TwoFactorChallenge;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface TwoFactorChallengeRepository extends JpaRepository<TwoFactorChallenge, Long> {

    @Query("SELECT c.usuario.id FROM TwoFactorChallenge c WHERE c.challengeToken = :token")
    Optional<Long> findUsuarioIdByChallengeToken(@Param("token") String token);

    boolean existsByUsuarioIdAndDataCriacaoAfter(Long usuarioId, java.time.OffsetDateTime since);
    long countByUsuarioIdAndDataCriacaoAfter(Long usuarioId, java.time.OffsetDateTime since);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<TwoFactorChallenge> findByChallengeToken(String challengeToken);

    @Modifying
    @Query("UPDATE TwoFactorChallenge c SET c.revogado = true WHERE c.usuario.id = :usuarioId AND c.utilizado = false AND c.revogado = false")
    int revokeAllActiveByUsuarioId(@Param("usuarioId") Long usuarioId);
}
