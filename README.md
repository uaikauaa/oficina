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

- **Fase Atual**: Fase 4A — Módulo de Clientes (Concluída)
- **Status da Fase 4A**: Implementação completa do módulo de Clientes (Pessoa Física e Pessoa Jurídica) para a oficina de manutenção de máquinas de solda e geradores. Backend estruturado em `Controller -> DTO -> Service -> Repository -> Entity` com validações estritas de duplicidade (CPF, CNPJ, telefone/celular, razão social) e registro de auditoria. Endpoints REST paginados (`GET`, `POST`, `PUT`, `PATCH /status`) e documentados via OpenAPI/Swagger. Frontend Next.js com páginas `/clientes` (tabela responsiva, pesquisa, filtros, paginação, modais) e `/clientes/[id]` (detalhes, contatos, endereços e estrutura reservada para histórico futuro de equipamentos). 53 testes automatizados no backend e builds 100% validados.
