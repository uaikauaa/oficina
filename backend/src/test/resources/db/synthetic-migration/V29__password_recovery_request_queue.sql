-- The public request commits only an encrypted email. Account lookup and token issuance
-- happen later in a transaction held by one PostgreSQL worker at a time.
CREATE TABLE password_recovery_request_jobs (
    id UUID PRIMARY KEY,
    key_version INTEGER NOT NULL CHECK (key_version > 0),
    nonce BYTEA,
    ciphertext BYTEA,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING','PROCESSED','EXPIRED','EXHAUSTED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '1 hour',
    processed_at TIMESTAMPTZ,
    failure_category VARCHAR(32),
    CONSTRAINT uq_password_recovery_job_nonce UNIQUE (key_version, nonce),
    CONSTRAINT chk_password_recovery_job_expiration CHECK (expires_at > created_at),
    CONSTRAINT chk_password_recovery_job_payload CHECK (
        (status='PENDING' AND nonce IS NOT NULL AND ciphertext IS NOT NULL)
        OR (status<>'PENDING' AND nonce IS NULL AND ciphertext IS NULL))
);
CREATE INDEX idx_password_recovery_job_pending ON password_recovery_request_jobs(created_at,id)
    WHERE status='PENDING';
