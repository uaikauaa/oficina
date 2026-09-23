-- V13: Preparação da Estrutura Fiscal, DPS e Código IBGE do Tomador
-- Fase 6.3 - Oficina Gestão / Bruno Soldas

-- 1. Dados Fiscais do Tomador: Adicionar código IBGE na tabela clientes
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS codigo_ibge VARCHAR(20);

-- 2. Controle de Numeração Sequencial e Concorrente da DPS
CREATE TABLE IF NOT EXISTS dps_numeracao (
    id BIGSERIAL PRIMARY KEY,
    serie VARCHAR(10) NOT NULL UNIQUE,
    ultimo_numero BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Série padrão '1' inicializada em 0
INSERT INTO dps_numeracao (serie, ultimo_numero)
VALUES ('1', 0)
ON CONFLICT (serie) DO NOTHING;

-- 3. Documento de Preparação para Futura NFS-e (DPS)
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

    -- Snapshot imutável do Prestador
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

    -- Snapshot imutável do Tomador
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

    -- Campos preparatórios para futura integração com NFS-e Nacional / SEFIN
    numero_nfse VARCHAR(50),
    chave_acesso_nfse VARCHAR(100),
    xml_autorizado TEXT,
    mensagens_retorno TEXT,

    -- Campos preparatórios para futura Reforma Tributária (IBS / CBS)
    aliquota_ibs NUMERIC(6, 4),
    valor_ibs NUMERIC(12, 2),
    aliquota_cbs NUMERIC(6, 4),
    valor_cbs NUMERIC(12, 2),
    codigo_tributacao_ibs_cbs VARCHAR(30),

    -- Auditoria e rastreabilidade
    usuario_preparacao_id BIGINT REFERENCES usuarios(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Unicidade da série e número
    CONSTRAINT uk_dps_fiscal_serie_numero UNIQUE (serie, numero)
);

-- Índices para otimização de consultas
CREATE INDEX IF NOT EXISTS idx_dps_fiscal_os_id ON dps_fiscal(ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_dps_fiscal_cliente_id ON dps_fiscal(cliente_id);
CREATE INDEX IF NOT EXISTS idx_dps_fiscal_status ON dps_fiscal(status);
