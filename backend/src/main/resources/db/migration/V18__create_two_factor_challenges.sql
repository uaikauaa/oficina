-- ==============================================================================
-- Oficina Gestão — V18: Criação da tabela de desafios 2FA por e-mail
-- Motor: PostgreSQL (Neon)
-- ==============================================================================

CREATE TABLE two_factor_challenges (
    id BIGSERIAL PRIMARY KEY,
    usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    challenge_token VARCHAR(255) NOT NULL UNIQUE,
    codigo_hash VARCHAR(255) NOT NULL,
    data_criacao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    data_expiracao TIMESTAMP WITH TIME ZONE NOT NULL,
    tentativas INT NOT NULL DEFAULT 0,
    utilizado BOOLEAN NOT NULL DEFAULT FALSE,
    revogado BOOLEAN NOT NULL DEFAULT FALSE,
    remember_me BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_two_factor_challenges_token ON two_factor_challenges(challenge_token);
CREATE INDEX idx_two_factor_challenges_usuario ON two_factor_challenges(usuario_id);
