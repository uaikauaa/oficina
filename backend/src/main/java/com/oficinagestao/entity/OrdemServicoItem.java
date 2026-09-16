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
 * Entidade JPA representando um item (peÃ§a ou serviÃ§o) aplicado a uma Ordem de ServiÃ§o.
 * Armazena o preÃ§o unitÃ¡rio congelado no momento da inclusÃ£o na OS para preservar o histÃ³rico financeiro.
 */
@Entity
@Table(name = "ordem_servico_itens")
public class OrdemServicoItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "ordem_servico_id", nullable = false)
    private OrdemServico ordemServico;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "produto_id", nullable = false)
    private Produto produto;

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_item", nullable = false, length = 20)
    private TipoItemOrdemServico tipoItem = TipoItemOrdemServico.PECA;

    @Column(name = "quantidade", nullable = false, precision = 12, scale = 3)
    private BigDecimal quantidade;

    /**
     * PreÃ§o unitÃ¡rio congelado no momento do vÃ­nculo Ã  Ordem de ServiÃ§o.
     * NUNCA deve ser alterado retroativamente quando o cadastro do produto for reajustado.
     */
    @Column(name = "valor_unitario", nullable = false, precision = 12, scale = 2)
    private BigDecimal valorUnitario;

    @Column(name = "valor_desconto", nullable = false, precision = 12, scale = 2)
    private BigDecimal valorDesconto = BigDecimal.ZERO;

    @Column(name = "valor_total", nullable = false, precision = 12, scale = 2)
    private BigDecimal valorTotal;

    @Column(name = "observacoes", length = 255)
    private String observacoes;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    public OrdemServicoItem() {
    }

    public OrdemServicoItem(
            OrdemServico ordemServico,
            Produto produto,
            TipoItemOrdemServico tipoItem,
            BigDecimal quantidade,
            BigDecimal valorUnitario,
            BigDecimal valorDesconto,
            BigDecimal valorTotal,
            String observacoes
    ) {
        this.ordemServico = ordemServico;
        this.produto = produto;
        this.tipoItem = tipoItem;
        this.quantidade = quantidade;
        this.valorUnitario = valorUnitario;
        this.valorDesconto = valorDesconto != null ? valorDesconto : BigDecimal.ZERO;
        this.valorTotal = valorTotal;
        this.observacoes = observacoes;
    }

    @PrePersist
    public void prePersist() {
        if (this.createdAt == null) {
            this.createdAt = OffsetDateTime.now();
        }
        if (this.valorDesconto == null) {
            this.valorDesconto = BigDecimal.ZERO;
        }
        if (this.valorTotal == null && this.quantidade != null && this.valorUnitario != null) {
            BigDecimal subtotal = this.quantidade.multiply(this.valorUnitario).subtract(this.valorDesconto);
            this.valorTotal = (subtotal.compareTo(BigDecimal.ZERO) >= 0 ? subtotal : BigDecimal.ZERO).setScale(2, java.math.RoundingMode.HALF_UP);
        }
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public OrdemServico getOrdemServico() {
        return ordemServico;
    }

    public void setOrdemServico(OrdemServico ordemServico) {
        this.ordemServico = ordemServico;
    }

    public Produto getProduto() {
        return produto;
    }

    public void setProduto(Produto produto) {
        this.produto = produto;
    }

    public TipoItemOrdemServico getTipoItem() {
        return tipoItem;
    }

    public void setTipoItem(TipoItemOrdemServico tipoItem) {
        this.tipoItem = tipoItem;
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

    public BigDecimal getValorDesconto() {
        return valorDesconto;
    }

    public void setValorDesconto(BigDecimal valorDesconto) {
        this.valorDesconto = valorDesconto;
    }

    public BigDecimal getValorTotal() {
        return valorTotal;
    }

    public void setValorTotal(BigDecimal valorTotal) {
        this.valorTotal = valorTotal;
    }

    public String getObservacoes() {
        return observacoes;
    }

    public void setObservacoes(String observacoes) {
        this.observacoes = observacoes;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }
}
