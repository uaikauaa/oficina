# Oficina Gestão

WebApp para operação de oficina técnica. O navegador acessa o frontend Next.js pela mesma origem; o frontend encaminha `/api/*` ao backend Spring Boot por REST/JSON; somente o backend acessa o PostgreSQL no Neon. Regras de negócio, autenticação, 2FA, validações e migrations permanecem no backend.

## Stack e arquitetura

- Frontend: Next.js 16.4.1 (App Router), React 19, TypeScript, Tailwind CSS, React Hook Form e Zod. Node.js 22 para build.
- Backend: Java 21, Spring Boot 4.0.9, Spring Security, Spring Data JPA, Flyway, Jakarta Validation e OpenAPI. Maven Wrapper incluído.
- Banco: PostgreSQL no Neon; schema controlado exclusivamente pelo Flyway. V1–V24 preservam o histórico; bancos novos usam a baseline neutra B24 do PR #16.
- Homologação planejada: dois serviços Google Cloud Run. O frontend é público; o backend deve ser **privado por IAM** e aceitar somente a identidade de serviço do frontend. O proxy do Next.js obtém o ID token no servidor, preservando cookies, CSRF e downloads PDF/CSV.
- 2FA: envio de código por SMTP configurado no backend. Use um remetente e banco isolados para homologação.

Nenhum deploy ou conexão com serviços de produção está implícito neste estado do repositório. **Homologação Google Cloud pendente; produção NO-GO.**

## Estado da restauração e estrutura

Em 08/11/2026, o [PR #19](https://github.com/uaikauaa/oficina/pull/19) está integrado. A base desta auditoria é `62e8f62d4166f5f9695c49e6588897e31777b038`, com árvore `56c61a479f478c28b1b9e36d2f79804784723eac`, idêntica ao estado anterior ao PR #17. O PR #18 permanece separado. O [relatório de auditoria e limpeza](docs/repository-audit-20261108/README.md) registra inventário, exclusões e testes. A conexão com o Neon original ainda precisa de validação remota.

```text
backend/    API Spring Boot, migrations Flyway e testes Maven
frontend/   Next.js, componentes React, testes unitários e Playwright
scripts/    Validação, build, auditoria e backup
.github/    Workflows de CI, segurança e integração isolada
docs/       Arquitetura, operação e evidências datadas
nginx/      Proxy TLS para infraestrutura VPS/contingência
ops/        Unidades systemd de backup
```

Dockerfiles ficam nos serviços; `docker-compose.yml` atende a infraestrutura VPS/contingência. O [guia de desenvolvimento](docs/development.md) detalha instalação e configuração do banco descartável para testes.

## Configuração

Os modelos são [desenvolvimento](.env.example), [homologação](.env.homolog.example) e [produção](.env.production.example). Copie o modelo apropriado para um arquivo `.env` local ignorado pelo Git ou configure as variáveis no serviço; nunca versione credenciais. Em Cloud Run, use referências distintas do Secret Manager.

| Variável | Destino | Finalidade |
| --- | --- | --- |
| `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` | backend | PostgreSQL; Neon com `sslmode=verify-full`, CA confiável e hostname validado |
| `JWT_SECRET`, `RATE_LIMIT_SECRET`, `SERVICE_PROXY_SECRET` | backend | Três segredos independentes de pelo menos 32 caracteres |
| `SERVICE_PROXY_SECRET`, `TRUSTED_PROXY_HOPS` | frontend | Contexto de IP assinado entre os serviços |
| `INTERNAL_BACKEND_URL` | frontend | Origem HTTPS do backend Cloud Run; localmente pode ser `http://localhost:8080` |
| `CORS_ALLOWED_ORIGINS`, `SECURITY_COOKIE_SECURE` | backend | Origem exata do frontend e cookies HTTPS |
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM` | backend | SMTP e envio do 2FA |
| `INITIAL_ADMIN_*` | backend, somente bootstrap | Conta inicial; remover após criação |

`K_SERVICE` é definido pelo Cloud Run. Em homologação, valide IAM, cadeia de proxies, Neon TLS, SMTP, rotação coordenada dos três segredos, Flyway V24, capacidade e restauração antes de qualquer tráfego operacional. A troca de `RATE_LIMIT_SECRET` exige drenar escritores antigos e aguardar a maior janela de contadores.

## Execução local

Requer Java 21, Node.js 22, npm e PostgreSQL de desenvolvimento isolado. Configure `.env` com credenciais locais e SMTP de teste. O backend aplica as migrations Flyway na inicialização.

```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

Em outro terminal:

```powershell
cd frontend
npm ci
npm run dev
```

A interface fica em `http://localhost:3000`; a API local fica em `http://localhost:8080`. O frontend usa o proxy server-side em `/api/*`, sem acesso direto ao banco.

## Testes

O `clean verify` exige PostgreSQL **descartável** em loopback, banco `oficina_gestao_test`, variáveis `TEST_DB_URL`, `TEST_DB_EXPECTED_PORT`, `TEST_DB_USERNAME`, `TEST_DB_PASSWORD` e `TEST_FLYWAY_LOCATION` apontando para `backend/src/test/resources/db/synthetic-migration`. O guard de testes rejeita fallback para `DB_URL` operacional. A CI executa essa configuração e também aplica as migrations reais em outro job isolado.

```powershell
cd backend
.\mvnw.cmd -B -ntp clean verify
```

```powershell
cd frontend
npm ci
npm test
npm run lint
npx tsc --noEmit
npx tsc -p e2e/tsconfig.json --noEmit
npm run build
npx playwright test --project=chromium
```

A integração real de navegador, PostgreSQL, Flyway e SMTP sintético roda pelo workflow dedicado e por `node scripts/test-real-stack-local.mjs` em ambiente isolado.

## Documentação vigente

- [Auditoria do repositório restaurado, inventário e comparação dos testes](docs/repository-audit-20261108/README.md)
- [Preparação para homologação e estado da release](docs/release-pre-homologacao/README.md)
- [Auditoria independente de segurança e limites](docs/auditoria-independente-20261103/README.md)
- [Roteiro de homologação isolada](docs/security-hardening/homologacao.md)
- [Arquitetura](docs/architecture.md), [API](docs/api.md), [banco](docs/database.md) e [roadmap](docs/roadmap.md)
- [Documentação visual](docs/visual/README.md) e [instalação PWA](docs/instalacao-pwa.md)

Os relatórios em `docs/historico/`, `docs/auditoria-final/` e `docs/integracao-final/` registram decisões de etapas anteriores e não descrevem o estado corrente de produção.
