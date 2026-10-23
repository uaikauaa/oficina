-- ==============================================================================
-- OFICINA GESTÃO — V16: CÓDIGO SEQUENCIAL DE PRODUTOS E LINK DE COMPRA
-- Motor: PostgreSQL (Neon)
-- Descrição: 
-- 1. Cria sequência produtos_codigo_seq para geração atômica e sequencial de códigos (P-001, P-002...).
-- 2. Migra com segurança os códigos legados de produtos existentes para o formato P-001..P-N preservando todos os dados.
-- 3. Sincroniza a sequence produtos_codigo_seq para o próximo valor após os produtos existentes.
-- 4. Adiciona a coluna link_compra.
-- 5. Remove a coluna legada codigo_barras.
-- ==============================================================================

-- 1. Cria sequence para controle atômico e sequencial do código da peça/produto
CREATE SEQUENCE IF NOT EXISTS produtos_codigo_seq START WITH 1 INCREMENT BY 1;

-- 2. Migração segura dos produtos existentes para o padrão sequencial P-001, P-002...
DO $$
DECLARE
    r RECORD;
    seq_val BIGINT := 1;
BEGIN
    -- Prefixo temporário para evitar qualquer conflito transitório de unicidade
    UPDATE produtos SET codigo = '__MIG_TEMP_' || id;

    -- Atribui os novos códigos sequenciais P-001, P-002... ordenados pelo ID original de criação
    FOR r IN SELECT id FROM produtos ORDER BY id ASC LOOP
        UPDATE produtos 
        SET codigo = 'P-' || LPAD(seq_val::text, GREATEST(3, LENGTH(seq_val::text)), '0')
        WHERE id = r.id;
        
        seq_val := seq_val + 1;
    END LOOP;

    -- Define o valor atual da sequência para o último número utilizado
    IF seq_val > 1 THEN
        PERFORM setval('produtos_codigo_seq', seq_val - 1, true);
    ELSE
        PERFORM setval('produtos_codigo_seq', 1, false);
    END IF;
END $$;

-- 3. Adiciona campo para Link de Compra do fornecedor/peça
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS link_compra VARCHAR(1000);

-- 4. Remove campo legado de código de barras
ALTER TABLE produtos DROP COLUMN IF EXISTS codigo_barras;
