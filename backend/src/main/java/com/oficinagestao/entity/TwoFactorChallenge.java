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
@Table(name = "two_factor_challenges")
public class TwoFactorChallenge {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @Column(name = "challenge_token", nullable = false, unique = true, length = 255)
    private String challengeToken;

    @Column(name = "codigo_hash", nullable = false, length = 255)
    private String codigoHash;

    @Column(name = "data_criacao", nullable = false, updatable = false)
    private OffsetDateTime dataCriacao;

    @Column(name = "data_expiracao", nullable = false)
    private OffsetDateTime dataExpiracao;

    @Column(nullable = false)
    private Integer tentativas = 0;

    @Column(nullable = false)
    private Boolean utilizado = false;

    @Column(nullable = false)
    private Boolean revogado = false;

    @Column(name = "remember_me", nullable = false)
    private Boolean rememberMe = false;

    public TwoFactorChallenge() {
    }

    public TwoFactorChallenge(Usuario usuario, String challengeToken, String codigoHash, OffsetDateTime dataExpiracao, Boolean rememberMe) {
        this.usuario = usuario;
        this.challengeToken = challengeToken;
        this.codigoHash = codigoHash;
        this.dataExpiracao = dataExpiracao;
        this.rememberMe = rememberMe != null ? rememberMe : false;
        this.tentativas = 0;
        this.utilizado = false;
        this.revogado = false;
        this.dataCriacao = OffsetDateTime.now();
    }

    @PrePersist
    protected void onCreate() {
        if (this.dataCriacao == null) {
            this.dataCriacao = OffsetDateTime.now();
        }
        if (this.tentativas == null) {
            this.tentativas = 0;
        }
        if (this.utilizado == null) {
            this.utilizado = false;
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
        return !Boolean.TRUE.equals(this.revogado)
                && !Boolean.TRUE.equals(this.utilizado)
                && !isExpired()
                && (this.tentativas != null && this.tentativas < 5);
    }

    public void revoke() {
        this.revogado = true;
    }

    public void incrementTentativas() {
        this.tentativas = (this.tentativas == null ? 0 : this.tentativas) + 1;
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

    public String getChallengeToken() {
        return challengeToken;
    }

    public void setChallengeToken(String challengeToken) {
        this.challengeToken = challengeToken;
    }

    public String getCodigoHash() {
        return codigoHash;
    }

    public void setCodigoHash(String codigoHash) {
        this.codigoHash = codigoHash;
    }

    public OffsetDateTime getDataCriacao() {
        return dataCriacao;
    }

    public void setDataCriacao(OffsetDateTime dataCriacao) {
        this.dataCriacao = dataCriacao;
    }

    public OffsetDateTime getDataExpiracao() {
        return dataExpiracao;
    }

    public void setDataExpiracao(OffsetDateTime dataExpiracao) {
        this.dataExpiracao = dataExpiracao;
    }

    public Integer getTentativas() {
        return tentativas;
    }

    public void setTentativas(Integer tentativas) {
        this.tentativas = tentativas;
    }

    public Boolean getUtilizado() {
        return utilizado;
    }

    public void setUtilizado(Boolean utilizado) {
        this.utilizado = utilizado;
    }

    public Boolean getRevogado() {
        return revogado;
    }

    public void setRevogado(Boolean revogado) {
        this.revogado = revogado;
    }

    public Boolean getRememberMe() {
        return rememberMe;
    }

    public void setRememberMe(Boolean rememberMe) {
        this.rememberMe = rememberMe;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        TwoFactorChallenge that = (TwoFactorChallenge) o;
        return Objects.equals(id, that.id) || (challengeToken != null && Objects.equals(challengeToken, that.challengeToken));
    }

    @Override
    public int hashCode() {
        return Objects.hash(challengeToken != null ? challengeToken : id);
    }
}
