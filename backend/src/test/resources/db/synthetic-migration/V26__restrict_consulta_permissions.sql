-- Restrict the broad GET grants from V25 without changing other roles or user history.
-- Product responses include costs/margins; summaries, search, OS, stock and reports
-- can expose financial or cross-domain data, so they require a different role.
DELETE FROM role_permissoes rp
USING roles r, permissoes p
WHERE rp.role_id = r.id
  AND rp.permissao_id = p.id
  AND r.nome = 'ROLE_CONSULTA'
  AND p.codigo NOT IN (
    'categorias.get',
    'categorias.id.get',
    'categorias.ativas.get',
    'clientes.get',
    'clientes.id.get',
    'maquinas.get',
    'maquinas.id.get',
    'fornecedores.get',
    'fornecedores.id.get'
  );
