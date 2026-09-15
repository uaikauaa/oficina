# Oficina Gestão

Sistema web moderno e integrado para gestão de oficinas mecânicas e manutenção automotiva.

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

- **Fase Atual**: Fase 2 — Autenticação da Proprietária e Segurança (Concluída)
- **Status da Fase 2**: Implementado Spring Security com autenticação stateless JWT transmitido via cookie `HttpOnly` e header `Bearer`. Controle de acesso unificado para a proprietária (`ROLE_ADMIN`). Inicialização da conta via variáveis de ambiente (`INITIAL_ADMIN_*`). Registro de auditoria (`auditoria`) em login e logout. Frontend Next.js com tela de login responsiva (React Hook Form + Zod), middleware para proteção de rotas privadas (`/dashboard`) e dashboard inicial. Testes automatizados e builds validados com sucesso.
