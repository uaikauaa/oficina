# Desenvolvimento e testes locais

Requer Java 21, Node.js 22, npm e Docker Desktop com engine Linux para os testes descartáveis. As versões das dependências são definidas pelo `pom.xml` e pelo `package-lock.json`. A arquitetura e os passos de inicialização estão no [README](../README.md).

## Aplicação em desenvolvimento

Copie `.env.example` para `.env` na raiz e configure um PostgreSQL de desenvolvimento dedicado, segredos independentes e SMTP de teste. O backend carrega esse arquivo; variáveis exportadas no terminal têm prioridade. O frontend lê suas próprias variáveis de servidor ou `frontend/.env.local`. Segredos de banco, SMTP e JWT pertencem ao backend e não devem receber prefixo `NEXT_PUBLIC_`.

O bootstrap `INITIAL_ADMIN_*` cria a conta apenas quando ainda não existem usuários. Alterar sua senha no ambiente não redefine a senha de uma conta existente. Remova as variáveis de bootstrap após o provisionamento.

Inicie o backend com `backend/mvnw.cmd spring-boot:run` e, em outro terminal dentro de `frontend/`, execute `npm ci` e `npm run dev`. Abra `http://localhost:3000`. O proxy `/api/*` encaminha ao Spring em `http://localhost:8080`, sem acesso do navegador ao PostgreSQL.

## Backend com PostgreSQL descartável

O profile `test` ignora `.env`. Exporte explicitamente todas as variáveis abaixo. O guard aceita apenas `localhost` ou `127.0.0.1`, banco **exato** `oficina_gestao_test`, porta 5433 local ou 5432 na CI, e migrations sintéticas com hashes conferidos. Não configure um endpoint Neon nesta suíte.

Execute na raiz do repositório, em PowerShell:

```powershell
$testContainer = 'oficina-tests-' + [guid]::NewGuid().ToString('N').Substring(0, 8)
docker run -d --name $testContainer --label oficina.tests=local `
  -p 127.0.0.1:5433:5432 --tmpfs /var/lib/postgresql/data `
  -e POSTGRES_DB=oficina_gestao_test -e POSTGRES_USER=oficina_test `
  -e POSTGRES_PASSWORD=local-disposable-test-only postgres:16-alpine
if ($LASTEXITCODE -ne 0) { throw 'Falha ao criar o banco descartável' }

for ($attempt = 0; $attempt -lt 30; $attempt++) {
  docker exec $testContainer pg_isready -U oficina_test -d oficina_gestao_test
  if ($LASTEXITCODE -eq 0) { break }
  Start-Sleep -Seconds 1
}
if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL de teste indisponível' }

$env:SPRING_PROFILES_ACTIVE = 'test'
$env:TEST_DB_URL = 'jdbc:postgresql://127.0.0.1:5433/oficina_gestao_test'
$env:TEST_DB_EXPECTED_PORT = '5433'
$env:TEST_DB_USERNAME = 'oficina_test'
$env:TEST_DB_PASSWORD = 'local-disposable-test-only'
$env:TEST_FLYWAY_LOCATION = 'filesystem:' + ((Resolve-Path `
  'backend/src/test/resources/db/synthetic-migration').Path.Replace('\', '/'))

Push-Location backend
try {
  .\mvnw.cmd -B -ntp clean verify '-Djunit.jupiter.execution.parallel.enabled=false'
} finally {
  Pop-Location
}
```

A senha acima pertence somente ao container descartável em loopback. A suíte inclui autenticação, permissões, transações, estoque, OS e verificações Flyway de bancos novos/B24 e históricos V21/V24. Nenhuma migration histórica deve ser alterada para fazer o teste passar.

Quando terminar, remova apenas o container criado pelo comando desta sessão:

```powershell
docker rm -f -v $testContainer
```

## Frontend e navegador

Dentro de `frontend/`:

```powershell
npm ci
npm test
npm run lint
npx tsc --noEmit
npx tsc -p e2e/tsconfig.json --noEmit
npm run build
npx playwright install chromium
npx playwright test --project=chromium
```

Os testes comuns do Playwright usam API mockada. Alguns cenários produzem capturas em `docs/visual/` e prévias locais; revise essas alterações antes de incluí-las em um commit. Eles não comprovam conexão com o Neon original.

## Integração real isolada

Após gerar o JAR com Maven e o build do frontend, execute na raiz:

```powershell
node scripts/test-real-stack-local.mjs
```

O script cria PostgreSQL novo e Mailpit sintético, inicia Spring e Next.js e executa login com 2FA recebido por SMTP, cookies/JWT, CSRF negativo, cadastro/consulta, estoque, OS, rollback de operação inválida, PDF/CSV e logout. Depois verifica orçamento de rate limiting compartilhado entre duas JVMs e sua preservação após reinício com troca de chave JWT. Os containers criados pelo script têm identificação de propriedade e são removidos ao final.

As portas locais 3000, 8080, 8082, 15433, 1025 e 8025 precisam estar livres. Não aponte esse ensaio para dados operacionais. Os workflows `ci.yml`, `integration-real.yml` e `validation.yml` executam as verificações correspondentes, incluindo imagens Docker e Flyway real em PostgreSQL descartável.

## Inventário sob demanda

`node scripts/inventory-release.mjs` gera CSV e lista de duplicatas em `backups/repository-inventory/`, diretório ignorado pelo Git. Um diretório de saída pode ser informado como argumento. A classificação é triagem, não evidência suficiente para excluir arquivos. Os inventários históricos já citados por relatórios permanecem como registros datados.
