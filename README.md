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
| **Scripts e migrações do banco (Flyway)** | `backend/src/main/resources/db/migration/` | `V9__add_produto_marca_and_seed_categorias.sql` |
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
│       │       └── db/migration/ # Migrations SQL do Flyway (V1 a V9)
│       └── test/                 # Testes unitários, integração e smoke
├── docs/                         # Documentação técnica e operacional
│   ├── deployment.md             # Guia de implantação em produção
│   ├── backup.md                 # Procedimentos de backup e restore
│   ├── release.md                # Changelog e guia de homologação da Release 1.0.0
│   └── architecture.md           # Diretrizes arquiteturais
├── AGENTS.md                     # Regras fundamentais do projeto
└── README.md                     # Visão geral do projeto
```

---

## 🚀 Status do Projeto

- **Versão Atual**: Release 1.0.0 (Fases 0 a 10 concluídas — **Homologado para Operação Piloto**).
- **Tag Git Oficial**: `v1.0.0`
- **Domínio Especializado**: Manutenção, conserto e reparo de máquinas de solda e geradores de energia.
- **Módulos Entregues**: Autenticação stateless com JWT em cookies HttpOnly, Gestão de Clientes, Equipamentos Técnicos, Ordens de Serviço (ciclo completo de 8 etapas), Produtos/Peças, Controle Atômico de Estoque com Lock Pessimista, Busca Rápida Global (`Ctrl+K`), Histórico Técnico Linear, Geração de PDF Oficial A4, Impressão de Balcão e Relatórios Gerenciais (6 abas).
- **Testes Automatizados**: **152 testes automatizados** no backend aprovados com 100% de sucesso (0 falhas, 0 erros, 0 ignorados), incluindo teste de smoke end-to-end do ciclo operacional.
- **Frontend**: 0 erros de lint (`eslint`) e build de produção Next.js 16.3.5 / Turbopack concluído com êxito em 15 rotas otimizadas.
- **Banco de Dados Produção**: Neon Serverless (branch `production`, snapshot `snapshot-pre-release-1-0-0`, branch de desenvolvimento `development` isolada).
