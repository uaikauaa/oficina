-- B24: schema equivalent to V24, for NEW databases only.
-- Existing Flyway histories ignore this baseline; V1-V24 remain unchanged.
-- No business identity, account, password, address or contact is seeded.
-- Generated and checked by scripts/check-flyway-baseline.mjs.

-- Schema/reference data from V1; V11 has a neutral singleton.
CREATE TABLE usuarios (
    id BIGSERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE roles (
    id BIGSERIAL PRIMARY KEY,
    nome VARCHAR(50) NOT NULL UNIQUE,
    descricao VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE usuario_roles (
    usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (usuario_id, role_id)
);

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

CREATE TABLE categorias (
    id BIGSERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL UNIQUE,
    descricao VARCHAR(255),
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE produto_maquina (
    id BIGSERIAL PRIMARY KEY,
    produto_id BIGINT NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
    maquina_id BIGINT NOT NULL REFERENCES maquinas(id) ON DELETE CASCADE,
    observacao_compatibilidade VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_produto_maquina UNIQUE (produto_id, maquina_id)
);

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

CREATE INDEX idx_clientes_cpf_cnpj ON clientes(cpf_cnpj);
CREATE INDEX idx_clientes_telefone ON clientes(telefone);
CREATE INDEX idx_clientes_celular ON clientes(celular);
CREATE INDEX idx_clientes_nome ON clientes(nome_razao_social);

CREATE INDEX idx_fornecedores_cnpj ON fornecedores(cnpj);
CREATE INDEX idx_fornecedores_razao ON fornecedores(razao_social);

CREATE INDEX idx_enderecos_cliente_id ON enderecos(cliente_id);
CREATE INDEX idx_enderecos_fornecedor_id ON enderecos(fornecedor_id);

CREATE INDEX idx_maquinas_cliente_id ON maquinas(cliente_id);
CREATE INDEX idx_maquinas_placa ON maquinas(placa_identificacao);
CREATE INDEX idx_maquinas_chassi ON maquinas(numero_serie_chassi);

CREATE INDEX idx_produtos_codigo ON produtos(codigo);
CREATE INDEX idx_produtos_nome ON produtos(nome);
CREATE INDEX idx_produtos_categoria_id ON produtos(categoria_id);
CREATE INDEX idx_produtos_fornecedor_id ON produtos(fornecedor_id);

CREATE INDEX idx_produto_maquina_produto ON produto_maquina(produto_id);
CREATE INDEX idx_produto_maquina_maquina ON produto_maquina(maquina_id);

CREATE INDEX idx_ordens_servico_numero_os ON ordens_servico(numero_os);
CREATE INDEX idx_ordens_servico_status ON ordens_servico(status);
CREATE INDEX idx_ordens_servico_cliente_id ON ordens_servico(cliente_id);
CREATE INDEX idx_ordens_servico_maquina_id ON ordens_servico(maquina_id);
CREATE INDEX idx_ordens_servico_tecnico_id ON ordens_servico(tecnico_responsavel_id);
CREATE INDEX idx_ordens_servico_data_abertura ON ordens_servico(data_abertura);

CREATE INDEX idx_os_itens_os_id ON ordem_servico_itens(ordem_servico_id);
CREATE INDEX idx_os_itens_produto_id ON ordem_servico_itens(produto_id);

CREATE INDEX idx_estoque_mov_produto_id ON estoque_movimentacoes(produto_id);
CREATE INDEX idx_estoque_mov_os_id ON estoque_movimentacoes(ordem_servico_id);
CREATE INDEX idx_estoque_mov_data ON estoque_movimentacoes(data_movimentacao);

CREATE INDEX idx_auditoria_entidade ON auditoria(entidade, entidade_id);
CREATE INDEX idx_auditoria_data_hora ON auditoria(data_hora);
CREATE INDEX idx_auditoria_usuario_id ON auditoria(usuario_id);

INSERT INTO roles (nome, descricao) VALUES
    ('ROLE_ADMIN', 'Administrador com acesso irrestrito ao sistema'),
    ('ROLE_GERENTE', 'Gerente operacional e financeiro da oficina'),
    ('ROLE_MECANICO', 'Mecânico ou técnico executor de serviços e ordens de serviço'),
    ('ROLE_ATENDENTE', 'Atendente responsável por recepção, clientes e orçamentos')
ON CONFLICT (nome) DO NOTHING;

-- Schema/reference data from V2; V11 has a neutral singleton.
DELETE FROM usuario_roles
WHERE role_id IN (
    SELECT id FROM roles WHERE nome IN ('ROLE_GERENTE', 'ROLE_MECANICO', 'ROLE_ATENDENTE')
);

DELETE FROM roles
WHERE nome IN ('ROLE_GERENTE', 'ROLE_MECANICO', 'ROLE_ATENDENTE');

-- Schema/reference data from V3; V11 has a neutral singleton.
CREATE TABLE refresh_tokens (
    id BIGSERIAL PRIMARY KEY,
    usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    data_expiracao TIMESTAMP WITH TIME ZONE NOT NULL,
    revogado BOOLEAN NOT NULL DEFAULT FALSE,
    criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX idx_refresh_tokens_usuario ON refresh_tokens(usuario_id);

-- Schema/reference data from V4; V11 has a neutral singleton.
DROP INDEX IF EXISTS idx_maquinas_placa;
DROP INDEX IF EXISTS idx_maquinas_chassi;

ALTER TABLE maquinas RENAME COLUMN tipo TO tipo_equipamento;

ALTER TABLE maquinas RENAME COLUMN numero_serie_chassi TO numero_serie;

ALTER TABLE maquinas DROP COLUMN IF EXISTS placa_identificacao;

ALTER TABLE maquinas RENAME COLUMN horimetro_quilometragem TO horimetro;

ALTER TABLE maquinas ADD COLUMN IF NOT EXISTS potencia VARCHAR(50);
ALTER TABLE maquinas ADD COLUMN IF NOT EXISTS tensao VARCHAR(50);
ALTER TABLE maquinas ADD COLUMN IF NOT EXISTS especificacoes_tecnicas JSONB;

ALTER TABLE ordens_servico RENAME COLUMN horimetro_quilometragem_atual TO horimetro_atual;

CREATE INDEX idx_maquinas_tipo_equipamento ON maquinas(tipo_equipamento);
CREATE INDEX idx_maquinas_numero_serie ON maquinas(numero_serie);
CREATE INDEX idx_maquinas_cliente_numero_serie ON maquinas(cliente_id, numero_serie);

-- Schema/reference data from V5; V11 has a neutral singleton.
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS testes_realizados TEXT;

ALTER TABLE ordens_servico DROP CONSTRAINT IF EXISTS ordens_servico_status_check;

ALTER TABLE ordens_servico ADD CONSTRAINT ordens_servico_status_check CHECK (
    status IN (
        'ABERTA',
        'EM_DIAGNOSTICO',
        'AGUARDANDO_APROVACAO',
        'EM_MANUTENCAO',
        'AGUARDANDO_PECA',
        'PRONTA',
        'CONCLUIDA',
        'CANCELADA'
    )
);

ALTER TABLE ordens_servico ALTER COLUMN status SET DEFAULT 'ABERTA';

-- Schema/reference data from V6; V11 has a neutral singleton.
ALTER TABLE maquinas
    ADD CONSTRAINT chk_maquinas_tipo_equipamento
    CHECK (tipo_equipamento IN ('MAQUINA_SOLDA', 'GERADOR_ENERGIA', 'OUTRO_EQUIPAMENTO'));

CREATE INDEX IF NOT EXISTS idx_maquinas_cliente_id ON maquinas(cliente_id);

CREATE INDEX IF NOT EXISTS idx_maquinas_cliente_ativo ON maquinas(cliente_id, ativo);

-- Schema/reference data from V7; V11 has a neutral singleton.
ALTER TABLE produtos
    ADD CONSTRAINT chk_produtos_estoque_nao_negativo
    CHECK (estoque_atual >= 0);

ALTER TABLE produtos
    ADD CONSTRAINT chk_produtos_estoque_minimo_nao_negativo
    CHECK (estoque_minimo >= 0);

CREATE INDEX IF NOT EXISTS idx_produtos_estoque_baixo ON produtos(estoque_atual, estoque_minimo);
CREATE INDEX IF NOT EXISTS idx_produtos_ativo ON produtos(ativo);
CREATE INDEX IF NOT EXISTS idx_produtos_tipo ON produtos(tipo);

CREATE INDEX IF NOT EXISTS idx_estoque_mov_tipo ON estoque_movimentacoes(tipo_movimentacao);

-- Schema/reference data from V8; V11 has a neutral singleton.
CREATE SEQUENCE IF NOT EXISTS ordens_servico_seq START WITH 1 INCREMENT BY 1;

DO $$
DECLARE
    max_seq BIGINT;
BEGIN
    SELECT COALESCE(COUNT(*), 0) INTO max_seq FROM ordens_servico;
    IF max_seq > 0 THEN
        PERFORM setval('ordens_servico_seq', max_seq);
    END IF;
END $$;

-- Schema/reference data from V9; V11 has a neutral singleton.
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS marca VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_produtos_marca ON produtos(marca);

INSERT INTO categorias (nome, descricao, ativo) VALUES
    ('Eletrônica', 'Componentes eletrônicos, placas inversoras, IGBTs, diodos e controladores', true),
    ('Máquina de Solda', 'Componentes específicos para máquinas de solda MIG, TIG e MMA', true),
    ('Gerador', 'Componentes e peças para geradores de energia a diesel/gasolina e reguladores AVR', true),
    ('Elétrica', 'Cabos, contatores, relés, conectores e fiações técnicas', true),
    ('Mecânica', 'Rolamentos, eixos, carcaças, ventoinhas e componentes estruturais', true),
    ('Consumíveis', 'Consumíveis de soldagem, bicos de contato, bocais e filtros técnicos', true)
ON CONFLICT (nome) DO NOTHING;

-- Schema/reference data from V10; V11 has a neutral singleton.
ALTER TABLE maquinas
    ADD CONSTRAINT uq_maquinas_id_cliente UNIQUE (id, cliente_id);

ALTER TABLE ordens_servico
    ADD CONSTRAINT fk_ordens_servico_maquina_cliente
    FOREIGN KEY (maquina_id, cliente_id)
    REFERENCES maquinas(id, cliente_id)
    ON DELETE RESTRICT;

-- Schema/reference data from V11; V11 has a neutral singleton.
CREATE TABLE IF NOT EXISTS configuracao_oficina (
    id                       BIGSERIAL PRIMARY KEY,

    nome_sistema             VARCHAR(100) NOT NULL DEFAULT 'Oficina Gestão',
    nome_fantasia            VARCHAR(200) NOT NULL,
    nome_empresarial         VARCHAR(200),

    cnpj                     VARCHAR(20),
    inscricao_municipal      VARCHAR(50),
    regime_tributario        VARCHAR(100),
    codigo_tributacao_servico VARCHAR(20),

    responsavel              VARCHAR(200),

    telefone                 VARCHAR(30),
    email                    VARCHAR(200),

    logradouro               VARCHAR(300),
    numero                   VARCHAR(20),
    bairro                   VARCHAR(100),
    cep                      VARCHAR(20),
    municipio                VARCHAR(100),
    uf                       VARCHAR(2),
    codigo_ibge              VARCHAR(20),

    created_at               TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_configuracao_oficina_singleton ON configuracao_oficina ((id IS NOT NULL)) WHERE id IS NOT NULL;

INSERT INTO configuracao_oficina (nome_sistema, nome_fantasia) VALUES ('Oficina Gestão', 'Oficina não configurada');

-- Schema/reference data from V13; V11 has a neutral singleton.
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS codigo_ibge VARCHAR(20);

CREATE TABLE IF NOT EXISTS dps_numeracao (
    id BIGSERIAL PRIMARY KEY,
    serie VARCHAR(10) NOT NULL UNIQUE,
    ultimo_numero BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO dps_numeracao (serie, ultimo_numero)
VALUES ('1', 0)
ON CONFLICT (serie) DO NOTHING;

CREATE TABLE IF NOT EXISTS dps_fiscal (
    id BIGSERIAL PRIMARY KEY,
    ordem_servico_id BIGINT NOT NULL REFERENCES ordens_servico(id),
    cliente_id BIGINT NOT NULL REFERENCES clientes(id),
    serie VARCHAR(10) NOT NULL,
    numero BIGINT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PREPARADA',
    data_emissao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valor_servico NUMERIC(12, 2) NOT NULL,
    codigo_tributacao_servico VARCHAR(20) NOT NULL,
    descricao_servico TEXT NOT NULL,
    municipio_prestacao VARCHAR(100),
    codigo_ibge_prestacao VARCHAR(20),

    prestador_cnpj VARCHAR(20),
    prestador_razao_social VARCHAR(200),
    prestador_nome_fantasia VARCHAR(200),
    prestador_inscricao_municipal VARCHAR(50),
    prestador_regime_tributario VARCHAR(100),
    prestador_logradouro VARCHAR(300),
    prestador_numero VARCHAR(20),
    prestador_bairro VARCHAR(100),
    prestador_cep VARCHAR(20),
    prestador_municipio VARCHAR(100),
    prestador_uf VARCHAR(2),
    prestador_codigo_ibge VARCHAR(20),

    tomador_tipo_pessoa VARCHAR(10),
    tomador_cpf_cnpj VARCHAR(20),
    tomador_razao_social VARCHAR(200),
    tomador_nome_fantasia VARCHAR(200),
    tomador_rg_ie VARCHAR(30),
    tomador_email VARCHAR(150),
    tomador_telefone VARCHAR(20),
    tomador_logradouro VARCHAR(200),
    tomador_numero VARCHAR(20),
    tomador_complemento VARCHAR(100),
    tomador_bairro VARCHAR(100),
    tomador_cidade VARCHAR(100),
    tomador_uf VARCHAR(2),
    tomador_cep VARCHAR(10),
    tomador_codigo_ibge VARCHAR(20),

    numero_nfse VARCHAR(50),
    chave_acesso_nfse VARCHAR(100),
    xml_autorizado TEXT,
    mensagens_retorno TEXT,

    aliquota_ibs NUMERIC(6, 4),
    valor_ibs NUMERIC(12, 2),
    aliquota_cbs NUMERIC(6, 4),
    valor_cbs NUMERIC(12, 2),
    codigo_tributacao_ibs_cbs VARCHAR(30),

    usuario_preparacao_id BIGINT REFERENCES usuarios(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uk_dps_fiscal_serie_numero UNIQUE (serie, numero)
);

CREATE INDEX IF NOT EXISTS idx_dps_fiscal_os_id ON dps_fiscal(ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_dps_fiscal_cliente_id ON dps_fiscal(cliente_id);
CREATE INDEX IF NOT EXISTS idx_dps_fiscal_status ON dps_fiscal(status);

-- Schema/reference data from V14; V11 has a neutral singleton.
DROP TABLE IF EXISTS dps_fiscal;

DROP TABLE IF EXISTS dps_numeracao;

ALTER TABLE configuracao_oficina DROP COLUMN IF EXISTS inscricao_municipal;
ALTER TABLE configuracao_oficina DROP COLUMN IF EXISTS regime_tributario;
ALTER TABLE configuracao_oficina DROP COLUMN IF EXISTS codigo_tributacao_servico;
ALTER TABLE configuracao_oficina DROP COLUMN IF EXISTS codigo_ibge;

-- Schema/reference data from V15; V11 has a neutral singleton.
ALTER TABLE clientes
DROP COLUMN IF EXISTS codigo_ibge;

-- Schema/reference data from V16; V11 has a neutral singleton.
CREATE SEQUENCE IF NOT EXISTS produtos_codigo_seq START WITH 1 INCREMENT BY 1;

DO $$
DECLARE
    r RECORD;
    seq_val BIGINT := 1;
BEGIN

    UPDATE produtos SET codigo = '__MIG_TEMP_' || id;

    FOR r IN SELECT id FROM produtos ORDER BY id ASC LOOP
        UPDATE produtos
        SET codigo = 'P-' || LPAD(seq_val::text, GREATEST(3, LENGTH(seq_val::text)), '0')
        WHERE id = r.id;

        seq_val := seq_val + 1;
    END LOOP;

    IF seq_val > 1 THEN
        PERFORM setval('produtos_codigo_seq', seq_val - 1, true);
    ELSE
        PERFORM setval('produtos_codigo_seq', 1, false);
    END IF;
END $$;

ALTER TABLE produtos ADD COLUMN IF NOT EXISTS link_compra VARCHAR(1000);

ALTER TABLE produtos DROP COLUMN IF EXISTS codigo_barras;

-- Schema/reference data from V17; V11 has a neutral singleton.
ALTER TABLE refresh_tokens ADD COLUMN remember_me BOOLEAN NOT NULL DEFAULT FALSE;

-- Schema/reference data from V18; V11 has a neutral singleton.
CREATE TABLE two_factor_challenges (
    id BIGSERIAL PRIMARY KEY,
    usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    challenge_token VARCHAR(255) NOT NULL UNIQUE,
    codigo_hash VARCHAR(255) NOT NULL,
    data_criacao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    data_expiracao TIMESTAMP WITH TIME ZONE NOT NULL,
    tentativas INT NOT NULL DEFAULT 0,
    utilizado BOOLEAN NOT NULL DEFAULT FALSE,
    revogado BOOLEAN NOT NULL DEFAULT FALSE,
    remember_me BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_two_factor_challenges_token ON two_factor_challenges(challenge_token);
CREATE INDEX idx_two_factor_challenges_usuario ON two_factor_challenges(usuario_id);

-- Schema/reference data from V19; V11 has a neutral singleton.
CREATE TABLE notificacoes (
    id BIGSERIAL PRIMARY KEY,
    tipo VARCHAR(50) NOT NULL,
    titulo VARCHAR(150) NOT NULL,
    mensagem VARCHAR(500) NOT NULL,
    lida BOOLEAN NOT NULL DEFAULT FALSE,
    criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    lido_em TIMESTAMP WITH TIME ZONE,
    recurso_tipo VARCHAR(50),
    recurso_id BIGINT,
    link VARCHAR(255),
    chave_unica VARCHAR(100) NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uk_notificacoes_chave_unica UNIQUE (chave_unica)
);

CREATE INDEX idx_notificacoes_ativo_lida ON notificacoes(ativo, lida);
CREATE INDEX idx_notificacoes_criado_em ON notificacoes(criado_em DESC);

-- Schema/reference data from V20; V11 has a neutral singleton.
ALTER TABLE usuarios ADD COLUMN token_version INT NOT NULL DEFAULT 0;

-- Schema/reference data from V21; V11 has a neutral singleton.
ALTER TABLE refresh_tokens ADD COLUMN token_hash VARCHAR(64);

UPDATE refresh_tokens SET token_hash = encode(sha256(token::bytea), 'hex') WHERE token IS NOT NULL;

ALTER TABLE refresh_tokens ALTER COLUMN token_hash SET NOT NULL;

ALTER TABLE refresh_tokens ADD CONSTRAINT uk_refresh_tokens_token_hash UNIQUE (token_hash);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);

DROP INDEX IF EXISTS idx_refresh_tokens_token;
ALTER TABLE refresh_tokens DROP COLUMN token;

-- Schema/reference data from V22; V11 has a neutral singleton.
ALTER TABLE produtos ALTER COLUMN margem_lucro TYPE NUMERIC(16, 2);

-- Schema/reference data from V23; V11 has a neutral singleton.
CREATE TABLE security_rate_limits (
    bucket_key VARCHAR(100) PRIMARY KEY,
    used BIGINT NOT NULL CHECK (used > 0 AND used <= 1000000000),
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_security_rate_limits_expiry ON security_rate_limits (expires_at);

-- Schema/reference data from V24; V11 has a neutral singleton.
CREATE TABLE security_rate_key_state (
    singleton SMALLINT PRIMARY KEY CHECK (singleton = 1),
    key_fingerprint CHAR(64) NOT NULL
);

