-- ==============================================================================
-- OFICINA GESTÃO — V8: SEQUENCE NATIVA PARA NUMERAÇÃO DE ORDENS DE SERVIÇO
-- Motor: PostgreSQL (Neon)
-- Descrição: Cria sequência atômica no banco de dados para evitar condições de
--            corrida (race conditions) na geração de números de OS concorrentes.
-- ==============================================================================

CREATE SEQUENCE IF NOT EXISTS ordens_servico_seq START WITH 1 INCREMENT BY 1;

-- Sincroniza a sequence com o total de registros de ordens de serviço já existentes
DO $$
DECLARE
    max_seq BIGINT;
BEGIN
    SELECT COALESCE(COUNT(*), 0) INTO max_seq FROM ordens_servico;
    IF max_seq > 0 THEN
        PERFORM setval('ordens_servico_seq', max_seq);
    END IF;
END $$;
