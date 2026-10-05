# Guia de Desenvolvimento — Oficina Gestão

Este documento descreve os pré-requisitos e os passos para configurar o ambiente de desenvolvimento local do projeto **Oficina Gestão** (oficina técnica especializada em conserto, manutenção e reparo de máquinas de solda, geradores de energia, compressores e equipamentos industriais/elétricos).

---

## 1. Pré-Requisitos

- **Java JDK**: Versão 21 (LTS — Eclipse Adoptium Temurin recomendado) instalada e configurada no PATH (`JAVA_HOME`).
- **Node.js**: Versão >= 20.x (LTS) e npm >= 10.x.
- **Git**: Versão recente.
- **Banco de Dados**: Conta e projeto no **Neon** (PostgreSQL Serverless).
- **Docker & Docker Compose**: Opcional, reservado para execução de Testcontainers em testes isolados. **O banco de desenvolvimento principal conecta-se diretamente ao Neon.**

---

## 2. Estrutura do Workspace

```text
oficina/
├── frontend/             # Next.js 16 (App Router, React 19, Tailwind CSS 4)
├── backend/              # Spring Boot 3.4 (Java 21, JPA, Flyway, Maven Wrapper)
│   ├── src/main/java/com/oficinagestao/
│   │   ├── config/       # Swagger, OpenAPI, bootstrap, validadores
│   │   ├── controller/   # Endpoints REST (HTTP)
│   │   ├── dto/          # Records imutáveis de entrada e saída
│   │   ├── entity/       # Entidades JPA
│   │   ├── exception/    # Exceções e handler global
│   │   ├── repository/   # Repositórios Spring Data JPA
│   │   ├── security/     # JWT, 2FA, filtros e rate limiting
│   │   └── service/      # Regras de negócio, transações e e-mail
│   └── src/main/resources/
│       ├── application.properties
│       ├── application-dev.properties
│       ├── application-prod.properties
│       └── db/migration/ # 21 Migrations Flyway
├── docs/                 # Documentação técnica e arquitetura
├── .env.example          # Modelo oficial de variáveis de ambiente
└── .env                  # Variáveis locais com credenciais (ignorado no Git)
```

---

## 3. Configuração do Banco de Dados (Neon) e Variáveis Locais

1. Crie ou acesse seu projeto no [Neon](https://neon.tech).
2. Obtenha a connection string do banco de desenvolvimento (SSL mode obrigatório: `sslmode=require`).
3. Copie o arquivo `.env.example` para `.env` na raiz do projeto:
   ```bash
   cp .env.example .env
   # No Windows PowerShell: Copy-Item .env.example .env
   ```
4. Preencha as variáveis com suas credenciais de desenvolvimento (utilize placeholders seguros):
   ```env
   # Banco de Dados Neon
   DB_URL=jdbc:postgresql://<seu-endpoint-neon>.sa-east-1.aws.neon.tech/neondb?sslmode=require
   DB_USERNAME=neondb_owner
   DB_PASSWORD=sua_senha_neon
   SERVER_PORT=8080

   # Segurança JWT
   JWT_SECRET=chave_secreta_jwt_de_pelo_menos_32_caracteres_aleatorios_123

   # Configuração de CORS
   CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

   # Configuração SMTP para 2FA (Gmail)
   MAIL_HOST=smtp.gmail.com
   MAIL_PORT=587
   MAIL_SMTP_AUTH=true
   MAIL_SMTP_STARTTLS=true
   MAIL_USERNAME=seu_email@gmail.com
   MAIL_PASSWORD=sua_app_password_google
   MAIL_FROM=seu_email@gmail.com

   # Bootstrap da Proprietária (executado apenas se a tabela usuarios estiver vazia)
   INITIAL_ADMIN_NAME=Proprietária Oficina
   INITIAL_ADMIN_EMAIL=seu_email@exemplo.com
   INITIAL_ADMIN_PASSWORD=sua_senha_segura_123
   ```
   > **Atenção:** O arquivo `.env` nunca deve ser versionado no Git. `INITIAL_ADMIN_PASSWORD` é somente o seed do primeiro provisionamento; alterar essa variável não redefine a senha de uma conta existente.

### Banco exclusivo para testes

Os testes de integração usam PostgreSQL real e exigem um banco local exclusivo cujo nome termine em `_test`. Eles nunca reutilizam `DB_URL`, `DB_USERNAME` ou `DB_PASSWORD`.

```powershell
docker run --name oficina-postgres-test -e POSTGRES_DB=oficina_gestao_test -e POSTGRES_USER=oficina_test -e POSTGRES_PASSWORD=oficina_test -p 5432:5432 -d postgres:16-alpine
$env:TEST_DB_URL='jdbc:postgresql://localhost:5432/oficina_gestao_test'
$env:TEST_DB_USERNAME='oficina_test'
$env:TEST_DB_PASSWORD='oficina_test'
cd backend
.\mvnw.cmd clean test
```

Se `TEST_DB_URL` estiver ausente, apontar para Neon/host remoto ou usar um banco sem o sufixo `_test`, a suíte aborta antes de inicializar o datasource.

---

## 4. Executando o Backend (Spring Boot)

1. Acesse o diretório do backend:
   ```bash
   cd backend
   ```
2. Inicie o servidor da aplicação via Maven Wrapper:
   ```bash
   ./mvnw spring-boot:run
   ```
   *(No Windows PowerShell: `.\mvnw.cmd spring-boot:run`)*
3. A API estará acessível em `http://localhost:8080`.
   - Endpoint de saúde pública: `http://localhost:8080/api/health`
   - Documentação interativa Swagger UI (dev): `http://localhost:8080/swagger-ui/index.html`
   - Especificação OpenAPI (JSON): `http://localhost:8080/v3/api-docs`
4. Na inicialização, o Flyway aplica automaticamente todas as 21 migrations pendentes localizadas em `src/main/resources/db/migration/` e o Hibernate valida o schema (`ddl-auto=validate`).

---

## 5. Executando o Frontend (Next.js)

1. Abra um segundo terminal e acesse o diretório do frontend:
   ```bash
   cd frontend
   ```
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
4. A interface web estará acessível em `http://localhost:3000`.
   > O Next.js possui rewrite configurado para redirecionar `/api/*` para `http://localhost:8080/api/*`.

---

## 6. Padrões de Qualidade e Testes Automatizados

O projeto mantém rigoroso padrão de qualidade assegurado por testes automatizados contínuos:

- **Testes Automatizados do Backend**:
  ```bash
  cd backend
  .\mvnw.cmd clean test
  # No Linux/macOS: ./mvnw clean test
  ```
  Executa a suíte de **477 testes** unitários, de segurança e de integração com PostgreSQL Neon (0 falhas, 0 erros, 0 ignorados).

- **Testes Automatizados do Frontend**:
  ```bash
  cd frontend
  npm test
  ```
  Executa a suíte de **306 testes** em 122 suites via Node.js Native Test Runner (`node:test` e `node:assert/strict` sobre `src/lib/*.test.ts`) com 0 falhas.

- **Verificação de Tipagem TypeScript**:
  ```bash
  cd frontend
  npx tsc --noEmit
  ```
  Valida strict mode sem erros de compilação (0 erros).

- **Linter de Código**:
  ```bash
  cd frontend
  npm run lint
  ```
  Garante 0 erros e 0 warnings no ESLint.

- **Build de Produção do Frontend**:
  ```bash
  cd frontend
  npm run build
  ```
  Compilação e otimização das 15 rotas estáticas e dinâmicas da aplicação.

- **Boas Práticas de versionamento:**
  - Nunca commite arquivos `.env`, credenciais ou chaves privadas.
  - O DBeaver pode ser utilizado para inspecionar o banco de dados Neon, mas alterações estruturais devem ser feitas exclusivamente via migrations Flyway versionadas.
