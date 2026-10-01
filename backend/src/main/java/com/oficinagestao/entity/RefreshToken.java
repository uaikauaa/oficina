package com.oficinagestao.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.Objects;

@Entity
@Table(name = "refresh_tokens")
public class RefreshToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @Column(name = "token_hash", nullable = false, unique = true, length = 64)
    private String tokenHash;

    @Column(name = "data_expiracao", nullable = false)
    private OffsetDateTime dataExpiracao;

    @Column(nullable = false)
    private Boolean revogado = false;

    @Column(name = "remember_me", nullable = false)
    private Boolean rememberMe = false;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private OffsetDateTime criadoEm;

    public RefreshToken() {
    }

    public RefreshToken(Usuario usuario, String tokenHash, OffsetDateTime dataExpiracao, Boolean rememberMe) {
        this.usuario = usuario;
        this.tokenHash = tokenHash;
        this.dataExpiracao = dataExpiracao;
        this.rememberMe = rememberMe != null ? rememberMe : false;
        this.revogado = false;
    }

    public RefreshToken(Usuario usuario, String tokenHash, OffsetDateTime dataExpiracao) {
        this(usuario, tokenHash, dataExpiracao, false);
    }

    @PrePersist
    protected void onCreate() {
        if (this.criadoEm == null) {
            this.criadoEm = OffsetDateTime.now();
        }
        if (this.revogado == null) {
            this.revogado = false;
        }
        if (this.rememberMe == null) {
            this.rememberMe = false;
        }
    }

    public boolean isExpired() {
        return this.dataExpiracao != null && this.dataExpiracao.isBefore(OffsetDateTime.now());
    }

    public boolean isValid() {
        return !Boolean.TRUE.equals(this.revogado) && !isExpired();
    }

    public void revoke() {
        this.revogado = true;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Usuario getUsuario() {
        return usuario;
    }

    public void setUsuario(Usuario usuario) {
        this.usuario = usuario;
    }

    public String getTokenHash() {
        return tokenHash;
    }

    public void setTokenHash(String tokenHash) {
        this.tokenHash = tokenHash;
    }

    public OffsetDateTime getDataExpiracao() {
        return dataExpiracao;
    }

    public void setDataExpiracao(OffsetDateTime dataExpiracao) {
        this.dataExpiracao = dataExpiracao;
    }

    public Boolean getRevogado() {
        return revogado;
    }

    public void setRevogado(Boolean revogado) {
        this.revogado = revogado;
    }

    public OffsetDateTime getCriadoEm() {
        return criadoEm;
    }

    public void setCriadoEm(OffsetDateTime criadoEm) {
        this.criadoEm = criadoEm;
    }

    public Boolean getRememberMe() {
        return rememberMe;
    }

    public void setRememberMe(Boolean rememberMe) {
        this.rememberMe = rememberMe != null ? rememberMe : false;
    }

    public boolean isRememberMe() {
        return Boolean.TRUE.equals(this.rememberMe);
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof RefreshToken that)) return false;
        return Objects.equals(tokenHash, that.tokenHash);
    }

    @Override
    public int hashCode() {
        return Objects.hash(tokenHash);
    }
}
