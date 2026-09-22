-- ==============================================================================
-- OFICINA GESTÃO — V11: CONFIGURAÇÃO FISCAL E DADOS DA OFICINA
-- Motor: PostgreSQL (Neon)
-- Descrição: Cria tabela centralizada de configuração da oficina com dados
--            cadastrais, comerciais e fiscais de referência.
--            Insere os dados reais da oficina Bruno Soldas conforme NFS-e
--            de referência fornecida (CNPJ 45.076.507/0001-67).
-- IMPORTANTE: Esta tabela NÃO emite NFS-e. É apenas armazenamento de
--             configuração e referência para futura integração fiscal.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS configuracao_oficina (
    id                       BIGSERIAL PRIMARY KEY,

    -- Identidade do sistema e da oficina
    nome_sistema             VARCHAR(100) NOT NULL DEFAULT 'Oficina Gestão',
    nome_fantasia            VARCHAR(200) NOT NULL,
    nome_empresarial         VARCHAR(200),

    -- Dados fiscais (baseados na NFS-e de referência; sem inventar dados)
    cnpj                     VARCHAR(20),
    inscricao_municipal      VARCHAR(50),       -- NULL: não informado na NFS-e de referência
    regime_tributario        VARCHAR(100),      -- Ex: "Simples Nacional / MEI"
    codigo_tributacao_servico VARCHAR(20),      -- Ex: "14.01.01" conforme NFS-e de referência

    -- Responsável/proprietário administrativo da oficina
    responsavel              VARCHAR(200),

    -- Contato
    telefone                 VARCHAR(30),
    email                    VARCHAR(200),

    -- Endereço
    logradouro               VARCHAR(300),
    numero                   VARCHAR(20),
    bairro                   VARCHAR(100),
    cep                      VARCHAR(20),
    municipio                VARCHAR(100),
    uf                       VARCHAR(2),
    codigo_ibge              VARCHAR(20),       -- Código IBGE do município (conforme NFS-e)

    -- Metadados
    created_at               TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Índice único: garante que só existe um registro (singleton de configuração)
CREATE UNIQUE INDEX IF NOT EXISTS idx_configuracao_oficina_singleton ON configuracao_oficina ((id IS NOT NULL)) WHERE id IS NOT NULL;

-- ------------------------------------------------------------------------------
-- Inserção dos dados reais da oficina Bruno Soldas
-- Fonte: NFS-e de referência fornecida (Ourinhos/SP, CNPJ 45.076.507/0001-67)
-- Inscrição municipal: deixada NULL pois constava "-" no documento de referência
-- ------------------------------------------------------------------------------
INSERT INTO configuracao_oficina (
    nome_sistema,
    nome_fantasia,
    nome_empresarial,
    cnpj,
    inscricao_municipal,
    regime_tributario,
    codigo_tributacao_servico,
    responsavel,
    telefone,
    email,
    logradouro,
    numero,
    bairro,
    cep,
    municipio,
    uf,
    codigo_ibge
) VALUES (
    'Oficina Gestão',
    'Bruno Soldas',
    '45.076.507 BRUNO SOARES RODRIGUES',
    '45.076.507/0001-67',
    NULL,                                    -- não informado na NFS-e de referência
    'Simples Nacional / MEI',
    '14.01.01',                             -- código de referência da NFS-e fornecida
    'Geisa',
    '(14) 9886-7223',
    'INDUTECSERVICE@HOTMAIL.COM',
    'Avenida Jacinto Ferreira de Sá - de 1272/1273 ao fim',
    '1538',
    'Vila Sandano',
    '19.914-080',
    'Ourinhos',
    'SP',
    '35.34708'                               -- código IBGE conforme NFS-e de referência
);
