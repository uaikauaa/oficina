-- V25: catálogo RBAC e trilha administrativa. Não altera usuários, hashes ou papéis atuais.
CREATE TABLE permissoes (
    id BIGSERIAL PRIMARY KEY,
    codigo VARCHAR(120) NOT NULL UNIQUE,
    descricao VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE role_permissoes (
    role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permissao_id BIGINT NOT NULL REFERENCES permissoes(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permissao_id)
);
CREATE INDEX idx_role_permissoes_permissao ON role_permissoes(permissao_id);
CREATE TABLE convites_usuarios (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(150) NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    criado_por BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
    expira_em TIMESTAMPTZ NOT NULL,
    usado_em TIMESTAMPTZ,
    revogado_em TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_convite_expiracao CHECK (expira_em > created_at)
);
CREATE INDEX idx_convites_usuarios_email ON convites_usuarios(lower(email));
CREATE UNIQUE INDEX uq_convites_usuarios_pendente ON convites_usuarios(lower(email))
WHERE usado_em IS NULL AND revogado_em IS NULL;
CREATE TABLE eventos_administrativos (
    id BIGSERIAL PRIMARY KEY,
    ator_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
    alvo_usuario_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
    acao VARCHAR(80) NOT NULL,
    motivo VARCHAR(500),
    detalhes TEXT,
    ocorrido_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_eventos_administrativos_ocorrido_em ON eventos_administrativos(ocorrido_em DESC);
INSERT INTO roles(nome, descricao) VALUES
    ('ROLE_SUPER_ADMIN', 'Administrador principal'),
    ('ROLE_OPERADOR_GERAL', 'Operações e financeiro da oficina'),
    ('ROLE_GERENTE', 'Gestão operacional delegada'),
    ('ROLE_ATENDENTE', 'Atendimento delegado'),
    ('ROLE_TECNICO', 'Serviços técnicos delegados'),
    ('ROLE_ESTOQUISTA', 'Estoque delegado'),
    ('ROLE_FINANCEIRO', 'Financeiro delegado'),
    ('ROLE_CONSULTA', 'Consulta operacional')
ON CONFLICT (nome) DO NOTHING;
INSERT INTO permissoes(codigo, descricao) VALUES
    ('ordens.servico.contadores.dashboard.get', 'GET /api/ordens-servico/contadores-dashboard'),
    ('ordens.servico.contadores.status.get', 'GET /api/ordens-servico/contadores-status'),
    ('relatorios.pecas.mais.utilizadas.get', 'GET /api/relatorios/pecas-mais-utilizadas'),
    ('clientes.contadores.status.get', 'GET /api/clientes/contadores-status'),
    ('relatorios.ordens.servico.get', 'GET /api/relatorios/ordens-servico'),
    ('relatorios.movimentacoes.get', 'GET /api/relatorios/movimentacoes'),
    ('relatorios.equipamentos.get', 'GET /api/relatorios/equipamentos'),
    ('notificacoes.ler.todas.patch', 'PATCH /api/notificacoes/ler-todas'),
    ('notificacoes.ler.todas.put', 'PUT /api/notificacoes/ler-todas'),
    ('estoque.movimentacoes.get', 'GET /api/estoque/movimentacoes'),
    ('relatorios.clientes.get', 'GET /api/relatorios/clientes'),
    ('relatorios.estoque.get', 'GET /api/relatorios/estoque'),
    ('estoque.movimentar.post', 'POST /api/estoque/movimentar'),
    ('categorias.ativas.get', 'GET /api/categorias/ativas'),
    ('estoque.entrada.post', 'POST /api/estoque/entrada'),
    ('estoque.resumo.get', 'GET /api/estoque/resumo'),
    ('estoque.ajuste.post', 'POST /api/estoque/ajuste'),
    ('system.status.get', 'GET /api/system/status'),
    ('estoque.saida.post', 'POST /api/estoque/saida'),
    ('busca.rapida.get', 'GET /api/busca/rapida'),
    ('produtos.id.compatibilidades.id.delete', 'DELETE /api/produtos/{id}/compatibilidades/{maquinaId}'),
    ('ordens.servico.id.itens.id.delete', 'DELETE /api/ordens-servico/{id}/itens/{itemId}'),
    ('produtos.id.maquinas.id.delete', 'DELETE /api/produtos/{id}/maquinas/{maquinaId}'),
    ('ordens.servico.id.documento.servico.get', 'GET /api/ordens-servico/{id}/documento-servico'),
    ('clientes.id.ordens.servico.get', 'GET /api/clientes/{clienteId}/ordens-servico'),
    ('maquinas.id.ordens.servico.get', 'GET /api/maquinas/{maquinaId}/ordens-servico'),
    ('produtos.id.compatibilidades.get', 'GET /api/produtos/{id}/compatibilidades'),
    ('produtos.id.compatibilidades.post', 'POST /api/produtos/{id}/compatibilidades'),
    ('clientes.id.maquinas.get', 'GET /api/clientes/{clienteId}/maquinas'),
    ('ordens.servico.id.recibo.get', 'GET /api/ordens-servico/{id}/recibo'),
    ('ordens.servico.id.status.patch', 'PATCH /api/ordens-servico/{id}/status'),
    ('ordens.servico.id.itens.get', 'GET /api/ordens-servico/{id}/itens'),
    ('ordens.servico.id.itens.post', 'POST /api/ordens-servico/{id}/itens'),
    ('fornecedores.id.status.patch', 'PATCH /api/fornecedores/{id}/status'),
    ('clientes.id.historico.get', 'GET /api/clientes/{id}/historico'),
    ('maquinas.id.historico.get', 'GET /api/maquinas/{id}/historico'),
    ('ordens.servico.id.pdf.get', 'GET /api/ordens-servico/{id}/pdf'),
    ('produtos.id.maquinas.get', 'GET /api/produtos/{id}/maquinas'),
    ('categorias.id.status.patch', 'PATCH /api/categorias/{id}/status'),
    ('produtos.id.maquinas.post', 'POST /api/produtos/{id}/maquinas'),
    ('notificacoes.id.ler.patch', 'PATCH /api/notificacoes/{id}/ler'),
    ('notificacoes.id.ler.put', 'PUT /api/notificacoes/{id}/ler'),
    ('clientes.id.resumo.get', 'GET /api/clientes/{id}/resumo'),
    ('maquinas.id.resumo.get', 'GET /api/maquinas/{id}/resumo'),
    ('clientes.id.status.patch', 'PATCH /api/clientes/{id}/status'),
    ('maquinas.id.status.patch', 'PATCH /api/maquinas/{id}/status'),
    ('produtos.id.status.patch', 'PATCH /api/produtos/{id}/status'),
    ('ordens.servico.id.get', 'GET /api/ordens-servico/{id}'),
    ('ordens.servico.id.put', 'PUT /api/ordens-servico/{id}'),
    ('fornecedores.id.get', 'GET /api/fornecedores/{id}'),
    ('fornecedores.id.put', 'PUT /api/fornecedores/{id}'),
    ('categorias.id.get', 'GET /api/categorias/{id}'),
    ('categorias.id.put', 'PUT /api/categorias/{id}'),
    ('clientes.id.get', 'GET /api/clientes/{id}'),
    ('maquinas.id.get', 'GET /api/maquinas/{id}'),
    ('produtos.id.get', 'GET /api/produtos/{id}'),
    ('clientes.id.put', 'PUT /api/clientes/{id}'),
    ('maquinas.id.put', 'PUT /api/maquinas/{id}'),
    ('produtos.id.put', 'PUT /api/produtos/{id}'),
    ('configuracao.oficina.get', 'GET /api/configuracao-oficina'),
    ('configuracao.oficina.put', 'PUT /api/configuracao-oficina'),
    ('ordens.servico.get', 'GET /api/ordens-servico'),
    ('ordens.servico.post', 'POST /api/ordens-servico'),
    ('fornecedores.get', 'GET /api/fornecedores'),
    ('notificacoes.get', 'GET /api/notificacoes'),
    ('fornecedores.post', 'POST /api/fornecedores'),
    ('categorias.get', 'GET /api/categorias'),
    ('categorias.post', 'POST /api/categorias'),
    ('clientes.get', 'GET /api/clientes'),
    ('maquinas.get', 'GET /api/maquinas'),
    ('produtos.get', 'GET /api/produtos'),
    ('clientes.post', 'POST /api/clientes'),
    ('maquinas.post', 'POST /api/maquinas'),
    ('produtos.post', 'POST /api/produtos'),
    ('usuarios.visualizar', 'Listar usuários administrativos'),
    ('usuarios.gerenciar', 'Alterar estado e papéis de usuários'),
    ('seguranca.revogar', 'Revogar sessões de terceiros'),
    ('papeis.gerenciar', 'Gerenciar papéis e permissões'),
    ('auditoria.visualizar', 'Consultar eventos administrativos'),
    ('infraestrutura.visualizar', 'Consultar métricas de infraestrutura');
-- ROLE_ADMIN legado preserva operações, sem obter administração de identidade.
INSERT INTO role_permissoes(role_id, permissao_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissoes p
WHERE r.nome IN ('ROLE_SUPER_ADMIN', 'ROLE_OPERADOR_GERAL', 'ROLE_ADMIN')
  AND p.codigo NOT IN ('usuarios.visualizar', 'usuarios.gerenciar', 'seguranca.revogar',
    'papeis.gerenciar', 'auditoria.visualizar', 'infraestrutura.visualizar');
INSERT INTO role_permissoes(role_id, permissao_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissoes p
WHERE r.nome = 'ROLE_SUPER_ADMIN' AND p.codigo IN ('usuarios.visualizar', 'usuarios.gerenciar',
    'seguranca.revogar', 'papeis.gerenciar', 'auditoria.visualizar', 'infraestrutura.visualizar');
-- Papéis delegados começam com escopos mínimos; SUPER_ADMIN poderá ajustá-los depois.
INSERT INTO role_permissoes(role_id, permissao_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissoes p WHERE
  p.codigo NOT IN ('usuarios.visualizar', 'usuarios.gerenciar', 'seguranca.revogar',
    'papeis.gerenciar', 'auditoria.visualizar', 'infraestrutura.visualizar') AND (
    (r.nome = 'ROLE_CONSULTA' AND p.descricao LIKE 'GET /api/%') OR
    (r.nome = 'ROLE_ESTOQUISTA' AND (p.descricao LIKE '% /api/estoque/%' OR p.descricao LIKE 'GET /api/produtos%')) OR
    (r.nome = 'ROLE_FINANCEIRO' AND p.descricao LIKE 'GET /api/relatorios/%') OR
    (r.nome = 'ROLE_ATENDENTE' AND (p.descricao LIKE '% /api/clientes%' OR p.descricao LIKE '% /api/maquinas%')) OR
    (r.nome = 'ROLE_TECNICO' AND p.descricao LIKE '% /api/ordens-servico%') OR
    (r.nome = 'ROLE_GERENTE' AND p.descricao NOT LIKE '% /api/configuracao-oficina')
  );
