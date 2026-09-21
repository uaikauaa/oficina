package com.oficinagestao.service;

import com.oficinagestao.entity.Auditoria;
import com.oficinagestao.repository.AuditoriaRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuditoriaService {

    private final AuditoriaRepository auditoriaRepository;
    private final com.oficinagestao.security.IpAddressResolver ipAddressResolver;

    @org.springframework.beans.factory.annotation.Autowired
    public AuditoriaService(AuditoriaRepository auditoriaRepository, com.oficinagestao.security.IpAddressResolver ipAddressResolver) {
        this.auditoriaRepository = auditoriaRepository;
        this.ipAddressResolver = ipAddressResolver != null ? ipAddressResolver : new com.oficinagestao.security.IpAddressResolver();
    }

    public AuditoriaService(AuditoriaRepository auditoriaRepository) {
        this(auditoriaRepository, new com.oficinagestao.security.IpAddressResolver());
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
        String ip = ipAddressResolver.extrairIp(request);
        registrar(usuarioId, entidade, entidadeId, acao, ip);
    }
}
