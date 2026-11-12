# Infraestrutura, configuração privada e branches paralelas

## Estado local examinado sem conectar serviços

O container preexistente `oficina-gestao-backend-1` está `running`, criado em 07/10/2026, imagem `sha256:5757cb03…`. `docker inspect` foi usado apenas para nomes/presença e predicados booleanos: declara `DB_URL` com hostname Neon, **sem `sslmode=verify-full`**, profile de produção, `INITIAL_ADMIN_EMAIL/PASSWORD` presentes; faltam `RATE_LIMIT_SECRET`, `SERVICE_PROXY_SECRET`, `INVITE_OUTBOX_KEYS`, `APP_PUBLIC_URL`. A imagem é anterior à cadeia RBAC. As labels Compose indicam configuração local, mas não provam o valor efetivo lido pela JVM; `JAVA_TOOL_OPTIONS`/arquivos e caches podem alterar propriedades. Não se leu `/proc`, não se fez `docker exec`, não se reiniciou/parou o container nem se acessou Neon. Frontend preexistente expõe só `INTERNAL_BACKEND_URL` entre as chaves relevantes. Os predicados completos anteriores estão em `docs/admin-rbac/evidence-stage4a/private-config-presence.json`.

O `.env` local foi reavaliado offline nesta auditoria pelo script sanitizador: DB_URL/JWT/rate/proxy/SMTP presentes e `verify-full` declarado, mas outbox, URL pública e bootstrap ausentes. Seu profile/CORS/cookie não satisfazem a política de produção. A configuração efetiva do processo Next vem do ambiente do container/processo; o backend usa `DotenvEnvironmentPostProcessor` para `.env` local e pode receber overrides de precedência maior. Nunca usar `.env` como prova do container já criado. Todas as comparações publicadas são apenas nomes/presença/booleans, sem valores. **NO-GO** para apontar qualquer processo existente ao original.

## PR #18: classificação das mudanças

PR #18 está aberto, isolado na branch `chore/finalize-homologation`, baseado no PR #17 antes de sua reversão. Não faz parte da candidata. O `firebase.json` reescreve tudo para Cloud Run `oficina-frontend-hml`; o adaptador `firebaseSession.ts` cria `__session` AES-256-GCM para contornar a restrição de cookies do Hosting. O proxy candidato já mantém cookies HttpOnly, CSRF e IAM backend sem essa camada. Classificação:

| Bloco #18 | Classe | Razão/gate |
|---|---|---|
| Firebase rewrite e `__session` cifrado | Opcional e incompatível sem redesign | Nova chave, envelope compartilhado, concorrência/rotação e limites de cookie exigem revisão e testes de ponta a ponta; não transplantar automaticamente |
| Guard `HomologationDatabaseGuard` e scripts Neon HML | Obsoleto para candidato original | Dependem de `HML_*` e do caminho de homologação do #17 revertido; runbook 4A usa autorização/restore separado |
| Cloud Run IAM/Secret Manager/TLS | Necessário se arquitetura Cloud Run for aprovada | Conferir identidades, permissões mínimas, endpoints, custos, limites e configuração efetiva antes de deploy |
| Headers/CSP/CSRF/cookies | Parte substituída pela candidata | Comparar comportamento final do Next/proxy, não juntar políticas conflitantes |

Nenhum custo ou limite de Firebase/Cloud Run foi contratado, medido ou alterado. Não houve deploy, DNS ou acesso ao console autenticado.

## PR #26 e governança

`SECURITY.md` só existe na branch paralela #26. A política proíbe acesso real implícito, protege segredo, histórico operacional e pede revisão proporcional; é compatível em princípio com AGENTS.md raiz e `frontend/AGENTS.md` (este exige ler documentação da versão Next antes de editar frontend). Não foi incorporada, pois #26 conserva [Integração Real falha](https://github.com/uaikauaa/oficina/actions/runs/42892478545): espera de `Painel Operacional` após 2FA, 5 s. Causa ainda não determinada para aquela branch. O #30 verde não reclassifica o #26. Se governança for integrada, comparar base/código atual e reexecutar seu SHA, sem merge automático.

## Riscos de operação

CI usa Gitleaks em todo histórico, Trivy/SBOM, Flyway sintético e stack real isolada. `docker-compose.yml` é template, não atestado de Cloud Run. Banco original exige DNS/hostname e cadeia de confiança `verify-full`; container atual não satisfaz esse gate. Startup pode migrar e disparar workers mesmo sem requisição. Revisar cron, notificações, egress SMTP, rate limit distribuído, logs/retention e custo antes de qualquer ativação.
