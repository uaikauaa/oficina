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
import jakarta.persistence.UniqueConstraint;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * Entidade que representa a Declaração de Prestação de Serviços (DPS),
 * documento técnico préparatório para futura emissão da NFS-e Nacional / SEFIN.
 *
 * Preserva snapshot imutável dos dados cadastrais do prestador e tomador no instante da emissão/preparação.
 */
@Entity
@Table(
        name = "dps_fiscal",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_dps_fiscal_serie_numero", columnNames = {"serie", "numero"})
        }
)
public class DpsFiscal {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "ordem_servico_id", nullable = false)
    private OrdemServico ordemServico;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cliente_id", nullable = false)
    private Cliente cliente;

    @Column(name = "serie", nullable = false, length = 10)
    private String serie;

    @Column(name = "numero", nullable = false)
    private Long numero;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    private StatusDpsFiscal status = StatusDpsFiscal.PREPARADA;

    @Column(name = "data_emissao", nullable = false)
    private OffsetDateTime dataEmissao;

    @Column(name = "valor_servico", nullable = false, precision = 12, scale = 2)
    private BigDecimal valorServico;

    @Column(name = "codigo_tributacao_servico", nullable = false, length = 20)
    private String codigoTributacaoServico;

    @Column(name = "descricao_servico", nullable = false, columnDefinition = "TEXT")
    private String descricaoServico;

    @Column(name = "municipio_prestacao", length = 100)
    private String municipioPrestacao;

    @Column(name = "codigo_ibge_prestacao", length = 20)
    private String codigoIbgePrestacao;

    // --- Snapshot Prestador ---
    @Column(name = "prestador_cnpj", length = 20)
    private String prestadorCnpj;

    @Column(name = "prestador_razao_social", length = 200)
    private String prestadorRazaoSocial;

    @Column(name = "prestador_nome_fantasia", length = 200)
    private String prestadorNomeFantasia;

    @Column(name = "prestador_inscricao_municipal", length = 50)
    private String prestadorInscricaoMunicipal;

    @Column(name = "prestador_regime_tributario", length = 100)
    private String prestadorRegimeTributario;

    @Column(name = "prestador_logradouro", length = 300)
    private String prestadorLogradouro;

    @Column(name = "prestador_numero", length = 20)
    private String prestadorNumero;

    @Column(name = "prestador_bairro", length = 100)
    private String prestadorBairro;

    @Column(name = "prestador_cep", length = 20)
    private String prestadorCep;

    @Column(name = "prestador_municipio", length = 100)
    private String prestadorMunicipio;

    @Column(name = "prestador_uf", length = 2)
    private String prestadorUf;

    @Column(name = "prestador_codigo_ibge", length = 20)
    private String prestadorCodigoIbge;

    // --- Snapshot Tomador ---
    @Column(name = "tomador_tipo_pessoa", length = 10)
    private String tomadorTipoPessoa;

    @Column(name = "tomador_cpf_cnpj", length = 20)
    private String tomadorCpfCnpj;

    @Column(name = "tomador_razao_social", length = 200)
    private String tomadorRazaoSocial;

    @Column(name = "tomador_nome_fantasia", length = 200)
    private String tomadorNomeFantasia;

    @Column(name = "tomador_rg_ie", length = 30)
    private String tomadorRgIe;

    @Column(name = "tomador_email", length = 150)
    private String tomadorEmail;

    @Column(name = "tomador_telefone", length = 20)
    private String tomadorTelefone;

    @Column(name = "tomador_logradouro", length = 200)
    private String tomadorLogradouro;

    @Column(name = "tomador_numero", length = 20)
    private String tomadorNumero;

    @Column(name = "tomador_complemento", length = 100)
    private String tomadorComplemento;

    @Column(name = "tomador_bairro", length = 100)
    private String tomadorBairro;

    @Column(name = "tomador_cidade", length = 100)
    private String tomadorCidade;

    @Column(name = "tomador_uf", length = 2)
    private String tomadorUf;

    @Column(name = "tomador_cep", length = 10)
    private String tomadorCep;

    @Column(name = "tomador_codigo_ibge", length = 20)
    private String tomadorCodigoIbge;

    // --- Campos de retorno da futura NFS-e ---
    @Column(name = "numero_nfse", length = 50)
    private String numeroNfse;

    @Column(name = "chave_acesso_nfse", length = 100)
    private String chaveAcessoNfse;

    @Column(name = "xml_autorizado", columnDefinition = "TEXT")
    private String xmlAutorizado;

    @Column(name = "mensagens_retorno", columnDefinition = "TEXT")
    private String mensagensRetorno;

    // --- Reforma Tributária / IBS / CBS (preparatório) ---
    @Column(name = "aliquota_ibs", precision = 6, scale = 4)
    private BigDecimal aliquotaIbs;

    @Column(name = "valor_ibs", precision = 12, scale = 2)
    private BigDecimal valorIbs;

    @Column(name = "aliquota_cbs", precision = 6, scale = 4)
    private BigDecimal aliquotaCbs;

    @Column(name = "valor_cbs", precision = 12, scale = 2)
    private BigDecimal valorCbs;

    @Column(name = "codigo_tributacao_ibs_cbs", length = 30)
    private String codigoTributacaoIbsCbs;

    // --- Auditoria ---
    @Column(name = "usuario_preparacao_id")
    private Long usuarioPreparacaoId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    public DpsFiscal() {
    }

    @PrePersist
    protected void onCreate() {
        OffsetDateTime now = OffsetDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
        if (this.dataEmissao == null) {
            this.dataEmissao = now;
        }
        if (this.status == null) {
            this.status = StatusDpsFiscal.PREPARADA;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = OffsetDateTime.now();
    }

    // Getters e Setters
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

    public Cliente getCliente() {
        return cliente;
    }

    public void setCliente(Cliente cliente) {
        this.cliente = cliente;
    }

    public String getSerie() {
        return serie;
    }

    public void setSerie(String serie) {
        this.serie = serie;
    }

    public Long getNumero() {
        return numero;
    }

    public void setNumero(Long numero) {
        this.numero = numero;
    }

    public StatusDpsFiscal getStatus() {
        return status;
    }

    public void setStatus(StatusDpsFiscal status) {
        this.status = status;
    }

    public OffsetDateTime getDataEmissao() {
        return dataEmissao;
    }

    public void setDataEmissao(OffsetDateTime dataEmissao) {
        this.dataEmissao = dataEmissao;
    }

    public BigDecimal getValorServico() {
        return valorServico;
    }

    public void setValorServico(BigDecimal valorServico) {
        this.valorServico = valorServico;
    }

    public String getCodigoTributacaoServico() {
        return codigoTributacaoServico;
    }

    public void setCodigoTributacaoServico(String codigoTributacaoServico) {
        this.codigoTributacaoServico = codigoTributacaoServico;
    }

    public String getDescricaoServico() {
        return descricaoServico;
    }

    public void setDescricaoServico(String descricaoServico) {
        this.descricaoServico = descricaoServico;
    }

    public String getMunicipioPrestacao() {
        return municipioPrestacao;
    }

    public void setMunicipioPrestacao(String municipioPrestacao) {
        this.municipioPrestacao = municipioPrestacao;
    }

    public String getCodigoIbgePrestacao() {
        return codigoIbgePrestacao;
    }

    public void setCodigoIbgePrestacao(String codigoIbgePrestacao) {
        this.codigoIbgePrestacao = codigoIbgePrestacao;
    }

    public String getPrestadorCnpj() {
        return prestadorCnpj;
    }

    public void setPrestadorCnpj(String prestadorCnpj) {
        this.prestadorCnpj = prestadorCnpj;
    }

    public String getPrestadorRazaoSocial() {
        return prestadorRazaoSocial;
    }

    public void setPrestadorRazaoSocial(String prestadorRazaoSocial) {
        this.prestadorRazaoSocial = prestadorRazaoSocial;
    }

    public String getPrestadorNomeFantasia() {
        return prestadorNomeFantasia;
    }

    public void setPrestadorNomeFantasia(String prestadorNomeFantasia) {
        this.prestadorNomeFantasia = prestadorNomeFantasia;
    }

    public String getPrestadorInscricaoMunicipal() {
        return prestadorInscricaoMunicipal;
    }

    public void setPrestadorInscricaoMunicipal(String prestadorInscricaoMunicipal) {
        this.prestadorInscricaoMunicipal = prestadorInscricaoMunicipal;
    }

    public String getPrestadorRegimeTributario() {
        return prestadorRegimeTributario;
    }

    public void setPrestadorRegimeTributario(String prestadorRegimeTributario) {
        this.prestadorRegimeTributario = prestadorRegimeTributario;
    }

    public String getPrestadorLogradouro() {
        return prestadorLogradouro;
    }

    public void setPrestadorLogradouro(String prestadorLogradouro) {
        this.prestadorLogradouro = prestadorLogradouro;
    }

    public String getPrestadorNumero() {
        return prestadorNumero;
    }

    public void setPrestadorNumero(String prestadorNumero) {
        this.prestadorNumero = prestadorNumero;
    }

    public String getPrestadorBairro() {
        return prestadorBairro;
    }

    public void setPrestadorBairro(String prestadorBairro) {
        this.prestadorBairro = prestadorBairro;
    }

    public String getPrestadorCep() {
        return prestadorCep;
    }

    public void setPrestadorCep(String prestadorCep) {
        this.prestadorCep = prestadorCep;
    }

    public String getPrestadorMunicipio() {
        return prestadorMunicipio;
    }

    public void setPrestadorMunicipio(String prestadorMunicipio) {
        this.prestadorMunicipio = prestadorMunicipio;
    }

    public String getPrestadorUf() {
        return prestadorUf;
    }

    public void setPrestadorUf(String prestadorUf) {
        this.prestadorUf = prestadorUf;
    }

    public String getPrestadorCodigoIbge() {
        return prestadorCodigoIbge;
    }

    public void setPrestadorCodigoIbge(String prestadorCodigoIbge) {
        this.prestadorCodigoIbge = prestadorCodigoIbge;
    }

    public String getTomadorTipoPessoa() {
        return tomadorTipoPessoa;
    }

    public void setTomadorTipoPessoa(String tomadorTipoPessoa) {
        this.tomadorTipoPessoa = tomadorTipoPessoa;
    }

    public String getTomadorCpfCnpj() {
        return tomadorCpfCnpj;
    }

    public void setTomadorCpfCnpj(String tomadorCpfCnpj) {
        this.tomadorCpfCnpj = tomadorCpfCnpj;
    }

    public String getTomadorRazaoSocial() {
        return tomadorRazaoSocial;
    }

    public void setTomadorRazaoSocial(String tomadorRazaoSocial) {
        this.tomadorRazaoSocial = tomadorRazaoSocial;
    }

    public String getTomadorNomeFantasia() {
        return tomadorNomeFantasia;
    }

    public void setTomadorNomeFantasia(String tomadorNomeFantasia) {
        this.tomadorNomeFantasia = tomadorNomeFantasia;
    }

    public String getTomadorRgIe() {
        return tomadorRgIe;
    }

    public void setTomadorRgIe(String tomadorRgIe) {
        this.tomadorRgIe = tomadorRgIe;
    }

    public String getTomadorEmail() {
        return tomadorEmail;
    }

    public void setTomadorEmail(String tomadorEmail) {
        this.tomadorEmail = tomadorEmail;
    }

    public String getTomadorTelefone() {
        return tomadorTelefone;
    }

    public void setTomadorTelefone(String tomadorTelefone) {
        this.tomadorTelefone = tomadorTelefone;
    }

    public String getTomadorLogradouro() {
        return tomadorLogradouro;
    }

    public void setTomadorLogradouro(String tomadorLogradouro) {
        this.tomadorLogradouro = tomadorLogradouro;
    }

    public String getTomadorNumero() {
        return tomadorNumero;
    }

    public void setTomadorNumero(String tomadorNumero) {
        this.tomadorNumero = tomadorNumero;
    }

    public String getTomadorComplemento() {
        return tomadorComplemento;
    }

    public void setTomadorComplemento(String tomadorComplemento) {
        this.tomadorComplemento = tomadorComplemento;
    }

    public String getTomadorBairro() {
        return tomadorBairro;
    }

    public void setTomadorBairro(String tomadorBairro) {
        this.tomadorBairro = tomadorBairro;
    }

    public String getTomadorCidade() {
        return tomadorCidade;
    }

    public void setTomadorCidade(String tomadorCidade) {
        this.tomadorCidade = tomadorCidade;
    }

    public String getTomadorUf() {
        return tomadorUf;
    }

    public void setTomadorUf(String tomadorUf) {
        this.tomadorUf = tomadorUf;
    }

    public String getTomadorCep() {
        return tomadorCep;
    }

    public void setTomadorCep(String tomadorCep) {
        this.tomadorCep = tomadorCep;
    }

    public String getTomadorCodigoIbge() {
        return tomadorCodigoIbge;
    }

    public void setTomadorCodigoIbge(String tomadorCodigoIbge) {
        this.tomadorCodigoIbge = tomadorCodigoIbge;
    }

    public String getNumeroNfse() {
        return numeroNfse;
    }

    public void setNumeroNfse(String numeroNfse) {
        this.numeroNfse = numeroNfse;
    }

    public String getChaveAcessoNfse() {
        return chaveAcessoNfse;
    }

    public void setChaveAcessoNfse(String chaveAcessoNfse) {
        this.chaveAcessoNfse = chaveAcessoNfse;
    }

    public String getXmlAutorizado() {
        return xmlAutorizado;
    }

    public void setXmlAutorizado(String xmlAutorizado) {
        this.xmlAutorizado = xmlAutorizado;
    }

    public String getMensagensRetorno() {
        return mensagensRetorno;
    }

    public void setMensagensRetorno(String mensagensRetorno) {
        this.mensagensRetorno = mensagensRetorno;
    }

    public BigDecimal getAliquotaIbs() {
        return aliquotaIbs;
    }

    public void setAliquotaIbs(BigDecimal aliquotaIbs) {
        this.aliquotaIbs = aliquotaIbs;
    }

    public BigDecimal getValorIbs() {
        return valorIbs;
    }

    public void setValorIbs(BigDecimal valorIbs) {
        this.valorIbs = valorIbs;
    }

    public BigDecimal getAliquotaCbs() {
        return aliquotaCbs;
    }

    public void setAliquotaCbs(BigDecimal aliquotaCbs) {
        this.aliquotaCbs = aliquotaCbs;
    }

    public BigDecimal getValorCbs() {
        return valorCbs;
    }

    public void setValorCbs(BigDecimal valorCbs) {
        this.valorCbs = valorCbs;
    }

    public String getCodigoTributacaoIbsCbs() {
        return codigoTributacaoIbsCbs;
    }

    public void setCodigoTributacaoIbsCbs(String codigoTributacaoIbsCbs) {
        this.codigoTributacaoIbsCbs = codigoTributacaoIbsCbs;
    }

    public Long getUsuarioPreparacaoId() {
        return usuarioPreparacaoId;
    }

    public void setUsuarioPreparacaoId(Long usuarioPreparacaoId) {
        this.usuarioPreparacaoId = usuarioPreparacaoId;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }
}
