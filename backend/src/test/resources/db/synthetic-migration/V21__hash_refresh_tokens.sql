-- ==============================================================================
-- Oficina Gestão — V21: Armazenamento seguro de refresh tokens com hash SHA-256 (ADC-01)
-- Motor: PostgreSQL (Neon)
-- ==============================================================================

-- 1. Adicionar nova coluna token_hash (VARCHAR(64) para hash SHA-256 em hexadecimal lowercase)
ALTER TABLE refresh_tokens ADD COLUMN token_hash VARCHAR(64);

-- 2. Migrar deterministicamente todos os tokens existentes em texto puro para SHA-256
-- A função encode(sha256(token::bytea), 'hex') gera exatamente 64 caracteres hexadecimais em minúsculo
UPDATE refresh_tokens SET token_hash = encode(sha256(token::bytea), 'hex') WHERE token IS NOT NULL;

-- 3. Definir token_hash como NOT NULL após o preenchimento de todos os registros
ALTER TABLE refresh_tokens ALTER COLUMN token_hash SET NOT NULL;

-- 4. Adicionar constraint UNIQUE e índice em token_hash
ALTER TABLE refresh_tokens ADD CONSTRAINT uk_refresh_tokens_token_hash UNIQUE (token_hash);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);

-- 5. Remover com segurança a coluna antiga de token em texto puro e seus índices associados
DROP INDEX IF EXISTS idx_refresh_tokens_token;
ALTER TABLE refresh_tokens DROP COLUMN token;
