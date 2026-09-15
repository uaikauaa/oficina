-- ============================================================================
-- OFICINA GESTÃO - CORREÇÃO DE DOMÍNIO DE EQUIPAMENTOS (MÁQUINAS DE SOLDA E GERADORES)
-- Migration: V4__correct_equipment_domain.sql
-- Motor: PostgreSQL (Neon)
-- Descrição: Remove conceitos e colunas automotivas e alinha o modelo de dados
--            com o domínio real de equipamentos técnicos (máquinas de solda,
--            geradores de energia e componentes).
-- ============================================================================

-- 1. Remoção de índices automotivos incorretos
DROP INDEX IF EXISTS idx_maquinas_placa;
DROP INDEX IF EXISTS idx_maquinas_chassi;

-- 2. Ajuste na tabela de máquinas/equipamentos dos clientes
-- Renomear tipo para tipo_equipamento
ALTER TABLE maquinas RENAME COLUMN tipo TO tipo_equipamento;

-- Renomear numero_serie_chassi para numero_serie
ALTER TABLE maquinas RENAME COLUMN numero_serie_chassi TO numero_serie;

-- Remover coluna automotiva placa_identificacao
ALTER TABLE maquinas DROP COLUMN IF EXISTS placa_identificacao;

-- Renomear horimetro_quilometragem para horimetro (horas de uso de geradores e equipamentos)
ALTER TABLE maquinas RENAME COLUMN horimetro_quilometragem TO horimetro;

-- Adicionar campos técnicos específicos para equipamentos industriais/técnicos
ALTER TABLE maquinas ADD COLUMN IF NOT EXISTS potencia VARCHAR(50);
ALTER TABLE maquinas ADD COLUMN IF NOT EXISTS tensao VARCHAR(50);
ALTER TABLE maquinas ADD COLUMN IF NOT EXISTS especificacoes_tecnicas JSONB;

-- 3. Ajuste na tabela de ordens de serviço
-- Renomear horimetro_quilometragem_atual para horimetro_atual
ALTER TABLE ordens_servico RENAME COLUMN horimetro_quilometragem_atual TO horimetro_atual;

-- 4. Criação de índices otimizados para busca e histórico de equipamentos
CREATE INDEX idx_maquinas_tipo_equipamento ON maquinas(tipo_equipamento);
CREATE INDEX idx_maquinas_numero_serie ON maquinas(numero_serie);
CREATE INDEX idx_maquinas_cliente_numero_serie ON maquinas(cliente_id, numero_serie);
