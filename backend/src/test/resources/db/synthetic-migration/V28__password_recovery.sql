-- Public password recovery; verifier contains only SHA-256, delivery contains only authenticated ciphertext.
-- Stable logical session ID survives refresh-token rotation. Existing rows receive one ID each.
ALTER TABLE refresh_tokens ADD COLUMN session_id UUID NOT NULL DEFAULT gen_random_uuid();
CREATE INDEX idx_refresh_session_active ON refresh_tokens(usuario_id,session_id)
    WHERE revogado=false;

CREATE TABLE password_reset_requests (
    id BIGSERIAL PRIMARY KEY,
    usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expira_em TIMESTAMPTZ NOT NULL,
    usado_em TIMESTAMPTZ,
    revogado_em TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_password_reset_expiration CHECK (expira_em > created_at)
);
CREATE UNIQUE INDEX uq_password_reset_pending ON password_reset_requests(usuario_id)
    WHERE usado_em IS NULL AND revogado_em IS NULL;
CREATE INDEX idx_password_reset_expiration ON password_reset_requests(expira_em);

CREATE TABLE password_reset_outbox (
    id BIGSERIAL PRIMARY KEY,
    reset_id BIGINT NOT NULL UNIQUE REFERENCES password_reset_requests(id) ON DELETE CASCADE,
    key_version INTEGER NOT NULL CHECK (key_version > 0),
    nonce BYTEA,
    ciphertext BYTEA,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING','SENT','CANCELLED','EXHAUSTED')),
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_failure VARCHAR(32),
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_password_reset_nonce UNIQUE (key_version, nonce),
    CHECK ((status='PENDING' AND nonce IS NOT NULL AND ciphertext IS NOT NULL)
        OR (status<>'PENDING' AND nonce IS NULL AND ciphertext IS NULL))
);
CREATE INDEX idx_password_reset_delivery_pending ON password_reset_outbox(next_attempt_at,id)
    WHERE status='PENDING';
