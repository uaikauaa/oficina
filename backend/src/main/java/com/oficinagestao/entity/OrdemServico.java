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
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * Entidade JPA representando uma Ordem de ServiÃ§o (OS) na oficina tÃ©cnica.
 * <p>
 * Regra Fundamental:
 * Toda OS pertence obrigatoriamente a um Cliente e a um Equipamento daquele cliente.
 * O equipamento deve continuar existindo independentemente da OS e poderÃ¡
 * acumular mÃºltiplas OS ao longo do tempo (histÃ³rico de manutenÃ§Ã£o).
 */
@Entity
@Table(name = "ordens_servico")
public class OrdemServico {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "numero_os", nullable = false, unique = true, length = 30)
    private String numeroOs;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cliente_id", nullable = false)
    private Cliente cliente;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "maquina_id", nullable = false)
    private Maquina maquina;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tecnico_responsavel_id")
    private Usuario tecnicoResponsavel;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    private StatusOrdemServico status = StatusOrdemServico.ABERTA;

    /** Data de entrada do equipamento na oficina. */
    @Column(name = "data_abertura", nullable = false)
    private OffsetDateTime dataEntrada;

    /** PrevisÃ£o estimada de conclusÃ£o dos serviÃ§os. */
    @Column(name = "previsao_conclusao")
    private OffsetDateTime previsaoConclusao;

    /** Data efetiva de conclusÃ£o/retirada do equipamento. */
    @Column(name = "data_conclusao")
    private OffsetDateTime dataConclusao;

    /** DescriÃ§Ã£o do problema relatado pelo cliente na recepÃ§Ã£o. */
    @Column(name = "defeito_reclamado", nullable = false, columnDefinition = "TEXT")
    private String problemaRelatado;

    /** DiagnÃ³stico tÃ©cnico elaborado pelo mecÃ¢nico/tÃ©cnico na bancada. */
    @Column(name = "diagnostico_tecnico", columnDefinition = "TEXT")
    private String diagnostico;

    /** SoluÃ§Ã£o tÃ©cnica aplicada (reparos, rebobinamento, trocas, etc.). */
    @Column(name = "solucao_aplicada", columnDefinition = "TEXT")
    private String solucaoAplicada;

    /**
     * Registro de testes tÃ©cnicos realizados na bancada
     * (ex: teste de carga, arco sob carga, ciclo de trabalho, aferiÃ§Ã£o de tensÃ£o/AVR).
     * MandatÃ³rio antes de marcar a OS como PRONTA.
     */
    @Column(name = "testes_realizados", columnDefinition = "TEXT")
    private String testesRealizados;

    /** ObservaÃ§Ãµes gerais de atendimento ou recepÃ§Ã£o. */
    @Column(name = "observacoes", columnDefinition = "TEXT")
    private String observacoes;

    /** HorÃ­metro do equipamento no momento da entrada na oficina. */
    @Column(name = "horimetro_atual", precision = 12, scale = 2)
    private BigDecimal horimetroAtual;

    /** Valor dos serviÃ§os / mÃ£o de obra tÃ©cnica. */
    @Column(name = "valor_servicos", nullable = false, precision = 12, scale = 2)
    private BigDecimal valorMaoObra = BigDecimal.ZERO;

    /** Valor das peÃ§as e insumos aplicados. */
    @Column(name = "valor_pecas", nullable = false, precision = 12, scale = 2)
    private BigDecimal valorPecas = BigDecimal.ZERO;

    /** Desconto concedido na OS. */
    @Column(name = "valor_desconto", nullable = false, precision = 12, scale = 2)
    private BigDecimal valorDesconto = BigDecimal.ZERO;

    /** Valor total calculado da Ordem de ServiÃ§o. */
    @Column(name = "valor_total", nullable = false, precision = 12, scale = 2)
    private BigDecimal valorTotal = BigDecimal.ZERO;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    public OrdemServico() {
    }

    @PrePersist
    public void prePersist() {
        OffsetDateTime now = OffsetDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
        if (this.dataEntrada == null) {
            this.dataEntrada = now;
        }
        if (this.status == null) {
            this.status = StatusOrdemServico.ABERTA;
        }
        if (this.valorMaoObra == null) {
            this.valorMaoObra = BigDecimal.ZERO;
        }
        if (this.valorPecas == null) {
            this.valorPecas = BigDecimal.ZERO;
        }
        if (this.valorDesconto == null) {
            this.valorDesconto = BigDecimal.ZERO;
        }
        recalcularTotal();
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = OffsetDateTime.now();
        recalcularTotal();
    }

    /**
     * Recalcula o valor total da OS garantindo que nunca fique negativo.
     * Total = max(0, valorMaoObra + valorPecas - valorDesconto)
     */
    public void recalcularTotal() {
        BigDecimal maoObra = this.valorMaoObra != null ? this.valorMaoObra : BigDecimal.ZERO;
        BigDecimal pecas = this.valorPecas != null ? this.valorPecas : BigDecimal.ZERO;
        BigDecimal desconto = this.valorDesconto != null ? this.valorDesconto : BigDecimal.ZERO;

        BigDecimal subtotal = maoObra.add(pecas);
        BigDecimal totalCalculado = subtotal.subtract(desconto);
        this.valorTotal = totalCalculado.max(BigDecimal.ZERO);
    }

    // Getters and Setters

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getNumeroOs() {
        return numeroOs;
    }

    public void setNumeroOs(String numeroOs) {
        this.numeroOs = numeroOs;
    }

    public Cliente getCliente() {
        return cliente;
    }

    public void setCliente(Cliente cliente) {
        this.cliente = cliente;
    }

    public Maquina getMaquina() {
        return maquina;
    }

    public void setMaquina(Maquina maquina) {
        this.maquina = maquina;
    }

    public Usuario getTecnicoResponsavel() {
        return tecnicoResponsavel;
    }

    public void setTecnicoResponsavel(Usuario tecnicoResponsavel) {
        this.tecnicoResponsavel = tecnicoResponsavel;
    }

    public StatusOrdemServico getStatus() {
        return status;
    }

    public void setStatus(StatusOrdemServico status) {
        this.status = status;
    }

    public OffsetDateTime getDataEntrada() {
        return dataEntrada;
    }

    public void setDataEntrada(OffsetDateTime dataEntrada) {
        this.dataEntrada = dataEntrada;
    }

    public OffsetDateTime getPrevisaoConclusao() {
        return previsaoConclusao;
    }

    public void setPrevisaoConclusao(OffsetDateTime previsaoConclusao) {
        this.previsaoConclusao = previsaoConclusao;
    }

    public OffsetDateTime getDataConclusao() {
        return dataConclusao;
    }

    public void setDataConclusao(OffsetDateTime dataConclusao) {
        this.dataConclusao = dataConclusao;
    }

    public String getProblemaRelatado() {
        return problemaRelatado;
    }

    public void setProblemaRelatado(String problemaRelatado) {
        this.problemaRelatado = problemaRelatado;
    }

    public String getDiagnostico() {
        return diagnostico;
    }

    public void setDiagnostico(String diagnostico) {
        this.diagnostico = diagnostico;
    }

    public String getSolucaoAplicada() {
        return solucaoAplicada;
    }

    public void setSolucaoAplicada(String solucaoAplicada) {
        this.solucaoAplicada = solucaoAplicada;
    }

    public String getTestesRealizados() {
        return testesRealizados;
    }

    public void setTestesRealizados(String testesRealizados) {
        this.testesRealizados = testesRealizados;
    }

    public String getObservacoes() {
        return observacoes;
    }

    public void setObservacoes(String observacoes) {
        this.observacoes = observacoes;
    }

    public BigDecimal getHorimetroAtual() {
        return horimetroAtual;
    }

    public void setHorimetroAtual(BigDecimal horimetroAtual) {
        this.horimetroAtual = horimetroAtual;
    }

    public BigDecimal getValorMaoObra() {
        return valorMaoObra;
    }

    public void setValorMaoObra(BigDecimal valorMaoObra) {
        this.valorMaoObra = valorMaoObra;
    }

    public BigDecimal getValorPecas() {
        return valorPecas;
    }

    public void setValorPecas(BigDecimal valorPecas) {
        this.valorPecas = valorPecas;
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

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(OffsetDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
