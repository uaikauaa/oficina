-- ==============================================================================
-- OFICINA GESTÃO — V12: AJUSTE DE IDENTIDADE (BRUNO SOLDAS / GEISA)
-- Motor: PostgreSQL (Neon)
-- Descrição:
--   1. Atualiza registros de usuários legados cujo nome seja 'Proprietária Oficina'
--      para 'Geisa', alinhando com a proprietária real da Bruno Soldas.
--   2. Garante a existência do registro singleton na tabela configuracao_oficina
--      com os dados oficiais da Bruno Soldas (CNPJ 45.076.507/0001-67).
-- ==============================================================================

-- 1. Atualizar usuários legados criados com o placeholder 'Proprietária Oficina'
UPDATE usuarios
SET nome = 'Geisa'
WHERE nome = 'Proprietária Oficina' OR nome IS NULL;

-- 2. Garantir que a tabela configuracao_oficina possua o registro da Bruno Soldas
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
)
SELECT
    'Oficina Gestão',
    'Bruno Soldas',
    '45.076.507 BRUNO SOARES RODRIGUES',
    '45.076.507/0001-67',
    NULL,
    'Simples Nacional / MEI',
    '14.01.01',
    'Geisa',
    '(14) 9886-7223',
    'INDUTECSERVICE@HOTMAIL.COM',
    'Avenida Jacinto Ferreira de Sá - de 1272/1273 ao fim',
    '1538',
    'Vila Sandano',
    '19.914-080',
    'Ourinhos',
    'SP',
    '35.34708'
WHERE NOT EXISTS (SELECT 1 FROM configuracao_oficina);
