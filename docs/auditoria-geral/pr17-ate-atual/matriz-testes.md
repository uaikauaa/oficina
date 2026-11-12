# Matriz de testes e evidências

Data 12/11/2026. Execuções desta branch em worktree sem `.env` operacional; PostgreSQL 16 novo `oficina-stage4a1-pg` em loopback, label de posse, TEST_DB_* e 28 migrations sintéticas com hashes conferidos. Não houve conexão ao original. Evidências locais transitórias são logs fora do Git; publicar apenas resultados agregados. Para o estado final de CI, usar os checks do head atual do PR #31.

| Gate | Execução | Resultado | Limite |
|---|---|---|---|
| Maven `clean verify` | 897 `<testcase>` em XML, 0 falhas/erros/skips; JAR gerado | Passou no rerun em banco recriado | Primeira execução teve 3 erros de contexto por fixture `test,prod` incompatível com novo guard; corrigido sem desabilitar teste |
| JWT/2FA/sessões/refresh | Casos Maven e Stage 4A com duas JVMs | Passou sintético | Nenhum usuário real |
| RBAC/OS/estoque/financeiro/Flyway | Maven e `OperationalCriticalFlowsIntegrationTest` | Passou sintético | Sem snapshot real |
| Frontend unitário | `npm test` | Passou, 379 casos | UI real complementada por Playwright |
| TypeScript, ESLint, Next build | `npx tsc --noEmit`, `npm run lint`, `npm run build` | Passaram | Build após correção do foco também passou |
| Playwright mockado | 115 casos, Chromium | **115/115 passou** no rerun final | Primeiro 114/115 mostrou roubo de foco; primeira correção falhou em autofocus; correção final passou caso focado e suíte completa |
| Playwright real | Runner Next→Spring→PostgreSQL→Mailpit, 3 jornadas, sessões/restart/rate/outbox | **3/3 passou**; revogação após JVM, replay, limite distribuído e outbox única passaram | Runner habilitou recuperação só em dev sintético |
| Cinco viewports | 320/390/768/1366/1920 no Playwright mockado | **Passou** no rerun final | Sem dispositivo real |
| npm audit produção | `npm audit --omit=dev --audit-level=high` | 0 vulnerabilidades | Audit completo: 7 moderadas dev, 0 altas/críticas |
| Segredos/dependências CI | Gitleaks histórico, Trivy secrets/SBOM | 4/4 no SHA funcional `578af98`; [head vivo do PR #31](https://github.com/uaikauaa/oficina/pull/31/checks) | Verde não prova rotação de segredo eventualmente divulgado |
| Configuração privada | Presença/booleans offline | Executado Stage 4A | Override efetivo da JVM antiga não comprovado |
| HTTP temporal recuperação | Serviço Stage 4A 120 pares; HTTP real | Não executado nesta branch | Habilitação pública bloqueada em prod até mitigação validada |

As divergências 857/889 no PR #29 decorreram da soma de `.txt` que omitiu 28+4 casos de classes aninhadas; XMLs indicam 889. Stage 4A somou 893; esta branch adiciona 4 casos, total **897**, sem remover testes. [junit-current.json](junit-current.json) guarda totais, 102 suites e hashes XML, sem propriedades sensíveis. A primeira falha de Maven e as duas execuções Playwright com falha são mantidas como evidência de processo, não apagadas pelo rerun.

No primeiro attempt de [Validação Complementar 43295378248](https://github.com/uaikauaa/oficina/actions/runs/43295378248), `dependency:go-offline` parou antes do build por HTTP 502 do Maven Central para `flexmark-ext-toc:0.42.14`. O rerun **no mesmo SHA `578af98`** passou: imagem reproduzível, Trivy/SBOM/segredos, Flyway e E2E. Os outros três workflows desse SHA também passaram: [CI Pipeline](https://github.com/uaikauaa/oficina/actions/runs/43295378357), [Integração Real](https://github.com/uaikauaa/oficina/actions/runs/43295378404) e [Oracle Readiness](https://github.com/uaikauaa/oficina/actions/runs/43295378286). Falha intermediária classificada como indisponibilidade transitória do repositório de dependências; não houve alteração de código para mascará-la. Para o commit documental posterior, verificar novamente os quatro checks no head vivo do PR.
