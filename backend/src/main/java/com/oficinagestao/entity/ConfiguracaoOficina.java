package com.oficinagestao.entity;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

/**
 * Configuração centralizada da oficina.
 *
 * Armazena os dados cadastrais e comerciais de referência da oficina.
 * Esta entidade é um SINGLETON: existe exatamente um registro na tabela.
 *
 * IMPORTANTE: Este registro NÃO emite NFS-e. Serve como:
 * 1. Fonte de dados para documentos comerciais (PDF da OS, Documento de Serviço, Recibo, etc.)
 * 2. Configuração editável pelo administrador do sistema.
 */
@Entity
@Table(name = "configuracao_oficina")
public class ConfiguracaoOficina {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Nome do sistema (software). Ex: "Oficina Gestão" */
    @Column(name = "nome_sistema", nullable = false, length = 100)
    private String nomeSistema;

    /** Nome fantasia / comercial da oficina. Ex: "Bruno Soldas" */
    @Column(name = "nome_fantasia", nullable = false, length = 200)
    private String nomeFantasia;

    /** Nome empresarial / razão social conforme cadastro fiscal. Ex: "45.076.507 BRUNO SOARES RODRIGUES" */
    @Column(name = "nome_empresarial", length = 200)
    private String nomeEmpresarial;

    /** CNPJ da oficina. Ex: "45.076.507/0001-67" */
    @Column(name = "cnpj", length = 20)
    private String cnpj;

    /** Nome do responsável/proprietário da oficina (dado administrativo). Ex: "Geisa" */
    @Column(name = "responsavel", length = 200)
    private String responsavel;

    /** Telefone de contato. Ex: "(14) 9886-7223" */
    @Column(name = "telefone", length = 30)
    private String telefone;

    /** E-mail de contato. Ex: "INDUTECSERVICE@HOTMAIL.COM" */
    @Column(name = "email", length = 200)
    private String email;

    /** Logradouro do endereço da oficina. */
    @Column(name = "logradouro", length = 300)
    private String logradouro;

    /** Número do endereço. */
    @Column(name = "numero", length = 20)
    private String numero;

    /** Bairro da oficina. */
    @Column(name = "bairro", length = 100)
    private String bairro;

    /** CEP. Ex: "19.914-080" */
    @Column(name = "cep", length = 20)
    private String cep;

    /** Município. Ex: "Ourinhos" */
    @Column(name = "municipio", length = 100)
    private String municipio;

    /** UF. Ex: "SP" */
    @Column(name = "uf", length = 2)
    private String uf;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = OffsetDateTime.now();
        updatedAt = OffsetDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }

    public ConfiguracaoOficina() {
    }

    public ConfiguracaoOficina(
            String nomeSistema,
            String nomeFantasia,
            String nomeEmpresarial,
            String cnpj,
            String responsavel,
            String telefone,
            String email,
            String logradouro,
            String numero,
            String bairro,
            String cep,
            String municipio,
            String uf
    ) {
        this.nomeSistema = nomeSistema;
        this.nomeFantasia = nomeFantasia;
        this.nomeEmpresarial = nomeEmpresarial;
        this.cnpj = cnpj;
        this.responsavel = responsavel;
        this.telefone = telefone;
        this.email = email;
        this.logradouro = logradouro;
        this.numero = numero;
        this.bairro = bairro;
        this.cep = cep;
        this.municipio = municipio;
        this.uf = uf;
    }

    // --- Getters e Setters ---

    public Long getId() { return id; }

    public String getNomeSistema() { return nomeSistema; }
    public void setNomeSistema(String nomeSistema) { this.nomeSistema = nomeSistema; }

    public String getNomeFantasia() { return nomeFantasia; }
    public void setNomeFantasia(String nomeFantasia) { this.nomeFantasia = nomeFantasia; }

    public String getNomeEmpresarial() { return nomeEmpresarial; }
    public void setNomeEmpresarial(String nomeEmpresarial) { this.nomeEmpresarial = nomeEmpresarial; }

    public String getCnpj() { return cnpj; }
    public void setCnpj(String cnpj) { this.cnpj = cnpj; }

    public String getResponsavel() { return responsavel; }
    public void setResponsavel(String responsavel) { this.responsavel = responsavel; }

    public String getTelefone() { return telefone; }
    public void setTelefone(String telefone) { this.telefone = telefone; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getLogradouro() { return logradouro; }
    public void setLogradouro(String logradouro) { this.logradouro = logradouro; }

    public String getNumero() { return numero; }
    public void setNumero(String numero) { this.numero = numero; }

    public String getBairro() { return bairro; }
    public void setBairro(String bairro) { this.bairro = bairro; }

    public String getCep() { return cep; }
    public void setCep(String cep) { this.cep = cep; }

    public String getMunicipio() { return municipio; }
    public void setMunicipio(String municipio) { this.municipio = municipio; }

    public String getUf() { return uf; }
    public void setUf(String uf) { this.uf = uf; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
}
