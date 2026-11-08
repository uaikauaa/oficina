# Frontend — Oficina Gestão

Next.js 16 (App Router), React 19, TypeScript e Tailwind CSS. O navegador usa `/api/*` na mesma origem; o proxy do Next encaminha as requisições ao Spring Boot. Somente o backend acessa o banco.

A partir deste diretório, com Node.js 22 e npm:

```powershell
npm ci
$env:INTERNAL_BACKEND_URL='http://127.0.0.1:8080'
npm run dev
```

Abra `http://localhost:3000`. Configure banco, SMTP e conta inicial no backend seguindo o [guia de desenvolvimento](../docs/development.md). Credenciais de banco, JWT e SMTP pertencem somente ao backend; nunca use variáveis públicas para esses valores.

```powershell
npm test
node --test scripts/release-build-keys.test.mjs
npm run lint
npx tsc --noEmit
npx tsc -p e2e/tsconfig.json --noEmit
npm run build
$env:CI='true'
npx playwright test --project=chromium
```

Instale o navegador com `npx playwright install chromium` antes do primeiro E2E. A suíte padrão usa APIs simuladas; a integração real com Spring, PostgreSQL e SMTP roda separadamente, conforme o [guia de testes](../docs/development.md). Execute as suítes em sequência para evitar conflito nos artefatos Playwright. Em porta alternativa, ajuste tanto `PLAYWRIGHT_PORT` quanto `E2E_BASE_URL`.

O build também gera a saída standalone usada pelo Dockerfile. Build local aprovado não comprova publicação: consulte o [README principal](../README.md), o [plano Cloud Run](../docs/deployment-google-cloud-run.md) e a [auditoria do repositório restaurado](../docs/repository-audit-20261108/README.md). Homologação remota pendente; produção NO-GO.
