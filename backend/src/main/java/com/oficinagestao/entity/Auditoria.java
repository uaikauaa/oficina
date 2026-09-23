package com.oficinagestao.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;

@Entity
@Table(name = "auditoria")
public class Auditoria {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "usuario_id")
    private Long usuarioId;

    @Column(nullable = false, length = 100)
    private String entidade;

    @Column(name = "entidade_id", nullable = false, length = 100)
    private String entidadeId;

    @Column(nullable = false, length = 20)
    private String acao;

    @Column(name = "ip_origem", length = 45)
    private String ipOrigem;

    @Column(name = "data_hora", nullable = false)
    private OffsetDateTime dataHora;

    public Auditoria() {
    }

    public Auditoria(Long usuarioId, String entidade, String entidadeId, String acao, String ipOrigem) {
        this.usuarioId = usuarioId;
        this.entidade = entidade;
        this.entidadeId = entidadeId;
        this.acao = acao;
        this.ipOrigem = ipOrigem;
        this.dataHora = OffsetDateTime.now();
    }

    @PrePersist
    protected void onCreate() {
        if (this.dataHora == null) {
            this.dataHora = OffsetDateTime.now();
        }
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getUsuarioId() {
        return usuarioId;
    }

    public void setUsuarioId(Long usuarioId) {
        this.usuarioId = usuarioId;
    }

    public String getEntidade() {
        return entidade;
    }

    public void setEntidade(String entidade) {
        this.entidade = entidade;
    }

    public String getEntidadeId() {
        return entidadeId;
    }

    public void setEntidadeId(String entidadeId) {
        this.entidadeId = entidadeId;
    }

    public String getAcao() {
        return acao;
    }

    public void setAcao(String acao) {
        this.acao = acao;
    }

    public String getIpOrigem() {
        return ipOrigem;
    }

    public void setIpOrigem(String ipOrigem) {
        this.ipOrigem = ipOrigem;
    }

    public OffsetDateTime getDataHora() {
        return dataHora;
    }

    public void setDataHora(OffsetDateTime dataHora) {
        this.dataHora = dataHora;
    }
}
