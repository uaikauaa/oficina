-- Invitation delivery is committed atomically with the invitation. Ciphertext is erased on terminal states.
CREATE TABLE invite_delivery_outbox (
    id BIGSERIAL PRIMARY KEY,
    invite_id BIGINT NOT NULL UNIQUE REFERENCES convites_usuarios(id) ON DELETE CASCADE,
    key_version INTEGER NOT NULL CHECK (key_version > 0),
    nonce BYTEA,
    ciphertext BYTEA,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','SENT','CANCELLED','EXHAUSTED')),
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_failure VARCHAR(32),
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_invite_delivery_nonce UNIQUE (key_version, nonce),
    CHECK ((status = 'PENDING' AND nonce IS NOT NULL AND ciphertext IS NOT NULL)
        OR (status <> 'PENDING' AND nonce IS NULL AND ciphertext IS NULL))
);
CREATE INDEX idx_invite_delivery_pending ON invite_delivery_outbox(next_attempt_at, id) WHERE status='PENDING';
