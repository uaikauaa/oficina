# Google Cloud Run — Oficina Gestão (dois serviços, um monorepo)

> **Status: preparação para homologação.** Este documento **não** registra um deploy realizado. Não aponte o primeiro deploy para a branch `production` do Neon nem execute comandos com segredos no histórico do terminal.

> **Auditoria 30/10/2026: NO-GO para produção.** Consulte o [relatório final](auditoria-final/README.md) e cumpra o [checklist](auditoria-final/checklist-implantacao.md). Os comandos abaixo são preparação, não autorização de deploy. Use contas de serviço distintas para frontend, backend e build; somente backend recebe credenciais de banco/SMTP.

## Arquitetura escolhida

- GitHub: **um único repositório**, com `frontend/` e `backend/`. Não separar o monorepo.
- Cloud Run: serviço `oficina-frontend` (Next.js 16 / Node 22, porta **3000**) e `oficina-backend` (Spring Boot / Java 21, porta **8080**).
- Banco: PostgreSQL no **Neon**, usando ambiente de **homologação isolado** durante a validação.
- Browser: `https://FRONTEND.run.app/api/*` → rewrite do Next.js → `https://BACKEND.run.app/api/*`. O navegador continua na **mesma origem** para cookies, CSRF e CSP.
- TLS: HTTPS gerenciado pelo Cloud Run. Nginx e Docker Compose continuam disponíveis para o ambiente Oracle/VPS; não são necessários neste modelo.

**Importante:** o Next.js avalia `rewrites()` durante o build. Por isso, `INTERNAL_BACKEND_URL` deve ser passado **no build da imagem frontend** (se também definido no runtime, deve coincidir com o manifesto compilado; divergências abortam a inicialização). O valor `http://backend:8080` continua sendo o default do Docker Compose, mas não resolve no Cloud Run.

## 1. Pré-requisitos (ações manuais)

1. Criar um projeto em https://console.cloud.google.com/ e **habilitar faturamento**. A franquia gratuita do Cloud Run **não é um bloqueio de gastos**. Configure orçamento, alertas e limite de instâncias; acompanhe custos reais.
2. Instalar o Google Cloud CLI (`gcloud`) no Windows e autenticar com `gcloud auth login`.
3. Escolher a região com base em **custo e latência**. `us-central1` é um exemplo para o piloto; o banco Neon em São Paulo pode sofrer latência adicional. Reavaliar `southamerica-east1` após medir.
4. Criar/usar **banco de homologação isolado** no Neon. Não reutilizar credenciais de produção na prova de conceito. Fazer backup e revisar Flyway antes de conectar qualquer banco real.
5. Ter um SMTP de teste para o 2FA, preferencialmente separado do remetente real.
6. Criar uma **conta de serviço de execução** com acesso mínimo e armazenar os segredos em **Secret Manager** (por exemplo, `oficina-db-password`, `oficina-jwt-secret`, `oficina-mail-password`). Conceder `roles/secretmanager.secretAccessor` apenas aos segredos necessários. Não salvar chaves JSON de service account no repositório.

## 2. Preparar o projeto e o Artifact Registry

Exemplo para **PowerShell** (substitua o ID do projeto e confirme a região antes de executar):

```powershell
$PROJECT_ID = "SEU_PROJECT_ID"
$REGION = "us-central1"
$REPO = "oficina"
$TAG = "homologacao-001"

gcloud auth login
gcloud config set project $PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
gcloud artifacts repositories create $REPO --repository-format=docker --location=$REGION --description="Imagens Oficina Gestao"

$BACKEND_IMAGE = "${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/oficina-backend:${TAG}"
$FRONTEND_IMAGE = "${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/oficina-frontend:${TAG}"
```

O Artifact Registry e o Cloud Build possuem cotas e preços próprios; verifique permissões da conta de serviço de build para publicar imagens. **Não presumir custo zero.**

## 3. Build e deploy do backend primeiro

Na raiz do monorepo:

```powershell
gcloud builds submit ./backend --tag=$BACKEND_IMAGE
```

No **Cloud Run → Criar serviço → Implantar uma imagem existente**, selecione `$BACKEND_IMAGE` e configure:

| Configuração | Valor inicial de homologação |
| --- | --- |
| Serviço | `oficina-backend` |
| Região | `$REGION` |
| Porta | `8080` |
| Memória | `1 GiB` inicialmente; aumentar se o Java exigir |
| CPU | `1 vCPU` |
| Instâncias mínimas | `0` |
| Instâncias máximas | `1` no piloto |
| Concorrência | `4` inicialmente |
| Autenticação da plataforma | Permitir chamadas públicas **apenas se** a API Spring Security estiver corretamente protegida |
| Variáveis sensíveis | Referências ao Secret Manager, **nunca texto em código** |

Configurar as variáveis exigidas pelo `backend/src/main/resources/application*.properties`:

- **Não secretas:** `SPRING_PROFILES_ACTIVE=prod`, `SERVER_PORT=8080`, `SECURITY_COOKIE_SECURE=true`, `CORS_ALLOWED_ORIGINS=https://FRONTEND.run.app` (atualizar após obter URL), `DB_URL` (JDBC com `sslmode=verify-full com CA confiável` para **homologação**), `DB_USERNAME`, `MAIL_HOST`, `MAIL_PORT=587`, `MAIL_USERNAME`, `MAIL_FROM`, `MAIL_SMTP_AUTH=true`, `MAIL_SMTP_STARTTLS=true`, `HIKARI_MAX_POOL_SIZE=4`, `HIKARI_MIN_IDLE=0`, `SWAGGER_ENABLED=false`, `API_DOCS_ENABLED=false`.
- **Secretas:** `DB_PASSWORD`, `JWT_SECRET`, `MAIL_PASSWORD`; adicionar `INITIAL_ADMIN_PASSWORD` como segredo **somente se** o bootstrap inicial for necessário. Evitar deixar senha inicial persistente após a criação da conta.
- **Proxy/IP:** `TRUSTED_PROXIES` deve permanecer vazio até validar o comportamento real do encaminhamento de IPs no Cloud Run. Não confiar indiscriminadamente em `X-Forwarded-For`.

**Atenção:** o backend pode ficar acessível diretamente na URL `run.app` quando público. A autorização dos endpoints, limitação de tentativas e proteção CSRF precisam continuar sendo aplicadas no Spring Security. A URL do backend não deve ser confundida com uma API privada protegida por IAM.

Anote a URL HTTPS real do backend no Console e teste `GET /api/health`. Se a revisão falhar na inicialização, verifique os logs sem copiar senhas ou tokens.

## 4. Build do frontend apontando para o backend real

O arquivo `frontend/cloudbuild.yaml` injeta a URL do backend no **build** do Next.js. Na raiz do monorepo, substitua a URL pelo endereço HTTPS real do Cloud Run backend:

```powershell
$BACKEND_URL = "https://SEU-BACKEND.run.app"
gcloud builds submit ./frontend --config=./frontend/cloudbuild.yaml --substitutions="_BACKEND_URL=$BACKEND_URL,_IMAGE=$FRONTEND_IMAGE"
```

No **Cloud Run → Criar serviço**, selecione `$FRONTEND_IMAGE`:

| Configuração | Valor inicial de homologação |
| --- | --- |
| Serviço | `oficina-frontend` |
| Porta | `3000` |
| Memória | `512 MiB` inicialmente; medir SSR |
| CPU | `1 vCPU` |
| Instâncias mínimas | `0` |
| Instâncias máximas | `1` no piloto |
| Variável de runtime | `INTERNAL_BACKEND_URL=https://SEU-BACKEND.run.app` |
| Acesso | Público, via HTTPS |

**Não** definir `NEXT_PUBLIC_API_URL` no navegador para uma origem diferente: o código já utiliza `/api` relativo. O proxy Next.js preserva a mesma origem.

Depois de obter a URL do frontend, atualizar `CORS_ALLOWED_ORIGINS` no serviço backend para a origem HTTPS exata (sem barra final) e publicar uma nova revisão. Para mudança futura de URL do backend, **reconstruir** a imagem do frontend; alterar apenas a variável no runtime não atualiza os rewrites compilados.

## 5. Checklist de homologação antes de qualquer tráfego real

- [ ] Backend sobe com Java 21 e `/api/health` responde sem divulgar detalhes internos.
- [ ] Flyway valida/aplica migrações **somente no Neon de homologação**; sem impacto em produção.
- [ ] Frontend responde em HTTPS e `/api/auth/csrf` funciona via domínio do frontend.
- [ ] Login, envio e confirmação de código SMTP 2FA, refresh e logout.
- [ ] Cookies `HttpOnly`, `Secure` e `SameSite` corretos; CSRF nas mutações; ausência de erro CORS.
- [ ] Cadastro de cliente, máquina, produto, movimentação de estoque e ordem de serviço.
- [ ] PDF de OS, relatórios e impressão.
- [ ] PWA instalável e funcionamento responsivo.
- [ ] Testes Playwright, backend Maven, lint e build CI verdes.
- [ ] Conferir memória, inicialização a frio, latência Brasil↔Neon, número de conexões Hikari e logs.
- [ ] Verificar uso real e custo no Billing; confirmar alertas. Alertas **não interrompem** automaticamente a cobrança.
- [ ] Planejar backup do Neon **independente** da implantação Cloud Run. O backup Oracle anterior não é automaticamente executado no Cloud Run.

## 6. Depois da homologação

1. Definir domínio definitivo e validar a mesma origem `/api`.
2. Configurar CI/CD com **Workload Identity Federation (OIDC)** e contas de serviço de privilégio mínimo; evitar chaves JSON persistentes. O fluxo atual de GitHub Actions de CI permanece independente.
3. Considerar proteger o backend por IAM com um proxy autenticado no frontend, se necessário, como evolução separada; **não** marcar backend público como privado.
4. Fazer revisão de segurança, restauração de backup, rollback e limites de gastos antes de conectar a branch de produção do Neon.
5. Manter `min-instances=0` para aproveitar escala a zero, sabendo que haverá cold starts. A cobrança do Cloud Run, Cloud Build, Artifact Registry, Secret Manager, logs e rede deve ser acompanhada.

## Referências oficiais

- Cloud Run: https://cloud.google.com/run/docs/overview
- Implantar contêiner: https://cloud.google.com/run/docs/deploying
- Cloud Build: https://cloud.google.com/build/docs/building/build-containers
- Artifact Registry: https://cloud.google.com/artifact-registry/docs
- Secret Manager: https://cloud.google.com/secret-manager/docs
- Cloud Run preços: https://cloud.google.com/run/pricing
- Google Cloud budgets: https://cloud.google.com/billing/docs/how-to/budgets
