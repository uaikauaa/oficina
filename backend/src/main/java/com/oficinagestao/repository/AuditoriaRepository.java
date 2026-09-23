package com.oficinagestao.repository;

import com.oficinagestao.entity.Auditoria;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AuditoriaRepository extends JpaRepository<Auditoria, Long> {
    List<Auditoria> findByUsuarioIdOrderByDataHoraDesc(Long usuarioId);
}
