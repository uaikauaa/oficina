import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// One-time V25 generator. Do not regenerate an applied migration after release.
const root = resolve(import.meta.dirname, '..');
const matrix = readFileSync(resolve(root, 'docs/neon-admin-readiness/permission-matrix.md'), 'utf8');
const rows = [...matrix.matchAll(/^\|[^\n]*\| (GET|POST|PUT|PATCH|DELETE) \| (\/api\/[^| ]+) \| ([A-Z0-9_]+) \|/gm)]
  .map(([, method, path, key]) => ({ method, path, code: key.toLowerCase().replaceAll('_', '.') }));
if (rows.length !== 83 || new Set(rows.map(r => `${r.method} ${r.path}`)).size !== 83) {
  throw new Error('A matriz precisa conter exatamente 83 rotas únicas.');
}
const publicPaths = new Set([
  'POST /api/auth/2fa/resend', 'POST /api/auth/2fa/verify',
  'POST /api/auth/login', 'POST /api/auth/logout', 'POST /api/auth/refresh',
  'GET /api/auth/csrf', 'GET /api/health'
]);
const selfPaths = new Set(['PUT /api/auth/alterar-senha', 'GET /api/auth/me']);
const operational = rows.filter(r => !publicPaths.has(`${r.method} ${r.path}`) && !selfPaths.has(`${r.method} ${r.path}`));
// Literal segments must precede {id} segments, otherwise a collection alias may
// accidentally inherit the permission for a detail route.
const specificity = path => path.split('/').map(segment => segment.startsWith('{') ? 0 : 1);
operational.sort((a, b) => {
  const left = specificity(a.path);
  const right = specificity(b.path);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    if ((left[i] ?? -1) !== (right[i] ?? -1)) return (right[i] ?? -1) - (left[i] ?? -1);
  }
  return b.path.length - a.path.length || a.method.localeCompare(b.method);
});
const sqlString = value => `'${value.replaceAll("'", "''")}'`;
const values = operational.map(r => `    (${sqlString(r.code)}, ${sqlString(`${r.method} ${r.path}`)})`).join(',\n');
const adminValues = [
  ['usuarios.visualizar', 'Listar usuários administrativos'],
  ['usuarios.gerenciar', 'Alterar estado e papéis de usuários'],
  ['seguranca.revogar', 'Revogar sessões de terceiros'],
  ['papeis.gerenciar', 'Gerenciar papéis e permissões'],
  ['auditoria.visualizar', 'Consultar eventos administrativos'],
  ['infraestrutura.visualizar', 'Consultar métricas de infraestrutura']
].map(([code, description]) => `    (${sqlString(code)}, ${sqlString(description)})`).join(',\n');
const sql = `-- V25: catálogo RBAC e trilha administrativa. Não altera usuários, hashes ou papéis atuais.\n` +
`CREATE TABLE permissoes (\n    id BIGSERIAL PRIMARY KEY,\n    codigo VARCHAR(120) NOT NULL UNIQUE,\n    descricao VARCHAR(255) NOT NULL,\n    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP\n);\n` +
`CREATE TABLE role_permissoes (\n    role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,\n    permissao_id BIGINT NOT NULL REFERENCES permissoes(id) ON DELETE CASCADE,\n    PRIMARY KEY (role_id, permissao_id)\n);\n` +
`CREATE INDEX idx_role_permissoes_permissao ON role_permissoes(permissao_id);\n` +
`CREATE TABLE convites_usuarios (\n    id BIGSERIAL PRIMARY KEY,\n    email VARCHAR(150) NOT NULL,\n    token_hash CHAR(64) NOT NULL UNIQUE,\n    role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,\n    criado_por BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,\n    expira_em TIMESTAMPTZ NOT NULL,\n    usado_em TIMESTAMPTZ,\n    revogado_em TIMESTAMPTZ,\n    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    CONSTRAINT chk_convite_expiracao CHECK (expira_em > created_at)\n);\n` +
`CREATE INDEX idx_convites_usuarios_email ON convites_usuarios(lower(email));\n` +
`CREATE UNIQUE INDEX uq_convites_usuarios_pendente ON convites_usuarios(lower(email))\n` +
`WHERE usado_em IS NULL AND revogado_em IS NULL;\n` +
`CREATE TABLE eventos_administrativos (\n    id BIGSERIAL PRIMARY KEY,\n    ator_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,\n    alvo_usuario_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,\n    acao VARCHAR(80) NOT NULL,\n    motivo VARCHAR(500),\n    detalhes TEXT,\n    ocorrido_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP\n);\n` +
`CREATE INDEX idx_eventos_administrativos_ocorrido_em ON eventos_administrativos(ocorrido_em DESC);\n` +
`INSERT INTO roles(nome, descricao) VALUES\n` +
`    ('ROLE_SUPER_ADMIN', 'Administrador principal'),\n    ('ROLE_OPERADOR_GERAL', 'Operações e financeiro da oficina'),\n` +
`    ('ROLE_GERENTE', 'Gestão operacional delegada'),\n    ('ROLE_ATENDENTE', 'Atendimento delegado'),\n` +
`    ('ROLE_TECNICO', 'Serviços técnicos delegados'),\n    ('ROLE_ESTOQUISTA', 'Estoque delegado'),\n` +
`    ('ROLE_FINANCEIRO', 'Financeiro delegado'),\n    ('ROLE_CONSULTA', 'Consulta operacional')\n` +
`ON CONFLICT (nome) DO NOTHING;\n` +
`INSERT INTO permissoes(codigo, descricao) VALUES\n${values},\n${adminValues};\n` +
`-- ROLE_ADMIN legado preserva operações, sem obter administração de identidade.\n` +
`INSERT INTO role_permissoes(role_id, permissao_id)\nSELECT r.id, p.id FROM roles r CROSS JOIN permissoes p\n` +
`WHERE r.nome IN ('ROLE_SUPER_ADMIN', 'ROLE_OPERADOR_GERAL', 'ROLE_ADMIN')\n` +
`  AND p.codigo NOT IN ('usuarios.visualizar', 'usuarios.gerenciar', 'seguranca.revogar',\n` +
`    'papeis.gerenciar', 'auditoria.visualizar', 'infraestrutura.visualizar');\n` +
`INSERT INTO role_permissoes(role_id, permissao_id)\nSELECT r.id, p.id FROM roles r CROSS JOIN permissoes p\n` +
`WHERE r.nome = 'ROLE_SUPER_ADMIN' AND p.codigo IN ('usuarios.visualizar', 'usuarios.gerenciar',\n` +
`    'seguranca.revogar', 'papeis.gerenciar', 'auditoria.visualizar', 'infraestrutura.visualizar');\n` +
`-- Papéis delegados começam com escopos mínimos; SUPER_ADMIN poderá ajustá-los depois.\n` +
`INSERT INTO role_permissoes(role_id, permissao_id)\nSELECT r.id, p.id FROM roles r CROSS JOIN permissoes p WHERE\n` +
`  p.codigo NOT IN ('usuarios.visualizar', 'usuarios.gerenciar', 'seguranca.revogar',\n` +
`    'papeis.gerenciar', 'auditoria.visualizar', 'infraestrutura.visualizar') AND (\n` +
`    (r.nome = 'ROLE_CONSULTA' AND p.descricao LIKE 'GET /api/%') OR\n` +
`    (r.nome = 'ROLE_ESTOQUISTA' AND (p.descricao LIKE '% /api/estoque/%' OR p.descricao LIKE 'GET /api/produtos%')) OR\n` +
`    (r.nome = 'ROLE_FINANCEIRO' AND p.descricao LIKE 'GET /api/relatorios/%') OR\n` +
`    (r.nome = 'ROLE_ATENDENTE' AND (p.descricao LIKE '% /api/clientes%' OR p.descricao LIKE '% /api/maquinas%')) OR\n` +
`    (r.nome = 'ROLE_TECNICO' AND p.descricao LIKE '% /api/ordens-servico%') OR\n` +
`    (r.nome = 'ROLE_GERENTE' AND p.descricao NOT LIKE '% /api/configuracao-oficina')\n  );\n`;
writeFileSync(resolve(root, 'backend/src/main/resources/db/migration/V25__admin_rbac.sql'), sql);
writeFileSync(resolve(root, 'backend/src/test/resources/db/synthetic-migration/V25__admin_rbac.sql'), sql);
const javaRows = operational.map(r => `        new Rule(HttpMethod.${r.method}, ${JSON.stringify(r.path)}, ${JSON.stringify(r.code)})`).join(',\n');
const java = `package com.oficinagestao.security;\n\nimport org.springframework.http.HttpMethod;\nimport java.util.List;\n\n/** Reviewed against docs/neon-admin-readiness/permission-matrix.md (83 routes). */\npublic final class OperationalPermissionCatalog {\n    private OperationalPermissionCatalog() {}\n    public record Rule(HttpMethod method, String path, String permission) {}\n    public static final List<Rule> RULES = List.of(\n${javaRows}\n    );\n}\n`;
writeFileSync(resolve(root, 'backend/src/main/java/com/oficinagestao/security/OperationalPermissionCatalog.java'), java);
console.log(`Generated ${operational.length} operational permission rules from ${rows.length} routes.`);
