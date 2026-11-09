package com.oficinagestao.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "permissoes")
public class Permissao {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 120)
    private String codigo;

    @Column(nullable = false, length = 255)
    private String descricao;

    protected Permissao() {}

    public Permissao(String codigo, String descricao) {
        this.codigo = codigo;
        this.descricao = descricao;
    }

    public Long getId() { return id; }
    public String getCodigo() { return codigo; }
    public String getDescricao() { return descricao; }
}
