import fs from 'node:fs';
import path from 'node:path';

// Transcribed from docs/auditoria/prints/04–06. ProdutoControllerTest appears
// in two screenshots and is counted once. These are counts, not diagnostics.
const groups = {
  '04 — produção': `BoundedSortConfiguration=4 ProductionSecurityValidator=3 GlobalExceptionHandler=3 JwtAuthenticationFilter=3 JwtService=1 SecurityConfig=2 AuthService=3 CategoriaService=3 ClienteService=4 EmailServiceImpl=1 FornecedorService=5 MaquinaService=3 NotificacaoService=1 OrdemServicoItemService=3 OrdemServicoService=3 ProdutoService=12`,
  '04 — testes': `AdminAccountBootstrapTest=22 ProductionSecurityValidatorTest=15 AuthControllerTest=24 ClienteControllerTest=32 ConfiguracaoOficinaControllerTest=6 ConfiguracaoOficinaHttpIsolationTest=9 HealthControllerUnitTest=6 NotificacaoControllerTest=1 OrdemServicoControllerTest=24 ProdutoControllerTest=8`,
  '05 — testes': `GlobalExceptionHandlerTest=4 AuthLifecycleAuditIntegrationTest=2 CsrfAndCorsSecurityTest=7 CsrfIsolationTest=8 CsrfMvcRoutingTest=8 ForwardedHeadersSpringIntegrationTest=4 RefreshReusePersistenceTest=7 RefreshTokenHashSecurityTest=4 RouteAuthorizationAuditTest=18 SensitiveOutputAuditTest=1 TokenVersionSecurityTest=4 AuditoriaIpSecurityTest=1 AuthServiceTest=34 CategoriaServiceTest=5 ClienteServiceTest=4 ConfiguracaoOficinaServiceIntegrityTest=22 EstoqueServiceTest=7 FinanceRegressionIntegrationTest=6 FormClearIntegrationTest=1 FornecedorServiceTest=4 HistoricoBuscaTest=6 IntegracaoEstoqueOSTest=5 MaquinaServiceTest=1 NotificacaoServiceTest=4 OrdemServicoConcurrencyIntegrationTest=19`,
  '06 — testes': `OrdemServicoItemServiceTest=8 OrdemServicoServiceTest=19 PdfConfiguracaoOficinaIsolationTest=5 ProdutoEstoqueConcurrencyIntegrationTest=2 ProdutoServiceTest=11 RefreshTokenConcurrencyIntegrationTest=3 RelatorioServiceTest=14 ReleaseSmokeTest=5 TwoFactorConcurrencyIntegrationTest=6 SyntheticMigrations=4 TestDatabaseSafetyAutoConfiguration=14 TestDatabaseSafetyAutoConfigurationTest=38 TestDatabaseSafetyGuard=1 TestDatabaseSafetyGuardTest=18`,
};

const root = 'backend/src';
const files = fs.readdirSync(root, { recursive: true })
  .filter(name => name.endsWith('.java'))
  .map(name => path.join(root, name).replaceAll('\\', '/'));
const reports = fs.readdirSync('backend/target/surefire-reports');
const rows = [];
for (const [group, entries] of Object.entries(groups)) {
  for (const entry of entries.split(' ')) {
    const [name, count] = entry.split('=');
    const matches = files.filter(file => file.endsWith(`/${name}.java`));
    if (matches.length !== 1) throw new Error(`Arquivo não único: ${name} (${matches.length})`);
    const file = matches[0];
    const isTest = file.includes('/test/java/');
    const classFile = file.replace('/src/main/java/', '/target/classes/')
      .replace('/src/test/java/', '/target/test-classes/').replace(/\.java$/, '.class');
    const suite = reports.some(report => report.startsWith('TEST-') && report.endsWith(`${name}.xml`));
    rows.push({ group, name, count: Number(count), file, compiled: fs.existsSync(classFile), suite, isTest });
  }
}

const total = rows.reduce((count, row) => count + row.count, 0);
const unallocated = 540 - total;
if (unallocated < 0) throw new Error('A transcrição ultrapassa o total mostrado no painel');
const lines = [
  '# Inventário das contagens visíveis no VS Code',
  '',
  `Transcrição manual das capturas [04–06](../auditoria/prints/README.md) de 31/10/2026. O painel mostra **540** itens; as linhas legíveis abaixo atribuem **${total}** ocorrências a **${rows.length}** arquivos distintos. A linha de ProdutoControllerTest aparece em duas imagens e foi contada uma vez. A diferença de ${unallocated} itens não é atribuível com segurança a um arquivo a partir dos recortes. A transcrição não contém mensagens, severidade ou código dos diagnósticos.`,
  '',
  `No build Maven de 03/11/2026, os ${rows.length} arquivos da lista foram localizados. “Compilou” indica arquivo .class no output atual; “suite executada” indica relatório Surefire para a classe. Os demais são auxiliares de teste ou classes de produção. Isso comprova compilação, não a correção de cada aviso do JDT LS.`,
  '',
  '| Captura | Arquivo | Contagem exibida | Compilou | Suite executada |',
  '|---|---|---:|---|---|',
  ...rows.map(row => `| ${row.group} | [${row.name}.java](../../${row.file}#L1) | ${row.count} | ${row.compiled ? 'sim' : 'NÃO'} | ${row.isTest ? (row.suite ? 'sim' : 'auxiliar') : 'não se aplica'} |`),
  '',
  `Resumo: produção ${rows.filter(row => !row.isTest).reduce((n, row) => n + row.count, 0)} itens visíveis; testes ${rows.filter(row => row.isTest).reduce((n, row) => n + row.count, 0)}. Arquivos ausentes: 0; classes não compiladas: ${rows.filter(row => !row.compiled).length}.`,
];
fs.writeFileSync('docs/integracao-final/inventario-vscode.md', `${lines.join('\n')}\n`);
console.log(JSON.stringify({ files: rows.length, visible: total, unallocated,
  notCompiled: rows.filter(row => !row.compiled).map(row => row.name),
  withoutSuite: rows.filter(row => row.isTest && !row.suite).map(row => row.name) }, null, 2));
