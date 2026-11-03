import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const rows = read('backend/target/audit-routes.tsv').trim().split(/\r?\n/).map(line => line.split('\t'));
const out = path.join(root, 'docs/auditoria-final'); fs.mkdirSync(out, { recursive: true });
const data = {
  Auth: 'credenciais, desafios 2FA, sessoes', Csrf: 'token CSRF (sem JWT)', Health: 'estado de conectividade',
  Cliente: 'dados pessoais e historico', Maquina: 'equipamentos, proprietario, historico', Produto: 'catalogo, custos e compatibilidade',
  OrdemServico: 'cliente, equipamento, itens e valores da OS', Estoque: 'saldos e movimentacoes',
  Categoria: 'categorias', Fornecedor: 'cadastro de fornecedores', Relatorio: 'dados pessoais e financeiros agregados',
  ConfiguracaoOficina: 'identidade comercial e contatos', Notificacao: 'alertas operacionais compartilhados',
  Busca: 'clientes, maquinas, OS e produtos', System: 'ambiente e usuario autenticado',
};
const lines = ['# Matriz de rotas — 30/10/2026', '',
  `Inventario gerado de **${rows.length} combinacoes metodo/rota** registradas pelo Spring MVC, incluindo aliases.`, '',
  'Cada linha da API foi exercitada por `RouteAuthorizationAuditTest`: anonimo 401 e ROLE_USER 403 nas rotas ADMIN; mutacoes com cookie sem CSRF ou com par divergente 403. Os papeis desse teste sao simulados pelo Spring Test; assinatura JWT, tokenVersion e revogacao sao verificados nas suites de autenticacao. Nao equivale a testar todos os bodies de negocio em cada rota.', '',
  'A oficina e compartilhada entre todos os ADMIN. Nao existe isolamento por filial/tenant ou proprietario de conta. Acesso de um ADMIN a outro cliente e comportamento do modelo, nao BOLA. Vinculos cliente/maquina e item/OS sao validados pelos services.', '',
  '**CSRF C**: requerido em mutacoes com access_token ou refresh_token; Bearer sem cookie e dispensado por nao usar credencial ambiente. **CSRF A**: requerido em todas as mutacoes /api/auth, mesmo antes do login. **CSRF L**: leitura dispensada. GET implica HEAD (tambem testado anonimamente nas rotas ADMIN); OPTIONS preflight depende de CORS e nao executa mutacao. Risco indica sensibilidade potencial da rota, nao uma vulnerabilidade confirmada.', '',
  '| Metodo | Rota | Origem | Autenticacao / autorizacao | CSRF | Validacao | Dados | Risco | Evidencia |',
  '|---|---|---|---|---|---|---|---|---|'];
const records = [];
for (const [method, route, handler, auth] of rows) {
  const [controller, fn] = handler.split('#');
  const file = `backend/src/main/java/com/oficinagestao/controller/${controller}.java`;
  const src = read(file);
  const signatureStart = src.search(new RegExp(`public [^;{]*?\\b${fn}\\(`));
  if (signatureStart < 0) throw new Error(`Missing source ${handler}`);
  const signature = src.slice(signatureStart).split(/\)\s*\{/)[0];
  const line = src.slice(0, signatureStart).split('\n').length;
  const body = signature.match(/@RequestBody\s+(?:@Valid\s+)?(\w+)/)?.[1];
  const query = [...signature.matchAll(/@RequestParam(?:\([^)]*\))?\s+(?:\w+\([^)]*\)\s+)?(?:@\w+(?:\([^)]*\))?\s+)*(\w+)\s+(\w+)/g)].map(m => `${m[2]}:${m[1]}`);
  let validations = [];
  if (route.includes('{')) validations.push('IDs Long; conversao 400, inexistente 404');
  if (body) {
    let constraints = [];
    const dto = `backend/src/main/java/com/oficinagestao/dto/${body}.java`;
    if (fs.existsSync(path.join(root, dto))) constraints = [...new Set([...read(dto).matchAll(/@(NotNull|NotBlank|Size|Pattern|Email|Positive|PositiveOrZero|DecimalMin|DecimalMax|Min|Max|Valid)\b/g)].map(m => m[1]))];
    validations.push(`${body}${signature.includes('@Valid') ? ' @Valid' : ''}${constraints.length ? ': ' + constraints.join(', ') : ''}`);
  }
  if (signature.includes('Pageable')) validations.push('Pageable (max size 2000); sort finito, <=3 campos/64 caracteres');
  if (query.length) validations.push(query.join(', '));
  if (controller === 'AuthController') validations.push('regras AuthService, token/challenge/cookies conforme operacao');
  if (!validations.length) validations.push('sem body; service/seguranca central');
  const resource = controller.replace('Controller', '');
  if (!data[resource]) throw new Error(`Unclassified ${resource}`);
  const csrf = method === 'GET' ? 'L' : route.startsWith('/api/auth/') ? 'A' : 'C';
  const risk = ['Auth','Cliente','Maquina','OrdemServico','Estoque','Relatorio','ConfiguracaoOficina','Busca'].includes(resource) ? 'alto' : resource === 'Health' || resource === 'Csrf' ? 'baixo' : 'medio';
  const evidence = ['Auth', 'Csrf'].includes(resource) ? 'RouteAuthorizationAuditTest; CsrfAndCorsSecurityTest; AuthLifecycleAuditIntegrationTest' : 'RouteAuthorizationAuditTest' + (fs.existsSync(path.join(root, `backend/src/test/java/com/oficinagestao/service/${resource}ServiceTest.java`)) ? `; ${resource}ServiceTest` : '');
  records.push({ method, route, file, line, handler, auth, csrf, validation: validations, data: data[resource], risk, evidence });
  lines.push(`| ${method} | \`${route}\` | [${handler}](../../${file}#L${line}) | ${auth === 'PUBLIC' ? 'Publica; credenciais/CSRF quando aplicavel' : 'Autenticada; ROLE_ADMIN'} | ${csrf} | ${validations.join('; ')} | ${data[resource]} | ${risk} | ${evidence} |`);
}
lines.push('', '## Rotas da plataforma backend', '',
  '| Metodo | Rota | Origem / validacao | Autenticacao / autorizacao | CSRF | Dados / risco | Evidencia |',
  '|---|---|---|---|---|---|---|',
  '| GET, HEAD | /actuator/health | Actuator; show-details=never | publica | L | UP/DOWN; baixo | ActuatorSecurityTest |',
  '| GET, HEAD | /actuator/health/{*path}, /actuator | Actuator e links de discovery; somente health exposto | autenticada (anyRequest); sem dados de negocio | L | diagnostico; medio | SecurityConfig; ActuatorSecurityTest (nao todas as subrotas) |',
  '| GET, HEAD | /v3/api-docs, /v3/api-docs.yaml, /v3/api-docs/swagger-config, /swagger-ui.html, /swagger-ui/** | Springdoc; desabilitado por padrao e em prod; se explicitamente habilitado, publico | 401 anonimo quando desabilitado; sem handler documental ativo | L | esquema da API; medio | ProductionOpenApiSecurityTest; OpenApiDocumentationTest |',
  '| Todos (fallback) | /error | BasicErrorController; stacktrace/message nunca em prod | autenticada no acesso direto | conforme matcher | erro generico; medio | GlobalExceptionHandlerTest; SecurityConfig |',
  '| OPTIONS | rotas /api acima | CorsFilter; lista exata de origens/metodos/headers | preflight valido sem sessao | dispensado; nao modifica estado | sem recurso; baixo | CsrfAndCorsSecurityTest |',
  '| Outros metodos/caminhos | /** | firewall + mappings; rotas nao implementadas nao executam negocio | /api exige ADMIN; demais autenticados | conforme matcher | rejeicao; medio | CsrfMvcRoutingTest; RouteAuthorizationAuditTest |',
  '', '## Frontend', '',
  'Todas as paginas entregam shell HTML/React publico; o layout autenticado recupera /api/auth/me antes de mostrar dados. A autorizacao efetiva e no backend. Nao ha Server Actions nem armazenamento de JWT em localStorage/sessionStorage. Middleware e no-op e nao e uma barreira de seguranca.', '',
  '| Metodo | Rota | Arquivo | Autenticacao / autorizacao | CSRF | Validacao / dados | Risco | Evidencia |',
  '|---|---|---|---|---|---|---|---|');
function walk(dir) { return fs.readdirSync(path.join(root, dir), { withFileTypes:true }).flatMap(e => e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]); }
for (const file of walk('frontend/src/app').filter(f => /\/(page\.tsx|route\.tsx|manifest\.ts|favicon\.ico)$/.test(f))) {
  let route = file.replace('frontend/src/app', '').replace('/(authenticated)', '').replace(/\/page\.tsx$/, '').replace(/\/route\.tsx$/, '').replace('/manifest.ts','/manifest.webmanifest').replace(/\[([^\]]+)\]/g, '{$1}') || '/';
  const business = file.includes('(authenticated)');
  lines.push(`| GET, HEAD | \`${route}\` | [${file}](../../${file}) | ${business ? 'shell publico; layout requer sessao ADMIN via API' : 'publica'} | leitura dispensada | ${business ? 'ID convertido no cliente; backend revalida; dados via API' : 'pagina/metadata/imagem; sem dados de clientes'} | ${business ? 'medio' : 'baixo'} | ${business ? 'session-recovery.spec.ts; a01-a06-regression.spec.ts' : route.includes('pwa') || route.includes('manifest') ? 'pwa-install.spec.ts' : 'login.spec.ts; build Next'} |`);
}
for (const file of walk('frontend/public')) lines.push(`| GET, HEAD | /${file.replace('frontend/public/','')} | [${file}](../../${file}) | publica | leitura dispensada | asset local estatico | baixo | build Docker; navegacao Playwright |`);
lines.push('| GET, HEAD | /_next/static/**, /_next/image | Next.js runtime | publica | leitura dispensada | assets/otimizacao; sem remotePatterns de dominios arbitrarios | medio | Next atualizado; build e imagem Trivy |',
  '| Todos os metodos | /api/:path* | next.config.ts; docker-entrypoint.mjs | proxy preserva regras Spring da matriz acima | preservado no proxy | destino fixo validado no build; runtime divergente aborta | alto | integration-real.spec.ts; audit-proxy-transport.mjs |',
  '| GET e navegacao RSC | paginas acima | Next App Router | mesma politica de shell; nenhuma credencial em SSR | leitura dispensada | React Server Components internos | medio | build; Playwright |',
  '| Outros | /** | Next 404/405 | publico, sem operacao de negocio | n/a | erro de pagina/metodo; baixo | build; smoke local |', '',
  'Para regenerar: executar RouteAuthorizationAuditTest com PostgreSQL descartavel e depois `node scripts/audit-route-inventory.mjs`. A prova de cobertura e o TSV produzido em runtime; a descricao de validacao e extraida dos controllers/DTOs e nao substitui revisao das regras de negocio.');
fs.writeFileSync(path.join(out,'matriz-rotas.md'), lines.join('\n')+'\n');
fs.writeFileSync(path.join(out,'rotas-api.json'), JSON.stringify(records,null,2)+'\n');
console.log(`Classified ${records.length} API mappings; frontend and platform routes included.`);
