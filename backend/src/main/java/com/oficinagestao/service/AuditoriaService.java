package com.oficinagestao.service;

import com.oficinagestao.entity.Auditoria;
import com.oficinagestao.repository.AuditoriaRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuditoriaService {

    private final AuditoriaRepository auditoriaRepository;

    public AuditoriaService(AuditoriaRepository auditoriaRepository) {
        this.auditoriaRepository = auditoriaRepository;
    }

    @Transactional
    public void registrar(Long usuarioId, String entidade, String entidadeId, String acao, String ipOrigem) {
        Auditoria auditoria = new Auditoria(
                usuarioId,
                entidade,
                entidadeId,
                acao,
                ipOrigem != null && !ipOrigem.isBlank() ? ipOrigem : "127.0.0.1"
        );
        auditoriaRepository.save(auditoria);
    }

    @Transactional
    public void registrarComRequest(Long usuarioId, String entidade, String entidadeId, String acao, HttpServletRequest request) {
        String ip = request != null ? request.getRemoteAddr() : "127.0.0.1";
        registrar(usuarioId, entidade, entidadeId, acao, ip);
    }
}
