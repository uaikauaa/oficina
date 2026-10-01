-- ==============================================================================
-- Oficina Gestão — V20: Add token_version to usuarios (SEC-07)
-- Invalidação imediata de access_token após logout e alteração de senha
-- ==============================================================================

ALTER TABLE usuarios ADD COLUMN token_version INT NOT NULL DEFAULT 0;
