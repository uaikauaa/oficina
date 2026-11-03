-- No account identifiers, e-mails, IPs or credentials are stored in clear text.
CREATE TABLE security_rate_limits (
    bucket_key VARCHAR(100) PRIMARY KEY,
    used BIGINT NOT NULL CHECK (used > 0 AND used <= 1000000000),
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_security_rate_limits_expiry ON security_rate_limits (expires_at);
