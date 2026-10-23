-- ==============================================================================
-- Configuracao sintetica de laboratorio; sem dados cadastrais reais.
-- Motor: PostgreSQL (Neon)
-- Descrição:
--   1. Atualiza registros de usuários legados cujo nome seja 'Proprietária Oficina'
-- Configuracao sintetica de laboratorio; sem dados cadastrais reais.
--   2. Garante a existência do registro singleton na tabela configuracao_oficina
-- Configuracao sintetica de laboratorio; sem dados cadastrais reais.
-- ==============================================================================

-- 1. Atualizar usuários legados criados com o placeholder 'Proprietária Oficina'
UPDATE usuarios
SET nome = 'RESPONSAVEL SINTETICO'
WHERE nome = 'Proprietária Oficina' OR nome IS NULL;

-- Configuracao sintetica de laboratorio; sem dados cadastrais reais.
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
    'OFICINA LAB SINTETICA 02GA',
    'ENTIDADE FICTICIA DE TESTE 02GA',
    'CNPJ-SINTETICO',
    NULL,
    'REGIME SINTETICO',
    'SERVICO-TESTE',
    'RESPONSAVEL SINTETICO',
    'SEM-TELEFONE',
    'oficina@example.invalid',
    'VIA SINTETICA',
    'S/N',
    'BAIRRO SINTETICO',
    'CEP-TESTE',
    'MUNICIPIO SINTETICO',
    'ZZ',
    'IBGE-TESTE'
WHERE NOT EXISTS (SELECT 1 FROM configuracao_oficina);
