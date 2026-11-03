package com.oficinagestao.repository;

import com.oficinagestao.entity.Usuario;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UsuarioRepository extends JpaRepository<Usuario, Long> {
    Optional<Usuario> findByEmail(String email);
    // Every credential/session mutation locks the account before its tokens.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT u FROM Usuario u WHERE u.email = :email")
    Optional<Usuario> findByEmailForUpdate(@Param("email") String email);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT u FROM Usuario u WHERE u.id = :id")
    Optional<Usuario> findByIdForUpdate(@Param("id") Long id);
    boolean existsByEmail(String email);

    @Query("SELECT u.tokenVersion FROM Usuario u WHERE u.id = :id AND u.ativo = true")
    Optional<Integer> findActiveTokenVersionById(@Param("id") Long id);

    @Query("SELECT u.tokenVersion FROM Usuario u WHERE LOWER(u.email) = LOWER(:email) AND u.ativo = true")
    Optional<Integer> findActiveTokenVersionByEmail(@Param("email") String email);
}
