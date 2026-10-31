# Testes, comandos e limites das evidências

Execução local em worktree separado, com contas sintéticas e containers identificados por `oficina.audit=20261030`. Nenhum teste atingiu produção ou Neon. Logs integrais e traces ficam locais, ignorados pelo Git; hashes em [evidencias.json](evidencias.json). Não publicar traces de autenticação.

| Verificação | Resultado final | Evidência local |
|---|---|---|
| Backend antes das correções | APROVADO: 787 testes | audit-backend-baseline.log |
| Regressões novas contra a base | REPROVADO esperado: cinco cenários reproduzidos | audit-auth-before.log |
| Backend após correções, clean verify | APROVADO: 800, zero falhas/erros/ignorados | audit-backend-final.log |
| Frontend unitário | APROVADO: 362 testes, 133 suites | audit-frontend-unit.log |
| ESLint e build Next/TypeScript | APROVADO | audit-frontend-lint.log, audit-frontend-build.log |
| Interface Chromium | APROVADO: 63; um ignorado por depender de credenciais externas | audit-playwright.log |
| Integração real com dados sintéticos | APROVADO: um fluxo completo | audit-real-integration.log, audit-real-final-image.log |
| Matriz runtime da API | APROVADO: 83 pares método/rota | backend/target/audit-routes.tsv e matriz publicada |
| Transporte do proxy | APROVADO: cinco métodos e 401/403/404/429/500, headers, cookies, PDF | audit-proxy-transport.log |
| Destino runtime divergente | APROVADO: inicialização recusada, exit 1 esperado | audit-proxy-mismatch.log |
| Build das duas imagens | APROVADO | audit-docker-backend.log, audit-docker-frontend.log |
| PORT=8081, non-root, limites locais | APROVADO: health 200 nos dois; backend 1 GiB/1 CPU, frontend 512 MiB/1 CPU | ensaio Docker local; cloud-run.md |
| SIGTERM/graceful shutdown | APROVADO: backend 431 ms, frontend 334 ms; exit 143 | audit-sigterm-backend.log, audit-sigterm-frontend.log |
| Reconexão PostgreSQL após restart | APROVADO: health retornou 200 | ensaio local; não simula toda a suspensão Neon |
| Backup/restore descartável | APROVADO: 22 migrations e contagens 1/1/1/4 iguais no ponto do backup | audit-backup-source.log, audit-backup-restore.log |
| npm audit | APROVADO: quatro pacotes sinalizados antes, zero depois | audit-npm-baseline.log, audit-npm-after.log |
| Trivy imagem frontend | APROVADO: 21 registros antes, zero depois | audit-image-frontend-final-scan.log |
| Trivy imagem backend | PENDENTE de aceite/upgrade: 13 registros triados | audit-image-backend-final-scan.log; vulnerabilidades.md |
| Trivy Dockerfile | APROVADO: zero falhas nos três arquivos analisados | audit-dockerfile-scan.log |
| Gitleaks fonte e histórico | TRIADO: cinco/seis ocorrências, todas fixtures/exemplo incompleto; nenhuma credencial real confirmada | audit-gitleaks-source-results.log, audit-gitleaks-history-results.log |
| Cloud Run, IAM, WIF/OIDC, Secret Manager, domínio HTTPS real | NÃO EXECUTADO | Sem acesso/configuração efetiva auditada |
| Neon TLS/certificado, suspensão e restore real; SMTP real | NÃO EXECUTADO | Somente substitutos locais |
| Carga distribuída, custos reais, múltiplas abas reais | NÃO EXECUTADO | Não extrapolar testes de concorrência backend |

## Reprodução

Executar somente contra PostgreSQL e SMTP descartáveis. No backend, configurar `TEST_DB_URL`, `TEST_DB_USERNAME` e `TEST_DB_PASSWORD` para o banco sintético, conforme `src/test/resources/application-test.properties`, e tamb?m `TEST_DB_EXPECTED_PORT=5432` (porta do banco descart?vel desta execu??o) e `TEST_FLYWAY_LOCATION=filesystem:<caminho-absoluto>/backend/src/test/resources/db/synthetic-migration`; executar `./mvnw.cmd clean verify`. O ambiente dos testes não é o mesmo banco da integração com as 22 migrations reais.

No frontend: `npm ci`, `npm run lint`, `npm test`, `npm run build`. Para UI contra imagem local: definir `E2E_BASE_URL=http://localhost:13001`, `E2E_EXTERNAL_SERVER=true`, executar `npx playwright test --grep-invert @integration-real --output=test-results/ui-audit`. O teste opcional com credenciais externas permanece ignorado quando elas não são fornecidas.

Para integração, iniciar Mailpit em localhost:8025, PostgreSQL e as imagens da aplicação em rede isolada. Usar exclusivamente o administrador sintético `ci.integration@oficina.invalid`, com senha sintética fornecida por variável, backend dev e cookies locais sem Secure. Definir `RUN_REAL_INTEGRATION=true`, `CI_INTEGRATION_ADMIN_EMAIL`, `CI_INTEGRATION_ADMIN_PASSWORD`, além das duas variáveis E2E acima. Executar `npx playwright test e2e/integration-real.spec.ts --output=test-results/real-audit`. Aguardar o cooldown de 30 segundos entre logins; a janela de dez envios/hora também se aplica. O workflow `integration-real.yml` fornece a receita reproduzível de criação do ambiente do zero.

O fluxo verifica 2FA entregue por SMTP, HttpOnly/SameSite, ausência/erro de CSRF, criação de cliente/máquina/produto, movimentação de estoque, OS, preço calculado pelo servidor, vínculo OS/item, três PDFs e logout. Texto HTML armazenado deve aparecer escapado e não executar. Os testes de autorização usam usuários simulados do Spring Security; suites JWT/refresh e o fluxo real cobrem a emissão de credenciais separadamente.

`node scripts/audit-route-inventory.mjs` regenera a matriz a partir do TSV emitido pelo teste de rotas. `node scripts/audit-proxy-transport.mjs` exige a fixture local descrita em `scripts/audit-proxy-fixture.mjs`, com Next em localhost:13002. A fixture prova transporte, não autorização do backend.

Scans usados: `npm audit --json`; Trivy `image --format json` nas duas imagens finais e `config` nos Dockerfiles; Gitleaks em snapshot dos arquivos fonte e clone local do histórico, com saída redigida. Um primeiro scan da árvore inteira incluiu caches/dependências e foi descartado como evidência da fonte; um scan Maven sem reconhecimento do JAR também não foi tratado como aprovação. O inventário publica somente metadados dos achados.

## Falhas intermediárias resolvidas

Além das cinco falhas de segurança reproduzidas na base, houve ajustes de mocks para os novos locks, expectativa de SameSite do access cookie (Lax; refresh é Strict), origem fixa no teste de logout e conflito de diretórios de artefatos Playwright. Reexecuções no mesmo banco atingiram corretamente cooldown e unicidade de telefone/nome; fixtures agora geram dados únicos. A primeira tentativa de restore usava nome de tabela incorreto e foi repetida com verificação de exit code e contagens não vazias. Nenhuma dessas tentativas é apresentada como aprovação. O veredito usa as execuções finais identificadas acima.

Não houve ensaio destrutivo de exaustão, varredura externa, envio a clientes reais ou aprovação automática de risco residual. Resultado global: código validado localmente, **NO-GO para produção** até cumprir o checklist.
