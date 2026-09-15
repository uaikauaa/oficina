-- ============================================================================
-- OFICINA GESTÃO - V6: AJUSTES FINAIS NA TABELA MAQUINAS
-- Motor: PostgreSQL (Neon)
-- Descrição: Adiciona constraint CHECK para tipos de equipamentos válidos,
--            garante o índice em cliente_id e adiciona o campo cor.
-- ============================================================================

-- 1. Adicionar constraint CHECK para tipo_equipamento
--    Aceita apenas os tipos do domínio oficial da oficina técnica.
ALTER TABLE maquinas
    ADD CONSTRAINT chk_maquinas_tipo_equipamento
    CHECK (tipo_equipamento IN ('MAQUINA_SOLDA', 'GERADOR_ENERGIA', 'OUTRO_EQUIPAMENTO'));

-- 2. Garantir índice em cliente_id (se ainda não existir)
CREATE INDEX IF NOT EXISTS idx_maquinas_cliente_id ON maquinas(cliente_id);

-- 3. Garantir índice composto para pesquisas de equipamentos ativos por cliente
CREATE INDEX IF NOT EXISTS idx_maquinas_cliente_ativo ON maquinas(cliente_id, ativo);
