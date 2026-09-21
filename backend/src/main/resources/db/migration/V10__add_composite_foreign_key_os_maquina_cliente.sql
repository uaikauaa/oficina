-- ==============================================================================
-- Oficina Gestão — V10: Integridade Referencial Composta (OS x Máquina x Cliente)
-- Motor: PostgreSQL (Neon)
-- Issue: AUDIT-004
-- ==============================================================================

-- 1. Adicionar restrição de unicidade composta na tabela maquinas
-- Permite que uma chave estrangeira referencie o par (id, cliente_id)
ALTER TABLE maquinas 
    ADD CONSTRAINT uq_maquinas_id_cliente UNIQUE (id, cliente_id);

-- 2. Adicionar chave estrangeira composta na tabela ordens_servico
-- Garante no nível de banco que o equipamento vinculado à OS pertença estritamente ao mesmo cliente da OS
ALTER TABLE ordens_servico 
    ADD CONSTRAINT fk_ordens_servico_maquina_cliente 
    FOREIGN KEY (maquina_id, cliente_id) 
    REFERENCES maquinas(id, cliente_id) 
    ON DELETE RESTRICT;
