package com.oficinagestao.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * Entidade JPA representando cada movimentação física de peças e produtos no estoque.
 * Registra entradas, saídas (por uso em OS ou avulsas), ajustes e devoluções com auditoria de saldo.
 */
@Entity
@Table(name = "estoque_movimentacoes")
public class EstoqueMovimentacao {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "produto_id", nullable = false)
    private Produto produto;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id")
    private Usuario usuario;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ordem_servico_id")
    private OrdemServico ordemServico;

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_movimentacao", nullable = false, length = 20)
    private TipoMovimentacaoEstoque tipoMovimentacao;

    @Column(name = "quantidade", nullable = false, precision = 12, scale = 3)
    private BigDecimal quantidade;

    @Column(name = "valor_unitario", precision = 12, scale = 2)
    private BigDecimal valorUnitario;

    @Column(name = "quantidade_anterior", nullable = false, precision = 12, scale = 3)
    private BigDecimal quantidadeAnterior;

    @Column(name = "quantidade_posterior", nullable = false, precision = 12, scale = 3)
    private BigDecimal quantidadePosterior;

    @Column(name = "motivo", nullable = false, length = 255)
    private String motivo;

    @Column(name = "data_movimentacao", nullable = false, updatable = false)
    private OffsetDateTime dataMovimentacao;

    public EstoqueMovimentacao() {
    }

    public EstoqueMovimentacao(
            Produto produto,
            Usuario usuario,
            OrdemServico ordemServico,
            TipoMovimentacaoEstoque tipoMovimentacao,
            BigDecimal quantidade,
            BigDecimal valorUnitario,
            BigDecimal quantidadeAnterior,
            BigDecimal quantidadePosterior,
            String motivo
    ) {
        this.produto = produto;
        this.usuario = usuario;
        this.ordemServico = ordemServico;
        this.tipoMovimentacao = tipoMovimentacao;
        this.quantidade = quantidade;
        this.valorUnitario = valorUnitario;
        this.quantidadeAnterior = quantidadeAnterior;
        this.quantidadePosterior = quantidadePosterior;
        this.motivo = motivo;
    }

    @PrePersist
    public void prePersist() {
        if (this.dataMovimentacao == null) {
            this.dataMovimentacao = OffsetDateTime.now();
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

    public Usuario getUsuario() {
        return usuario;
    }

    public void setUsuario(Usuario usuario) {
        this.usuario = usuario;
    }

    public OrdemServico getOrdemServico() {
        return ordemServico;
    }

    public void setOrdemServico(OrdemServico ordemServico) {
        this.ordemServico = ordemServico;
    }

    public TipoMovimentacaoEstoque getTipoMovimentacao() {
        return tipoMovimentacao;
    }

    public void setTipoMovimentacao(TipoMovimentacaoEstoque tipoMovimentacao) {
        this.tipoMovimentacao = tipoMovimentacao;
    }

    public BigDecimal getQuantidade() {
        return quantidade;
    }

    public void setQuantidade(BigDecimal quantidade) {
        this.quantidade = quantidade;
    }

    public BigDecimal getValorUnitario() {
        return valorUnitario;
    }

    public void setValorUnitario(BigDecimal valorUnitario) {
        this.valorUnitario = valorUnitario;
    }

    public BigDecimal getQuantidadeAnterior() {
        return quantidadeAnterior;
    }

    public void setQuantidadeAnterior(BigDecimal quantidadeAnterior) {
        this.quantidadeAnterior = quantidadeAnterior;
    }

    public BigDecimal getQuantidadePosterior() {
        return quantidadePosterior;
    }

    public void setQuantidadePosterior(BigDecimal quantidadePosterior) {
        this.quantidadePosterior = quantidadePosterior;
    }

    public String getMotivo() {
        return motivo;
    }

    public void setMotivo(String motivo) {
        this.motivo = motivo;
    }

    public OffsetDateTime getDataMovimentacao() {
        return dataMovimentacao;
    }

    public void setDataMovimentacao(OffsetDateTime dataMovimentacao) {
        this.dataMovimentacao = dataMovimentacao;
    }
}
