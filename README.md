# Oficina Gestão

Sistema web moderno e integrado para gestão de oficina técnica especializada em conserto, manutenção e reparo de máquinas de solda e geradores de energia.

## 🏛 Arquitetura Simplificada

O projeto adota uma arquitetura limpa, direta e tradicional em camadas exclusivamente **WebApp**:

- **Frontend**: Next.js (App Router), React, TypeScript, Tailwind CSS
- **Backend**: Java 21, Spring Boot (Spring Web, Spring Security, Spring Data JPA, Flyway, Jakarta Validation)
- **Banco de Dados**: PostgreSQL (Neon Serverless)
- **Comunicação**: REST API via JSON

```text
Browser
   ↓
Next.js (Frontend)
   ↓ REST / JSON
Spring Boot (Backend)
   ↓
PostgreSQL / Neon (Banco de Dados)
```

> **Regra Fundamental:** O frontend nunca acessa o banco de dados diretamente. Regras de negócio residem exclusivamente no backend.

---

## 🧭 Como Encontrar Cada Parte do Sistema

| O que você quer alterar ou entender? | Onde fica no projeto? | Exemplo |
| :--- | :--- | :--- |
| **Telas, páginas e rotas visuais** | `frontend/src/app/` | `frontend/src/app/ordens-servico/page.tsx` |
| **Componentes de interface e modais** | `frontend/src/components/` | `frontend/src/components/ProdutoModal.tsx` |
| **Endpoints REST e rotas HTTP** | `backend/src/main/java/com/oficinagestao/controller/` | `OrdemServicoController.java` |
| **Regras de negócio e cálculos** | `backend/src/main/java/com/oficinagestao/service/` | `OrdemServicoService.java` |
| **Consultas e operações no banco** | `backend/src/main/java/com/oficinagestao/repository/` | `OrdemServicoRepository.java` |
| **Estrutura das tabelas (ORM / Entidades)** | `backend/src/main/java/com/oficinagestao/entity/` | `OrdemServico.java` |
| **Contratos de entrada/saída (DTOs / Records)** | `backend/src/main/java/com/oficinagestao/dto/` | `OrdemServicoCreateDTO.java` |
| **Scripts e migrações do banco (Flyway)** | `backend/src/main/resources/db/migration/` | `V5__create_ordens_servico_and_itens.sql` |
| **Segurança, JWT e autenticação** | `backend/src/main/java/com/oficinagestao/security/` | `SecurityConfig.java`, `JwtService.java` |

---

## 📁 Estrutura do Repositório

```text
oficina-gestao/
├── frontend/                     # Aplicação Next.js (Web)
│   └── src/
│       ├── app/                  # Rotas e páginas (App Router)
│       ├── components/           # Componentes e modais reutilizáveis
│       └── lib/                  # Chamadas de API (fetch), tipos e utilitários
├── backend/                      # Aplicação Spring Boot (API REST)
│   └── src/
│       ├── main/
│       │   ├── java/com/oficinagestao/
│       │   │   ├── config/       # Configurações (Swagger, OpenAPI, bootstrap)
│       │   │   ├── controller/   # Endpoints REST (recebimento HTTP)
│       │   │   ├── dto/          # Objetos de transferência de dados (Java Records)
│       │   │   ├── entity/       # Modelos JPA / Tabelas
│       │   │   ├── exception/    # Tratamento global de erros (GlobalExceptionHandler)
│       │   │   ├── repository/   # Interfaces Spring Data JPA
│       │   │   ├── security/     # Filtros JWT, CORS e autenticação
│       │   │   ├── service/      # Regras de negócio, transações e conversões
│       │   │   └── OficinaGestaoApplication.java
│       │   └── resources/
│       │       ├── application.properties
│       │       └── db/migration/ # Migrations SQL do Flyway (V1 a V6)
│       └── test/                 # Testes unitários e de integração
├── docs/                         # Documentação técnica e arquitetural
├── AGENTS.md                     # Regras fundamentais do projeto
└── README.md                     # Visão geral do projeto
```

---

## 🚀 Status do Projeto

- **Refatoração Estrutural**: Concluída com sucesso. O backend foi simplificado para a arquitetura tradicional em camadas (`controller`, `service`, `repository`, `entity`, `dto`, `exception`, `security`, `config`), eliminando classes `*Mapper` intermediárias e unificando a navegação.
- **Testes Automatizados**: 105 testes executados e aprovados (100% de aprovação, 0 falhas, 0 erros, 0 avisos de compilação).
- **Próximo Passo**: Fase 6 (Gestão de Estoque) no roadmap oficial.
