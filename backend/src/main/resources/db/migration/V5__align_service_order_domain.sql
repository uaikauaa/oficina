-- 1. Adicionar campo de testes realizados na Ordem de Serviço
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS testes_realizados TEXT;

-- 2. Atualizar a constraint de status e valor padrão para o fluxo real da oficina técnica
ALTER TABLE ordens_servico DROP CONSTRAINT IF EXISTS ordens_servico_status_check;

ALTER TABLE ordens_servico ADD CONSTRAINT ordens_servico_status_check CHECK (
    status IN (
        'ABERTA',
        'EM_DIAGNOSTICO',
        'AGUARDANDO_APROVACAO',
        'EM_MANUTENCAO',
        'AGUARDANDO_PECA',
        'PRONTA',
        'CONCLUIDA',
        'CANCELADA'
    )
);

ALTER TABLE ordens_servico ALTER COLUMN status SET DEFAULT 'ABERTA';
