# Oficina Gestão

Sistema web moderno e integrado para gestão de oficina técnica especializada em conserto, manutenção e reparo de máquinas de solda e geradores de energia.

## 🏛 Arquitetura

O projeto adota uma arquitetura em camadas exclusivamente **WebApp** (sem JavaFX, sem desktop):

- **Frontend**: Next.js 16.3.5 (App Router), React 19, TypeScript 5, Tailwind CSS 4
- **Backend**: Java 21, Spring Boot 3.4.3 (Web, Security, Data JPA, Flyway, Validation, OpenAPI)
- **Banco de Dados**: PostgreSQL (Neon Serverless — aws-sa-east-1)
- **Comunicação**: REST API via JSON / Cookies HttpOnly

```text
Browser
   ↓ HTTPS
Next.js (Frontend — porta 3000)
   ↓ REST / JSON (rewrite /api/* → backend)
Spring Boot (Backend — porta 8080)
   ↓ JDBC / HikariCP / Flyway
PostgreSQL / Neon (Banco de Dados)
```

> **Regra Fundamental:** O frontend nunca acessa o banco de dados diretamente. Regras de negócio residem exclusivamente no backend.

---

## 🚀 Como Rodar o Projeto (Desenvolvimento Local)

### Pré-requisitos

| Ferramenta | Versão Mínima | Verificar |
|---|---|---|
| Java JDK | 21 (LTS) | `java -version` |
| Node.js | 20.x LTS | `node --version` |
| npm | 10.x | `npm --version` |
| Git | qualquer recente | `git --version` |
| Conta Neon | — | [neon.tech](https://neon.tech) |

> **Maven não precisa ser instalado.** O projeto usa o Maven Wrapper (`mvnw.cmd`) incluído no repositório.

---

### Passo 1 — Clonar o repositório

```bash
git clone https://github.com/uaikauaa/oficina.git
cd oficina
```

---

### Passo 2 — Configurar variáveis de ambiente

```powershell
# Windows PowerShell
Copy-Item .env.example .env
```

```bash
# Linux / macOS
cp .env.example .env
```

Abra `.env` e preencha com suas credenciais:

```env
# Banco de Dados (Neon)
DB_URL=jdbc:postgresql://<seu-neon-host>.neon.tech/neondb?sslmode=require
DB_USERNAME=neondb_owner
DB_PASSWORD=sua_senha_neon

# Porta do backend
SERVER_PORT=8080

# JWT (mínimo 32 caracteres aleatórios)
JWT_SECRET=sua_chave_jwt_de_pelo_menos_32_chars_aqui_123

# Conta inicial da proprietária (executado apenas se a tabela usuarios estiver vazia)
INITIAL_ADMIN_NAME=Proprietária Oficina
INITIAL_ADMIN_EMAIL=admin@oficina.com
INITIAL_ADMIN_PASSWORD=Senha@Segura123!
```

> O arquivo `.env` é ignorado pelo Git (`.gitignore`). Nunca o versione.

---

### Passo 3 — Iniciar o Backend (Spring Boot)

```powershell
# Windows PowerShell — dentro da pasta raiz do projeto
cd backend
.\mvnw.cmd spring-boot:run
```

```bash
# Linux / macOS
cd backend
./mvnw spring-boot:run
```

O backend lê automaticamente o `.env` da raiz do projeto via `DotenvEnvironmentPostProcessor`.  
Na primeira inicialização, o Flyway aplica as migrations V1–V10 e cria o schema completo.

**O backend estará disponível em:**

| URL | Descrição |
|-----|-----------|
| `http://localhost:8080/api/health` | Health check público (retorna `{"status":"UP"}`) |
| `http://localhost:8080/swagger-ui/index.html` | Documentação interativa da API |
| `http://localhost:8080/v3/api-docs` | Especificação OpenAPI (JSON) |
| `http://localhost:8080/api/system/status` | Status do sistema (requer autenticação) |

---

### Passo 4 — Instalar dependências do Frontend

```powershell
# Windows PowerShell — em outro terminal, na raiz do projeto
cd frontend
npm install
```

---

### Passo 5 — Iniciar o Frontend (Next.js)

```powershell
npm run dev
```

```bash
# Linux / macOS
npm run dev
```

**A interface estará disponível em:** `http://localhost:3000`

> O Next.js faz rewrite automático de `/api/*` → `http://localhost:8080/api/*` (configurado em `next.config.ts`).  
> Portanto, **mantenha o backend rodando** enquanto usa o frontend.

---

### Resumo — Dois terminais em paralelo

```
Terminal 1 — Backend          Terminal 2 — Frontend
──────────────────────        ─────────────────────
cd backend                    cd frontend
.\mvnw.cmd spring-boot:run    npm run dev
         ↓                             ↓
 http://localhost:8080         http://localhost:3000
```

---

## 🧪 Rodando os Testes

### Testes do Backend (261 testes)

```powershell
# Windows PowerShell
cd backend
.\mvnw.cmd clean test
```

```bash
# Linux / macOS
cd backend
./mvnw clean test
```

Saída esperada:
```
Tests run: 261, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

### Testes do Frontend (247 testes)

```powershell
cd frontend
npm test
```

Saída esperada:
```
tests 247 | suites 103 | pass 247 | fail 0
```

### TypeScript (zero erros)

```powershell
cd frontend
npx tsc --noEmit
```

### Lint (zero warnings)

```powershell
cd frontend
npm run lint
```

### Build de Produção do Frontend

```powershell
cd frontend
npm run build
```

Gera 14 rotas otimizadas em `.next/`.

### Auditoria de Vulnerabilidades npm

```powershell
cd frontend
npm audit
```

Resultado atual: `found 0 vulnerabilities`

---

## 🏗 Build para Produção (Backend)

```powershell
cd backend
.\mvnw.cmd clean package -DskipTests
java -Duser.timezone=America/Sao_Paulo -jar target/backend-0.0.1-SNAPSHOT.jar
```

---

## 🧭 Como Encontrar Cada Parte do Sistema

| O que você quer alterar ou entender? | Onde fica no projeto? | Exemplo |
| :--- | :--- | :--- |
| **Telas, páginas e rotas visuais** | `frontend/src/app/` | `app/ordens-servico/page.tsx` |
| **Componentes de interface e modais** | `frontend/src/components/` | `ProdutoModal.tsx` |
| **Utilitários, tipos e chamadas de API** | `frontend/src/lib/` | `api.ts`, `types.ts` |
| **Endpoints REST e rotas HTTP** | `backend/.../controller/` | `OrdemServicoController.java` |
| **Regras de negócio e cálculos** | `backend/.../service/` | `OrdemServicoService.java` |
| **Consultas e operações no banco** | `backend/.../repository/` | `OrdemServicoRepository.java` |
| **Estrutura das tabelas (ORM / Entidades)** | `backend/.../entity/` | `OrdemServico.java`, `Cliente.java` |
| **Contratos de entrada/saída (DTOs)** | `backend/.../dto/` | `OrdemServicoCreateDTO.java` |
| **Scripts e migrações do banco (Flyway)** | `backend/.../resources/db/migration/` | `V10__...sql` |
| **Segurança, JWT e autenticação** | `backend/.../security/` | `SecurityConfig.java`, `JwtService.java` |
| **Testes automatizados (backend)** | `backend/src/test/` | `OrdemServicoServiceTest.java` |
| **Testes automatizados (frontend)** | `frontend/src/lib/*.test.ts` | `sessionResilience.test.ts` |
| **Testes E2E (Playwright)** | `frontend/e2e/` | `login.spec.ts` |

---

## 📁 Estrutura do Repositório

```text
oficina/
├── frontend/                        # Aplicação Next.js 16.3.5
│   ├── src/
│   │   ├── app/                     # Rotas (App Router)
│   │   │   ├── (authenticated)/     # Layout protegido (requer login)
│   │   │   │   ├── dashboard/
│   │   │   │   ├── clientes/        # Lista + [id]/
│   │   │   │   ├── maquinas/        # Lista + [id]/
│   │   │   │   ├── ordens-servico/  # Lista + nova/ + [id]/
│   │   │   │   ├── produtos/
│   │   │   │   ├── estoque/         # Lista + movimentacoes/
│   │   │   │   └── relatorios/
│   │   │   └── login/
│   │   ├── components/              # Modais e componentes reutilizáveis (11)
│   │   └── lib/                     # API, types, helpers, testes (23 arquivos)
│   ├── e2e/                         # Testes E2E Playwright
│   ├── next.config.ts               # Rewrites + Security Headers
│   └── package.json
├── backend/                         # Spring Boot 3.4.3 / Java 21
│   ├── src/main/java/com/oficinagestao/
│   │   ├── config/                  # Swagger, OpenAPI, bootstrap, DotenvLoader
│   │   ├── controller/              # 12 controllers REST
│   │   ├── dto/                     # 53 DTOs (Java Records)
│   │   ├── entity/                  # 21 entidades JPA
│   │   ├── exception/               # GlobalExceptionHandler + tipos de exceção
│   │   ├── repository/              # 13 repositórios Spring Data JPA
│   │   ├── security/                # JWT, filtros, rate limiting, política de senha
│   │   └── service/                 # 13 services (regras de negócio)
│   ├── src/main/resources/
│   │   ├── application.properties   # Configurações (lê vars de ambiente)
│   │   └── db/migration/            # Migrations Flyway V1–V10
│   ├── src/test/                    # 261 testes automatizados
│   ├── pom.xml                      # Dependências Maven
│   └── mvnw.cmd / mvnw              # Maven Wrapper (não precisa instalar Maven)
├── docs/                            # Documentação técnica
│   ├── api.md                       # Documentação completa da API REST
│   ├── architecture.md              # Diretrizes arquiteturais
│   ├── database.md                  # Esquema e migrations do banco
│   ├── deployment.md                # Guia de implantação em produção
│   ├── development.md               # Guia de desenvolvimento local
│   ├── backup.md                    # Procedimentos de backup e restore
│   ├── release.md                   # Changelog e guia de homologação
│   └── roadmap.md                   # Roadmap de fases
├── scripts/                         # Utilitários de desenvolvimento
├── .env.example                     # Modelo de variáveis (copie para .env)
├── .env                             # Credenciais locais (ignorado pelo Git)
├── .gitignore
├── AGENTS.md                        # Regras fundamentais do projeto
└── README.md
```

---

## 📦 Módulos Implementados

| Módulo | Rotas | Endpoints REST | Testes |
|--------|-------|---------------|--------|
| Autenticação (JWT + Cookies) | `/login` | `/api/auth/*` | 43 |
| Dashboard | `/dashboard` | `/api/ordens-servico/contadores-*`, `/api/estoque/resumo` | 8 |
| Clientes | `/clientes`, `/clientes/[id]` | `/api/clientes/*` | 5+ |
| Equipamentos | `/maquinas`, `/maquinas/[id]` | `/api/maquinas/*` | 13 |
| Ordens de Serviço (8 status) | `/ordens-servico/*` | `/api/ordens-servico/*` | 55+ |
| Produtos / Peças | `/produtos` | `/api/produtos/*`, `/api/categorias/*` | 10+ |
| Estoque (lock pessimista) | `/estoque/*` | `/api/estoque/*` | 7 |
| Relatórios (6 abas + CSV) | `/relatorios` | `/api/relatorios/*` | 6 |
| Busca Rápida Global (Ctrl+K) | — | `/api/busca/rapida` | 7 |
| Fornecedores | — | `/api/fornecedores/*` | 5 |
| PDF Oficial A4 | — | `/api/ordens-servico/{id}/pdf` | 5 |
| Segurança / CSP / Headers | — | — | 15+ frontend |

---

## 🔒 Segurança

| Mecanismo | Implementação |
|-----------|--------------|
| Autenticação | JWT em cookies `HttpOnly` + `SameSite` |
| Access Token | 15 minutos (`900000 ms`) |
| Refresh Token | 7 dias (`604800000 ms`) — path restrito `/api/auth` |
| Refresh Silencioso | Mutex (`activeRefreshPromise`) — evita N chamadas paralelas |
| Rate Limiting | 5 tentativas / 15 min de bloqueio — por IP e por e-mail |
| Hash de senha | `BCryptPasswordEncoder` |
| Política de senha | Mínimo 12 chars + letra + número + especial + blocklist |
| CORS | Origens explícitas + `allowCredentials` |
| CSP | Diferenciado dev/prod — `frame-ancestors 'none'` |
| Headers HTTP | `X-Frame-Options: DENY`, `nosniff`, HSTS (prod), Referrer-Policy |
| SQL | Spring Data JPA parametrizado — sem concatenação de strings |
| Estoque | `SELECT FOR UPDATE` (lock pessimista) — impede saldo negativo |
| Proteção de rotas | Middleware Next.js + double-check `GET /api/auth/me` |

---

## 🗄 Banco de Dados — Migrations Flyway

| Migration | Conteúdo |
|-----------|---------|
| V1 | Schema inicial (usuarios, roles, clientes, produtos, fornecedores) |
| V2 | Simplificação de roles |
| V3 | Tabela `refresh_tokens` |
| V4 | Domínio de equipamentos (`maquinas`) |
| V5 | Domínio de ordens de serviço (8 status, itens, movimentações) |
| V6 | Ajustes em tipo de equipamento e checks |
| V7 | Constraints estoque ≥ 0 + índices de performance |
| V8 | Sequência de numeração `OS-YYYY-NNNN` |
| V9 | Campo `marca` em produto + seed de categorias padrão |
| V10 | FK composta OS → Maquina → Cliente (integridade referencial) |

---

## 🚀 Status do Projeto

- **Versão Atual**: Release 1.0.0 — **Homologado para Operação Piloto**
- **Tag Git Oficial**: `v1.0.0` | **Commit Baseline Fase 6.0**: `5089ce4`
- **Domínio**: Manutenção de máquinas de solda e geradores de energia
- **Testes Backend**: **261 testes** — 0 falhas, 0 erros, 0 ignorados ✅
- **Testes Frontend**: **247 testes** (103 suites) — 0 falhas ✅
- **TypeScript**: 0 erros (`tsc --noEmit`) ✅
- **ESLint**: 0 erros, 0 warnings ✅
- **Build Next.js**: 14 rotas — exit 0 ✅
- **npm audit**: 0 vulnerabilidades ✅
- **Banco de Dados**: Neon Serverless — branch `production`, região `aws-sa-east-1`
