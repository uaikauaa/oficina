-- ==============================================================================
-- OFICINA GESTÃO — V7: CONSTRAINTS E ÍNDICES PARA CONTROLE DE ESTOQUE E PRODUTOS
-- Motor: PostgreSQL (Neon)
-- Descrição: Garante que o estoque nunca seja negativo a nível de banco de dados
--            e otimiza consultas de estoque baixo e histórico de movimentações.
-- ==============================================================================

-- 1. Constraint de estoque não negativo na tabela produtos
ALTER TABLE produtos
    ADD CONSTRAINT chk_produtos_estoque_nao_negativo
    CHECK (estoque_atual >= 0);

-- 2. Constraint de estoque mínimo não negativo na tabela produtos
ALTER TABLE produtos
    ADD CONSTRAINT chk_produtos_estoque_minimo_nao_negativo
    CHECK (estoque_minimo >= 0);

-- 3. Índices para pesquisa e alertas de estoque baixo / zerado
CREATE INDEX IF NOT EXISTS idx_produtos_estoque_baixo ON produtos(estoque_atual, estoque_minimo);
CREATE INDEX IF NOT EXISTS idx_produtos_ativo ON produtos(ativo);
CREATE INDEX IF NOT EXISTS idx_produtos_tipo ON produtos(tipo);

-- 4. Índice para filtros de tipo de movimentação de estoque
CREATE INDEX IF NOT EXISTS idx_estoque_mov_tipo ON estoque_movimentacoes(tipo_movimentacao);
