-- ==============================================================================
-- Oficina Gestão — V1: Initial Database Schema
-- Motor: PostgreSQL (Neon)
-- ==============================================================================

-- 1. Tabela: usuarios
CREATE TABLE usuarios (
    id BIGSERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabela: roles
CREATE TABLE roles (
    id BIGSERIAL PRIMARY KEY,
    nome VARCHAR(50) NOT NULL UNIQUE,
    descricao VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabela: usuario_roles (relação N:N)
CREATE TABLE usuario_roles (
    usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (usuario_id, role_id)
);

-- 4. Tabela: clientes
CREATE TABLE clientes (
    id BIGSERIAL PRIMARY KEY,
    tipo_pessoa VARCHAR(10) NOT NULL CHECK (tipo_pessoa IN ('FISICA', 'JURIDICA')),
    nome_razao_social VARCHAR(200) NOT NULL,
    nome_fantasia VARCHAR(200),
    cpf_cnpj VARCHAR(20) UNIQUE,
    rg_ie VARCHAR(30),
    telefone VARCHAR(20),
    celular VARCHAR(20),
    email VARCHAR(150),
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Tabela: fornecedores
CREATE TABLE fornecedores (
    id BIGSERIAL PRIMARY KEY,
    razao_social VARCHAR(200) NOT NULL,
    nome_fantasia VARCHAR(200),
    cnpj VARCHAR(20) UNIQUE,
    inscricao_estadual VARCHAR(30),
    telefone VARCHAR(20),
    celular VARCHAR(20),
    email VARCHAR(150),
    contato_principal VARCHAR(100),
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. Tabela: enderecos (clientes e fornecedores)
CREATE TABLE enderecos (
    id BIGSERIAL PRIMARY KEY,
    cliente_id BIGINT REFERENCES clientes(id) ON DELETE CASCADE,
    fornecedor_id BIGINT REFERENCES fornecedores(id) ON DELETE CASCADE,
    cep VARCHAR(10),
    logradouro VARCHAR(200) NOT NULL,
    numero VARCHAR(20) NOT NULL,
    complemento VARCHAR(100),
    bairro VARCHAR(100) NOT NULL,
    cidade VARCHAR(100) NOT NULL,
    estado VARCHAR(2) NOT NULL,
    tipo_endereco VARCHAR(20) NOT NULL DEFAULT 'PRINCIPAL',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_endereco_origem CHECK (
        (cliente_id IS NOT NULL AND fornecedor_id IS NULL) OR
        (cliente_id IS NULL AND fornecedor_id IS NOT NULL) OR
        (cliente_id IS NULL AND fornecedor_id IS NULL)
    )
);

-- 7. Tabela: maquinas (veículos/máquinas/equipamentos dos clientes)
CREATE TABLE maquinas (
    id BIGSERIAL PRIMARY KEY,
    cliente_id BIGINT NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
    tipo VARCHAR(50) NOT NULL,
    marca VARCHAR(100) NOT NULL,
    modelo VARCHAR(100) NOT NULL,
    ano_fabricacao INT,
    numero_serie_chassi VARCHAR(100),
    placa_identificacao VARCHAR(20),
    horimetro_quilometragem NUMERIC(12, 2) DEFAULT 0.00,
    observacoes TEXT,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 8. Tabela: categorias
CREATE TABLE categorias (
    id BIGSERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL UNIQUE,
    descricao VARCHAR(255),
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 9. Tabela: produtos (peças, componentes, consumíveis e serviços)
CREATE TABLE produtos (
    id BIGSERIAL PRIMARY KEY,
    categoria_id BIGINT REFERENCES categorias(id) ON DELETE RESTRICT,
    fornecedor_id BIGINT REFERENCES fornecedores(id) ON DELETE SET NULL,
    codigo VARCHAR(50) NOT NULL UNIQUE,
    codigo_barras VARCHAR(50),
    nome VARCHAR(200) NOT NULL,
    descricao TEXT,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('PRODUTO', 'PECA', 'SERVICO', 'CONSUMIVEL')),
    unidade_medida VARCHAR(10) NOT NULL DEFAULT 'UN',
    preco_custo NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    preco_venda NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    margem_lucro NUMERIC(5, 2) DEFAULT 0.00,
    estoque_atual NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    estoque_minimo NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    estoque_maximo NUMERIC(12, 3),
    localizacao VARCHAR(50),
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 10. Tabela: produto_maquina (compatibilidade)
CREATE TABLE produto_maquina (
    id BIGSERIAL PRIMARY KEY,
    produto_id BIGINT NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
    maquina_id BIGINT NOT NULL REFERENCES maquinas(id) ON DELETE CASCADE,
    observacao_compatibilidade VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_produto_maquina UNIQUE (produto_id, maquina_id)
);

-- 11. Tabela: ordens_servico
CREATE TABLE ordens_servico (
    id BIGSERIAL PRIMARY KEY,
    numero_os VARCHAR(30) NOT NULL UNIQUE,
    cliente_id BIGINT NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
    maquina_id BIGINT REFERENCES maquinas(id) ON DELETE RESTRICT,
    tecnico_responsavel_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ORCAMENTO' CHECK (
        status IN ('ORCAMENTO', 'APROVADO', 'EM_ANDAMENTO', 'AGUARDANDO_PECA', 'CONCLUIDO', 'CANCELADO', 'FATURADO')
    ),
    data_abertura TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    previsao_conclusao TIMESTAMP WITH TIME ZONE,
    data_conclusao TIMESTAMP WITH TIME ZONE,
    defeito_reclamado TEXT NOT NULL,
    diagnostico_tecnico TEXT,
    solucao_aplicada TEXT,
    horimetro_quilometragem_atual NUMERIC(12, 2),
    valor_servicos NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    valor_pecas NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    valor_desconto NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    valor_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 12. Tabela: ordem_servico_itens
CREATE TABLE ordem_servico_itens (
    id BIGSERIAL PRIMARY KEY,
    ordem_servico_id BIGINT NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
    produto_id BIGINT NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
    tipo_item VARCHAR(20) NOT NULL CHECK (tipo_item IN ('PECA', 'SERVICO')),
    quantidade NUMERIC(12, 3) NOT NULL,
    valor_unitario NUMERIC(12, 2) NOT NULL,
    valor_desconto NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    valor_total NUMERIC(12, 2) NOT NULL,
    observacoes VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 13. Tabela: estoque_movimentacoes
CREATE TABLE estoque_movimentacoes (
    id BIGSERIAL PRIMARY KEY,
    produto_id BIGINT NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
    usuario_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
    ordem_servico_id BIGINT REFERENCES ordens_servico(id) ON DELETE SET NULL,
    tipo_movimentacao VARCHAR(20) NOT NULL CHECK (
        tipo_movimentacao IN ('ENTRADA', 'SAIDA', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO', 'DEVOLUCAO')
    ),
    quantidade NUMERIC(12, 3) NOT NULL,
    valor_unitario NUMERIC(12, 2),
    quantidade_anterior NUMERIC(12, 3) NOT NULL,
    quantidade_posterior NUMERIC(12, 3) NOT NULL,
    motivo VARCHAR(255) NOT NULL,
    data_movimentacao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 14. Tabela: auditoria
CREATE TABLE auditoria (
    id BIGSERIAL PRIMARY KEY,
    usuario_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
    entidade VARCHAR(100) NOT NULL,
    entidade_id VARCHAR(100) NOT NULL,
    acao VARCHAR(20) NOT NULL CHECK (acao IN ('INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT')),
    dados_anteriores JSONB,
    dados_novos JSONB,
    ip_origem VARCHAR(45),
    data_hora TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- ÍNDICES ESSENCIAIS
-- ==============================================================================

-- Clientes
CREATE INDEX idx_clientes_cpf_cnpj ON clientes(cpf_cnpj);
CREATE INDEX idx_clientes_telefone ON clientes(telefone);
CREATE INDEX idx_clientes_celular ON clientes(celular);
CREATE INDEX idx_clientes_nome ON clientes(nome_razao_social);

-- Fornecedores
CREATE INDEX idx_fornecedores_cnpj ON fornecedores(cnpj);
CREATE INDEX idx_fornecedores_razao ON fornecedores(razao_social);

-- Endereços
CREATE INDEX idx_enderecos_cliente_id ON enderecos(cliente_id);
CREATE INDEX idx_enderecos_fornecedor_id ON enderecos(fornecedor_id);

-- Máquinas
CREATE INDEX idx_maquinas_cliente_id ON maquinas(cliente_id);
CREATE INDEX idx_maquinas_placa ON maquinas(placa_identificacao);
CREATE INDEX idx_maquinas_chassi ON maquinas(numero_serie_chassi);

-- Produtos
CREATE INDEX idx_produtos_codigo ON produtos(codigo);
CREATE INDEX idx_produtos_nome ON produtos(nome);
CREATE INDEX idx_produtos_categoria_id ON produtos(categoria_id);
CREATE INDEX idx_produtos_fornecedor_id ON produtos(fornecedor_id);

-- Compatibilidade Produto x Máquina
CREATE INDEX idx_produto_maquina_produto ON produto_maquina(produto_id);
CREATE INDEX idx_produto_maquina_maquina ON produto_maquina(maquina_id);

-- Ordens de Serviço
CREATE INDEX idx_ordens_servico_numero_os ON ordens_servico(numero_os);
CREATE INDEX idx_ordens_servico_status ON ordens_servico(status);
CREATE INDEX idx_ordens_servico_cliente_id ON ordens_servico(cliente_id);
CREATE INDEX idx_ordens_servico_maquina_id ON ordens_servico(maquina_id);
CREATE INDEX idx_ordens_servico_tecnico_id ON ordens_servico(tecnico_responsavel_id);
CREATE INDEX idx_ordens_servico_data_abertura ON ordens_servico(data_abertura);

-- Itens da Ordem de Serviço
CREATE INDEX idx_os_itens_os_id ON ordem_servico_itens(ordem_servico_id);
CREATE INDEX idx_os_itens_produto_id ON ordem_servico_itens(produto_id);

-- Movimentações de Estoque
CREATE INDEX idx_estoque_mov_produto_id ON estoque_movimentacoes(produto_id);
CREATE INDEX idx_estoque_mov_os_id ON estoque_movimentacoes(ordem_servico_id);
CREATE INDEX idx_estoque_mov_data ON estoque_movimentacoes(data_movimentacao);

-- Auditoria
CREATE INDEX idx_auditoria_entidade ON auditoria(entidade, entidade_id);
CREATE INDEX idx_auditoria_data_hora ON auditoria(data_hora);
CREATE INDEX idx_auditoria_usuario_id ON auditoria(usuario_id);

-- ==============================================================================
-- CARGA INICIAL DE ROLES DO SISTEMA
-- ==============================================================================
INSERT INTO roles (nome, descricao) VALUES
    ('ROLE_ADMIN', 'Administrador com acesso irrestrito ao sistema'),
    ('ROLE_GERENTE', 'Gerente operacional e financeiro da oficina'),
    ('ROLE_MECANICO', 'Mecânico ou técnico executor de serviços e ordens de serviço'),
    ('ROLE_ATENDENTE', 'Atendente responsável por recepção, clientes e orçamentos')
ON CONFLICT (nome) DO NOTHING;
