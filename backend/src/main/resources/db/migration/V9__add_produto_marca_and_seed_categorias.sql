-- ==============================================================================
-- OFICINA GESTÃO — V9: ADIÇÃO DE MARCA EM PRODUTOS E CARGA INICIAL DE CATEGORIAS
-- Motor: PostgreSQL (Neon)
-- Descrição: Adiciona coluna marca na tabela produtos e cadastra as categorias
--            técnicas oficiais para equipamentos industriais/oficina.
-- ==============================================================================

-- 1. Adiciona coluna marca na tabela produtos
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS marca VARCHAR(100);

-- 2. Cria índice para buscas otimizadas por marca
CREATE INDEX IF NOT EXISTS idx_produtos_marca ON produtos(marca);

-- 3. Carga inicial das categorias técnicas padrão (não automotivas)
INSERT INTO categorias (nome, descricao, ativo) VALUES
    ('Eletrônica', 'Componentes eletrônicos, placas inversoras, IGBTs, diodos e controladores', true),
    ('Máquina de Solda', 'Componentes específicos para máquinas de solda MIG, TIG e MMA', true),
    ('Gerador', 'Componentes e peças para geradores de energia a diesel/gasolina e reguladores AVR', true),
    ('Elétrica', 'Cabos, contatores, relés, conectores e fiações técnicas', true),
    ('Mecânica', 'Rolamentos, eixos, carcaças, ventoinhas e componentes estruturais', true),
    ('Consumíveis', 'Consumíveis de soldagem, bicos de contato, bocais e filtros técnicos', true)
ON CONFLICT (nome) DO NOTHING;
