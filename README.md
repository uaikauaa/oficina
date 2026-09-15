# Oficina Gestão

Sistema web moderno e integrado para gestão de oficina técnica especializada em conserto, manutenção e reparo de máquinas de solda e geradores de energia.

## 🏛 Arquitetura

O projeto adota uma arquitetura em camadas exclusivamente **WebApp**:

- **Frontend**: Next.js (App Router), React, TypeScript, Tailwind CSS
- **Backend**: Java 21, Spring Boot (Spring Web, Spring Security, Spring Data JPA, Flyway, Jakarta Validation)
- **Banco de Dados**: PostgreSQL (Neon)
- **Comunicação**: REST API via JSON

```
Browser
   ↓
Next.js (Frontend)
   ↓ REST / JSON
Spring Boot (Backend)
   ↓
PostgreSQL / Neon (Banco de Dados)
```

> **Nota:** O frontend nunca acessa o banco de dados diretamente. Regras de negócio residem exclusivamente no backend.

---

## 📁 Estrutura do Repositório

```text
oficina-gestao/
├── frontend/             # Aplicação Next.js (Web)
├── backend/              # Aplicação Spring Boot (API REST)
├── database/             # Scripts e migrations (Flyway)
│   └── migrations/
├── docs/                 # Documentação técnica e arquitetural
├── scripts/              # Scripts auxiliares de automação/dev
├── .github/              # Configurações do GitHub e workflows de CI/CD
│   └── workflows/
├── AGENTS.md             # Regras fundamentais para agentes e devs
├── README.md             # Visão geral do projeto
└── .gitignore            # Regras de exclusão do Git
```

---

## 🚀 Status do Projeto

- **Fase Atual**: Fase 3 — Fundação da API e Padrões do Backend (Concluída)
- **Status da Fase 3**: Fundação arquitetural e padrões de API do Spring Boot estabelecidos. Reorganização modular em pacotes coesos (`config`, `security`, `auth`, `usuario`, `auditoria`, `exception`, `common` e pacotes de domínio reservados). Estabelecido o fluxo estrito `Controller -> DTO -> Service -> Repository -> Entity` com demarcação transacional (`@Transactional`). Padronização de respostas de erro sem vazamento de detalhes internos via `GlobalExceptionHandler` e `ApiErrorResponse`. Contrato genérico de paginação via `PageResponse<T>`. Documentação interativa via SpringDoc OpenAPI 3 / Swagger UI (`/swagger-ui.html` e `/v3/api-docs`) com suporte a Cookie e Bearer tokens. Endpoint autenticado de status `/api/system/status` restrito a `ROLE_ADMIN`. 40 testes automatizados no backend e builds 100% validados.
