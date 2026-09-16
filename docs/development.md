# Guia de Desenvolvimento — Oficina Gestão

Este documento descreve os pré-requisitos e os passos para configurar o ambiente de desenvolvimento local do projeto **Oficina Gestão** (oficina técnica especializada em conserto, manutenção e reparo de máquinas de solda e geradores de energia).

## 1. Pré-Requisitos

- **Java JDK**: Versão 21 (LTS) instalada e configurada no PATH (`JAVA_HOME`).
- **Node.js**: Versão >= 20.x (recomendado LTS) e npm >= 10.x.
- **Git**: Versão recente.
- **Banco de Dados**: Conta e projeto no **Neon** (PostgreSQL Serverless).
- **Docker & Docker Compose**: Exclusivamente para execução de Testcontainers e serviços auxiliares locais. **O banco de desenvolvimento principal roda no Neon.**

---

## 2. Estrutura do Workspace

```text
oficina-gestao/
├── frontend/             # Next.js (App Router, Tailwind)
├── backend/              # Spring Boot (Java 21, JPA, Flyway, Maven Wrapper)
│   ├── src/main/java/com/oficinagestao/
│   │   ├── config/       # Swagger, OpenAPI, bootstrap
│   │   ├── controller/   # Endpoints REST (HTTP)
│   │   ├── dto/          # Records de entrada e saída
│   │   ├── entity/       # Entidades JPA
│   │   ├── exception/    # Exceções e handler global
│   │   ├── repository/   # Repositórios Spring Data
│   │   ├── security/     # JWT e configurações de segurança
│   │   └── service/      # Regras de negócio e transações
├── database/migrations/  # Espelho das migrations Flyway
├── docs/                 # Documentação técnica
├── scripts/              # Utilitários de desenvolvimento
├── .env.example          # Modelo de variáveis de ambiente
└── .env                  # Variáveis locais com credenciais (ignorado no Git)
```

---

## 3. Configuração do Banco de Dados (Neon)

1. Crie ou acesse seu projeto no [Neon](https://neon.tech).
2. Obtenha a connection string do banco de desenvolvimento.
3. Copie o arquivo `.env.example` para `.env` na raiz do projeto:
   ```bash
   cp .env.example .env
   # No Windows PowerShell: Copy-Item .env.example .env
   ```
4. Preencha as variáveis com as credenciais do seu banco Neon e configurações de segurança:
   ```env
   DB_URL=jdbc:postgresql://<neon-host>/neondb?sslmode=require
   DB_USERNAME=neondb_owner
   DB_PASSWORD=sua_senha_neon
   SERVER_PORT=8080

   # Segurança JWT
   JWT_SECRET=chave_secreta_jwt_de_pelo_menos_32_caracteres_aleatorios
   JWT_EXPIRATION_MS=86400000

   # Bootstrap da Proprietária (executado apenas se a tabela usuarios estiver vazia)
   INITIAL_ADMIN_NAME=Proprietária Oficina
   INITIAL_ADMIN_EMAIL=admin@oficina.com
   INITIAL_ADMIN_PASSWORD=sua_senha_segura
   ```
   > **Atenção:** O arquivo `.env` nunca deve ser versionado no Git. Se `INITIAL_ADMIN_EMAIL` ou `INITIAL_ADMIN_PASSWORD` não forem fornecidos, nenhuma conta fictícia é criada.

---

## 4. Executando o Backend (Spring Boot)

1. Acesse o diretório do backend:
   ```bash
   cd backend
   ```
2. Compile e execute os testes automatizados (valida compilação, conexão com Neon e migrations Flyway):
   ```bash
   ./mvnw clean test
   ```
   *(No Windows PowerShell: `.\mvnw.cmd clean test`)*
3. Inicie o servidor da aplicação:
   ```bash
   ./mvnw spring-boot:run
   ```
   *(No Windows PowerShell: `.\mvnw.cmd spring-boot:run`)*
4. A API estará acessível em `http://localhost:8080`.
   - Endpoint de verificação pública: `http://localhost:8080/api/health`
   - Documentação interativa Swagger UI: `http://localhost:8080/swagger-ui/index.html`
   - Especificação OpenAPI (JSON): `http://localhost:8080/v3/api-docs`
   - Endpoint autenticado de status (requer `ROLE_ADMIN`): `http://localhost:8080/api/system/status`
5. Na inicialização, o Flyway executa automaticamente as migrations pendentes localizadas em `src/main/resources/db/migration/` e o Hibernate valida o schema (`validate`).

---

## 5. Executando o Frontend (Next.js)

1. Acesse o diretório do frontend:
   ```bash
   cd frontend
   ```
2. Instale as dependências:
   ```bash
   npm install
   # No Windows se houver bloqueio de script: npm.cmd install
   ```
3. Execute o servidor de desenvolvimento:
   ```bash
   npm run dev
   # No Windows: npm.cmd run dev
   ```
4. A interface web estará acessível em `http://localhost:3000`.

---

## 6. Padrões de Qualidade e Boas Práticas

- Sempre execute os testes (`.\mvnw.cmd clean test`) e valide o build antes de submeter alterações.
- Nunca commite arquivos `.env`, credenciais ou arquivos gerados em diretórios de build (`target/`, `.next/`).
- O DBeaver pode ser utilizado para inspecionar o banco de dados Neon, mas alterações estruturais devem ser feitas exclusivamente via migrations Flyway.
