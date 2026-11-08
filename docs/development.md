# Desenvolvimento e testes — Oficina Gestão

Guia atualizado em 08/11/2026 para a base restaurada pelo PR #19. Veja a [visão geral e estrutura](../README.md), a [arquitetura](architecture.md) e as [diretrizes de banco](database.md).

## Preparação local

Requer Java 21, Node.js 22, npm e Git. O Maven Wrapper acompanha o backend. Docker com engine Linux é necessário para os ensaios descartáveis descritos abaixo. As versões das bibliotecas estão em `backend/pom.xml` e `frontend/package-lock.json`.

Na raiz, copie `.env.example` para `.env`, ignorado pelo Git. Configure `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, SMTP de teste e segredos JWT/rate/proxy distintos. Use somente banco de desenvolvimento com identidade confirmada. Nunca substitua o banco original pelo projeto temporário `oficina-homologacao` nem reutilize senhas expostas.

O banco oficial está no Neon. Para conexão externa, a URL JDBC deve exigir `sslmode=verify-full` e uma CA confiável, com verificação do hostname. A configuração remota exige conferência da identidade do banco e do usuário; um exemplo versionado não comprova que a conexão funciona. Os modelos de homologação e produção têm requisitos próprios e continuam preservados.

O backend carrega `.env` a partir do diretório corrente, do pai ou de `backend/`. O frontend pode receber `INTERNAL_BACKEND_URL` pelo ambiente. DB/JWT/SMTP não devem ser distribuídos ao frontend. O bootstrap `INITIAL_ADMIN_*` só cria a conta inicial em banco vazio; não redefine senha de conta existente. Remova a senha de bootstrap do ambiente após criar a conta.

Em um terminal, na raiz:

```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

Em outro terminal:

```powershell
cd frontend
npm ci
$env:INTERNAL_BACKEND_URL='http://127.0.0.1:8080'
npm run dev
```

Interface: `http://localhost:3000`; API: `http://localhost:8080`. O backend executa Flyway `migrate()` ao iniciar e Hibernate `validate`. Não inicie a aplicação no banco original para realizar uma checagem somente leitura.

## Backend com PostgreSQL descartável

Na raiz, use um container novo de testes e uma porta local livre. O guard aceita apenas o banco `oficina_gestao_test` em loopback, nas portas 5432 ou 5433. Não reutilize container nem volume operacional. Os valores abaixo são exclusivamente sintéticos:

```powershell
docker run --name oficina-dev-tests --label oficina.purpose=local-tests -e POSTGRES_DB=oficina_gestao_test -e POSTGRES_USER=oficina_test -e POSTGRES_PASSWORD=synthetic-local-tests-only -p 127.0.0.1:5433:5432 -d postgres:16-alpine
$env:TEST_DB_URL='jdbc:postgresql://127.0.0.1:5433/oficina_gestao_test'
$env:TEST_DB_EXPECTED_PORT='5433'
$env:TEST_DB_USERNAME='oficina_test'
$env:TEST_DB_PASSWORD='synthetic-local-tests-only'
$migrationsPath=(Resolve-Path 'backend/src/test/resources/db/synthetic-migration').Path.Replace('\','/')
$env:TEST_FLYWAY_LOCATION="filesystem:$migrationsPath"
cd backend
.\mvnw.cmd -B -ntp clean verify '-Djunit.jupiter.execution.parallel.enabled=false'
```

O argumento Maven com pontos deve ficar entre aspas no PowerShell. O perfil de teste não carrega `.env` e não faz fallback para `DB_*`. O diretório de migrations sintéticas e seu manifesto são conferidos antes da conexão. Não altere o guard para aceitar outro destino.

De volta à raiz, confira também:

```powershell
node scripts/check-flyway-baseline.mjs
node scripts/check-neutral-defaults.mjs
```

As migrations oficiais V1–V24 e a B24 ficam em `backend/src/main/resources/db/migration/`. Não altere checksums, não execute `repair` para ocultar divergências e não use as cópias sintéticas para inicializar o banco original. O workflow `validation.yml` aplica e valida as migrations oficiais em outro PostgreSQL descartável.

## Frontend e integração completa

O [guia do frontend](../frontend/README.md) reúne instalação, testes unitários, lint, TypeScript, build e Playwright. Use o build de produção antes dos testes de navegador. As suítes visuais geram capturas; não substitua evidências históricas versionadas sem revisão.

Depois de compilar backend e frontend, na raiz:

```powershell
node --test scripts/homologation/tls-isolated.test.mjs
node scripts/test-proxy-runtime.mjs
$env:CI='true'
node scripts/test-real-stack-local.mjs
```

Execute a suíte Playwright padrão e a integração real em sequência, pois compartilham o diretório de resultados. O último script cria PostgreSQL e SMTP sintéticos e exige portas locais livres 15433, 1025, 8025, 8080, 8082 e 3000; ele remove apenas os containers identificados como seus. Valida 2FA, persistência, estoque/OS e limitador entre duas JVMs. Não exige credenciais Neon nem serviços remotos.

Os quatro workflows em `.github/workflows/` complementam essas verificações com imagens reproduzíveis, SBOM/Trivy, Gitleaks histórico e Nginx/TLS. Passar localmente não aprova o Neon original, IAM, DNS, SMTP real ou HTTPS externo. Consulte a [comparação antes/depois](repository-audit-20261108/README.md) e o [plano de homologação](deployment-google-cloud-run.md). Nenhum deploy é realizado por estes comandos de teste.
