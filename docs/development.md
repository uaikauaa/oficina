# Guia de Desenvolvimento — Oficina Gestão

Este documento descreve os pré-requisitos e os passos para configurar o ambiente de desenvolvimento local.

## 1. Pré-Requisitos

- **Java JDK**: Versão 21 (LTS) instalada e configurada no PATH (`JAVA_HOME`).
- **Node.js**: Versão >= 20.x (recomendado LTS) e npm >= 10.x.
- **Git**: Versão recente.
- **Docker & Docker Compose**: Para execução de serviços auxiliares locais quando necessário.

---

## 2. Estrutura do Workspace

```text
oficina-gestao/
├── frontend/             # Next.js
├── backend/              # Spring Boot (Maven Wrapper)
├── database/migrations/  # Migrations Flyway
├── docs/                 # Documentação
└── scripts/              # Utilitários de desenvolvimento
```

---

## 3. Executando o Backend (Spring Boot)

1. Acesse o diretório do backend:
   ```bash
   cd backend
   ```
2. Compile e execute os testes:
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
   - Endpoint de saúde: `http://localhost:8080/api/health`

---

## 4. Executando o Frontend (Next.js)

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

## 5. Padrões de Qualidade e Boas Práticas

- Sempre rode os testes e valide o build antes de submeter alterações.
- Nunca commite arquivos `.env`, credenciais ou arquivos gerados em diretórios de build (`target/`, `.next/`).
