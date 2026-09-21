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
import jakarta.persistence.UniqueConstraint;

import java.time.OffsetDateTime;

/**
 * Entidade JPA representando a compatibilidade entre uma peça/componente e um equipamento técnico.
 */
@Entity
@Table(name = "produto_maquina", uniqueConstraints = {
        @UniqueConstraint(name = "uk_produto_maquina", columnNames = {"produto_id", "maquina_id"})
})
public class ProdutoMaquina {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "produto_id", nullable = false)
    private Produto produto;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "maquina_id", nullable = false)
    private Maquina maquina;

    @Column(name = "observacao_compatibilidade", length = 255)
    private String observacaoCompatibilidade;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    public ProdutoMaquina() {
    }

    public ProdutoMaquina(Produto produto, Maquina maquina, String observacaoCompatibilidade) {
        this.produto = produto;
        this.maquina = maquina;
        this.observacaoCompatibilidade = observacaoCompatibilidade;
    }

    @PrePersist
    public void prePersist() {
        if (this.createdAt == null) {
            this.createdAt = OffsetDateTime.now();
        }
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Produto getProduto() {
        return produto;
    }

    public void setProduto(Produto produto) {
        this.produto = produto;
    }

    public Maquina getMaquina() {
        return maquina;
    }

    public void setMaquina(Maquina maquina) {
        this.maquina = maquina;
    }

    public String getObservacaoCompatibilidade() {
        return observacaoCompatibilidade;
    }

    public void setObservacaoCompatibilidade(String observacaoCompatibilidade) {
        this.observacaoCompatibilidade = observacaoCompatibilidade;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }
}
