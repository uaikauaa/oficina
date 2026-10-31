# Integração dos PRs #9, #10 e #11 — Oficina Gestão

**Estado em 31/10/2026:** integração de código preparada em `integrate/cloud-run-security-20261031`; **merge na `main` BLOQUEADO** até concluir a classificação dos diagnósticos do VS Code e revisar formalmente os 13 alertas Java residuais. **Cloud Run para homologação BLOQUEADO** até checar a configuração real de IAM, Neon, TLS/SMTP, limites de abuso e custos. **Produção NO-GO.** Nenhum deploy foi realizado.

## A. Git e branches

| Referência | Estado verificado | Incorporação na branch de integração |
|---|---|---|
| `main` | `a52457e219cfe049775987b04dd64dc90f250d4`; PR [#9](https://github.com/uaikauaa/oficina/pull/9) integrado | Base da worktree isolada. |
| PR [#10](https://github.com/uaikauaa/oficina/pull/10) | Aberto, draft; head `a788f6372dfa1b8e0dceeaaa3212e5e5f0ab82de` | Merge local `cf14698`, preservando os três commits de preparação Cloud Run. |
| PR [#11](https://github.com/uaikauaa/oficina/pull/11) | Aberto, draft, empilhado sobre #10; head `5c1a7628c0bd48ec6e3e95fecbd49268ad0b1c20` | Merge local `ee86716`, preservando os dois commits de auditoria. |

O diretório original estava em `refactor/identidade-visual-oficina`, atrasado em relação ao remoto, com imagens e capturas não rastreadas. Ele foi preservado. O PR #9 já estava na `main`; nenhum commit visual foi reaplicado. Não houve conflito no #10. O #11 conflitou apenas em `frontend/playwright.config.ts`: mantive `PLAYWRIGHT_PORT` e sua validação, acrescentei `E2E_BASE_URL` local e `E2E_EXTERNAL_SERVER` para integração real. O merge automático de `.github/workflows/validation.yml` foi revisado; preserva o teste TypeScript E2E do PR #9 e o gatilho dos PRs empilhados/pinning de Actions do #11. Os sete ajustes `TS2339` em `forms-b02-b07.spec.ts` continuam presentes; ambos os compiladores TypeScript passam.

Os jobs do commit `be12cc0` não foram confundidos com sucesso: [CI #96](https://github.com/uaikauaa/oficina/actions/runs/41151019139) e [integração real #19](https://github.com/uaikauaa/oficina/actions/runs/41151019176) terminaram `cancelled` durante execução. Logs mostram “The operation was canceled”, sem falha de assert anterior; o backend já havia registrado 800 testes aprovados, mas o job ainda não concluíra. A política `cancel-in-progress` por PR/branch e a chegada do commit seguinte explicam a interrupção. No head `5c1a762`, [CI #97](https://github.com/uaikauaa/oficina/actions/runs/41151073384), [integração real #20](https://github.com/uaikauaa/oficina/actions/runs/41151073347), [Flyway/E2E #27](https://github.com/uaikauaa/oficina/actions/runs/41151073354) e [Oracle readiness #13](https://github.com/uaikauaa/oficina/actions/runs/41151073355) terminaram `success`. Esses resultados históricos não substituem checks no novo commit integrado.

## B. VS Code

O relato de aproximadamente 540 itens não veio acompanhado de exportação individual dos diagnósticos. [Investigação do editor](vscode.md): Maven/Java 21 compila e testa; logs do JDT LS mostram conflito de bundles, reinicializações e erro interno, mas **não identificam arquivo/linha/código dos 540 itens**. Não é correto converter 142 eventos de log em 142 diagnósticos, nem declarar que os 540 desapareceram. A classificação individual e a nova captura do painel continuam obrigatórias antes do merge.

## C. Segurança

As correções do PR #11 de logout/refresh concorrentes, revogação 2FA, limite de e-mails, SMTP obrigatório em produção, headers, ordenação e PDFs continuam na integração. Suite backend de 800 testes inclui regressões e concorrência. O inventário foi regenerado do runtime: **83 pares método/rota**, com 401/403/CSRF e métodos alternativos, em [matriz](../auditoria-final/matriz-rotas.md). O fluxo real também cobriu CSRF, texto HTML armazenado, campos extras, vínculo de OS/item, preço calculado pelo servidor e três PDFs. Esses testes são limitados e não certificam ausência universal de IDOR, SQLi ou XSS.

Trivy na imagem backend final continua apontando [13 CVEs, com triagem individual](cves.md); não houve supressão global. Gitleaks em snapshot de 592 arquivos rastreados encontrou cinco ocorrências, todas em fixtures sintéticas de testes, sem credencial real confirmada. `npm audit` completo passou a apontar 16 avisos moderados na cadeia ESLint/minimatch de desenvolvimento; **zero alto/crítico**, `npm audit --omit=dev` zero e imagem frontend zero. Revisar o risco de dependências antes de aprovar o merge e acompanhar novas versões.

## D. Frontend

A identidade industrial do PR #9 foi preservada: `frontend/src` difere da `main` só nos dois arquivos novos de validação de URL do backend; nenhum componente, estilo, fotografia ou ícone visual foi substituído. O Playwright percorreu a matriz de telas em 320, 360, 390, 768, 1024, 1366, 1920 e 2560 px, incluindo 360×520 e modais 320×568. Verificou overflow global, nomes acessíveis, navegação móvel, PWA, impressão A4, formulários, login/2FA, loading, erro/vazio e toasts em clientes, OS e relatórios. O teste de toast verifica opacidade, fechamento e duração; inspeção visual da [captura 390 px](visual/toast-relatorios-390.png) confirma texto legível e ausência de conteúdo visível atrás. [Login](visual/login-390.png), [dashboard móvel](visual/dashboard-390.png), [dashboard desktop](visual/dashboard-1366.png), [OS](visual/ordem-390.png) e [relatórios](visual/relatorios-390.png) foram recapturados na integração. As capturas históricas do PR #9 foram restauradas após o teste.

Um teste de login da suite completa falhou porque sua chamada CSRF dependia de backend ausente no cenário de UI mockada; então não enviava login. O teste agora fornece respostas sintéticas para CSRF/login e exige método POST, header CSRF e mesma origem. O teste afetado e a suite completa passaram; a suite real com Spring valida o fluxo não mockado. Um teste opcional que requer credenciais administrativas externas ficou ignorado; não foi enfraquecido para ficar verde.

## E. Backend e dados

`clean verify` no commit consolidado passou **800 testes** em Java 21, inclusive locks de refresh/logout, 2FA, estoque e OS. PostgreSQL 16 descartável aplicou as **22 migrations reais** na integração; backup `pg_dump -Fc` e restore `pg_restore --exit-on-error` produziram contagens iguais `22|1|1|1|2` (migrations, usuários, clientes, produtos, OS) no ponto do backup. Estoque insuficiente, associação incorreta de item a outra OS, preço calculado e rollback foram exercitados pelo fluxo real/testes backend. Requisições duplicadas distintas ainda não possuem chave geral de idempotência (risco R04 da auditoria anterior). Nenhum banco real foi usado.

## F. Cloud Run e custos

As duas imagens do código integrado foram geradas. Frontend standalone respondeu 200 na porta dinâmica **8081**, proxy entregou 401 para API anônima, e backend respondeu 200 em `PORT=8081` com limite de **1 GiB/1 CPU** (uso observado ~401 MiB em repouso). Ambos executam sem root. SIGTERM do backend encerrou Tomcat/JPA/Hikari de forma ordenada em ~335 ms no ensaio local. URL do backend é compilada no rewrite; runtime divergente é recusado pelo entrypoint. Esses resultados não medem latência ou consumo em Cloud Run e Neon reais.

Backend exposto diretamente exige Spring Security, mas não elimina abuso distribuído. IAM privado entre serviços exigiria token de identidade Google no proxy Next sem quebrar cookies/JWT da aplicação; não foi implementado sem homologação da configuração real. O [checklist anterior](../auditoria-final/checklist-implantacao.md) cobre Secret Manager, contas de serviço, TLS `verify-full`, SMTP com validação de identidade, reconexão Neon, backup, limites de instância, logs, orçamento e alertas. Valores de custo não foram verificados; orçamento não é um limite absoluto de cobrança. Não foi consultado GCP, Neon ou SMTP de produção.

## G. Testes no código integrado

| Verificação | Executados | Aprovados | Falhas | Ignorados | Estado |
|---|---:|---:|---:|---:|---|
| Backend Maven `clean verify` | 800 | 800 | 0 | 0 | Aprovado, 1m20s |
| Frontend `npm test` | 364 | 364 | 0 | 0 | Aprovado, ~0,9 s |
| ESLint + `tsc` app/E2E + build Next | 4 comandos | 4 | 0 | 0 | Aprovado; build com URL local obrigatória |
| Playwright UI/visual completo | 117 | 116 | 0 | 1 | Aprovado, ~1m18s; skip de credenciais externas |
| Integração real com imagens finais | 1 | 1 | 0 | 0 | Aprovado, 2,8 s |
| Autorizações/rotas | 83 pares | 83 inventariados e exercitados nas classes aplicáveis | 0 | 0 | Aprovado; contido nos 800 |
| Docker build/runtime | 2 imagens | 2 | 0 | 0 | Aprovado localmente |
| npm runtime / Trivy frontend | 2 varreduras | 2 sem alertas | 0 | 0 | Aprovado |
| Trivy backend | 13 achados | 13 triados | 0 | 0 | Pendente de aceite/upgrade |
| Gitleaks fonte | 5 sinais | 5 fixtures triadas | 0 credencial real confirmada | 0 | Triado |
| Workflows no SHA final da integração | 4 | A conferir no PR de integração | — | — | Pendente no momento deste relatório |

Evidências locais: `audit-final-backend.log`, `audit-final-unit.log`, `audit-final-lint.log`, `audit-final-tsc.log`, `audit-final-e2e-tsc.log`, `audit-final-frontend-build.log`, `audit-final-playwright.log`, `audit-final-real-integration.log`, dois logs de Docker e JSONs dos scanners. Logs, dumps, traces e dados sintéticos não foram adicionados ao Git. O Docker e os testes locais não equivalem a homologação na nuvem.

## H. Vereditos

- **INTEGRAÇÃO NA MAIN: BLOQUEADA.** Código consolidado e testado localmente, mas faltam classificação individual dos diagnósticos do VS Code, decisão técnica dos CVEs residuais e quatro checks no SHA exato da branch de integração. O PR de integração deve permanecer aberto.
- **PRONTIDÃO PARA HOMOLOGAÇÃO CLOUD RUN: BLOQUEADA.** Falta verificar IAM/proxy, Neon TLS/certificado e suspensão, SMTP real, proteção distribuída e custos/cotas no projeto autorizado.
- **PRODUÇÃO: NO-GO.** O relatório anterior mantém esses controles como pendências; nenhum resultado local autoriza tráfego de produção.

Se os bloqueios forem resolvidos, conferir novamente o HEAD da `main`, o diff e os checks do SHA final antes de qualquer merge. Após merge autorizado pelos critérios da missão, repetir checks no commit resultante. Nenhum merge é autorizado por este documento sozinho.
