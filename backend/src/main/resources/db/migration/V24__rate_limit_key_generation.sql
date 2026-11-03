-- Public fingerprint only: never store the rate-limiter secret in PostgreSQL.
CREATE TABLE security_rate_key_state (
    singleton SMALLINT PRIMARY KEY CHECK (singleton = 1),
    key_fingerprint CHAR(64) NOT NULL
);
