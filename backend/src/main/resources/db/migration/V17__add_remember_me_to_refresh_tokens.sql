-- ==============================================================================
-- Oficina Gestão — V17: Adiciona coluna remember_me na tabela refresh_tokens
-- Motor: PostgreSQL (Neon)
-- ==============================================================================

ALTER TABLE refresh_tokens ADD COLUMN remember_me BOOLEAN NOT NULL DEFAULT FALSE;
