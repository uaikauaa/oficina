package com.oficinagestao.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;
import java.util.Objects;

@Entity
@Table(name = "notificacoes")
public class Notificacao {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private TipoNotificacao tipo;

    @Column(nullable = false, length = 150)
    private String titulo;

    @Column(nullable = false, length = 500)
    private String mensagem;

    @Column(nullable = false)
    private boolean lida = false;

    @Column(name = "criado_em", nullable = false)
    private OffsetDateTime criadoEm;

    @Column(name = "lido_em")
    private OffsetDateTime lidoEm;

    @Column(name = "recurso_tipo", length = 50)
    private String recursoTipo;

    @Column(name = "recurso_id")
    private Long recursoId;

    @Column(length = 255)
    private String link;

    @Column(name = "chave_unica", nullable = false, unique = true, length = 100)
    private String chaveUnica;

    @Column(nullable = false)
    private boolean ativo = true;

    public Notificacao() {
    }

    public Notificacao(
            TipoNotificacao tipo,
            String titulo,
            String mensagem,
            String recursoTipo,
            Long recursoId,
            String link,
            String chaveUnica
    ) {
        this.tipo = tipo;
        this.titulo = titulo;
        this.mensagem = mensagem;
        this.recursoTipo = recursoTipo;
        this.recursoId = recursoId;
        this.link = link;
        this.chaveUnica = chaveUnica;
        this.lida = false;
        this.ativo = true;
        this.criadoEm = OffsetDateTime.now();
    }

    @PrePersist
    protected void onCreate() {
        if (this.criadoEm == null) {
            this.criadoEm = OffsetDateTime.now();
        }
    }

    public void marcarComoLida() {
        if (!this.lida) {
            this.lida = true;
            this.lidoEm = OffsetDateTime.now();
        }
    }

    // Getters e Setters

    public Long getId() {
        return id;
    }

    public TipoNotificacao getTipo() {
        return tipo;
    }

    public void setTipo(TipoNotificacao tipo) {
        this.tipo = tipo;
    }

    public String getTitulo() {
        return titulo;
    }

    public void setTitulo(String titulo) {
        this.titulo = titulo;
    }

    public String getMensagem() {
        return mensagem;
    }

    public void setMensagem(String mensagem) {
        this.mensagem = mensagem;
    }

    public boolean isLida() {
        return lida;
    }

    public void setLida(boolean lida) {
        this.lida = lida;
    }

    public OffsetDateTime getCriadoEm() {
        return criadoEm;
    }

    public void setCriadoEm(OffsetDateTime criadoEm) {
        this.criadoEm = criadoEm;
    }

    public OffsetDateTime getLidoEm() {
        return lidoEm;
    }

    public void setLidoEm(OffsetDateTime lidoEm) {
        this.lidoEm = lidoEm;
    }

    public String getRecursoTipo() {
        return recursoTipo;
    }

    public void setRecursoTipo(String recursoTipo) {
        this.recursoTipo = recursoTipo;
    }

    public Long getRecursoId() {
        return recursoId;
    }

    public void setRecursoId(Long recursoId) {
        this.recursoId = recursoId;
    }

    public String getLink() {
        return link;
    }

    public void setLink(String link) {
        this.link = link;
    }

    public String getChaveUnica() {
        return chaveUnica;
    }

    public void setChaveUnica(String chaveUnica) {
        this.chaveUnica = chaveUnica;
    }

    public boolean isAtivo() {
        return ativo;
    }

    public void setAtivo(boolean ativo) {
        this.ativo = ativo;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Notificacao that = (Notificacao) o;
        return Objects.equals(id, that.id) || Objects.equals(chaveUnica, that.chaveUnica);
    }

    @Override
    public int hashCode() {
        return Objects.hash(chaveUnica);
    }
}
