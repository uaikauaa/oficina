-- ==============================================================================
-- Oficina Gestão — V19: Criação da tabela de notificações persistentes do sistema
-- Motor: PostgreSQL (Neon)
-- ==============================================================================

CREATE TABLE notificacoes (
    id BIGSERIAL PRIMARY KEY,
    tipo VARCHAR(50) NOT NULL,
    titulo VARCHAR(150) NOT NULL,
    mensagem VARCHAR(500) NOT NULL,
    lida BOOLEAN NOT NULL DEFAULT FALSE,
    criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    lido_em TIMESTAMP WITH TIME ZONE,
    recurso_tipo VARCHAR(50),
    recurso_id BIGINT,
    link VARCHAR(255),
    chave_unica VARCHAR(100) NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uk_notificacoes_chave_unica UNIQUE (chave_unica)
);

CREATE INDEX idx_notificacoes_ativo_lida ON notificacoes(ativo, lida);
CREATE INDEX idx_notificacoes_criado_em ON notificacoes(criado_em DESC);
