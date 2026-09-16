package com.oficinagestao.entity;

import jakarta.persistence.*;
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

    @Column(nullable = false, unique = true, length = 255)
    private String token;

    @Column(name = "data_expiracao", nullable = false)
    private OffsetDateTime dataExpiracao;

    @Column(nullable = false)
    private Boolean revogado = false;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private OffsetDateTime criadoEm;

    public RefreshToken() {
    }

    public RefreshToken(Usuario usuario, String token, OffsetDateTime dataExpiracao) {
        this.usuario = usuario;
        this.token = token;
        this.dataExpiracao = dataExpiracao;
        this.revogado = false;
    }

    @PrePersist
    protected void onCreate() {
        if (this.criadoEm == null) {
            this.criadoEm = OffsetDateTime.now();
        }
        if (this.revogado == null) {
            this.revogado = false;
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

    public String getToken() {
        return token;
    }

    public void setToken(String token) {
        this.token = token;
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

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof RefreshToken that)) return false;
        return Objects.equals(token, that.token);
    }

    @Override
    public int hashCode() {
        return Objects.hash(token);
    }
}
