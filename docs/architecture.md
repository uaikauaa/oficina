# Arquitetura do Sistema — Oficina Gestão

## 1. Visão Geral

O projeto **Oficina Gestão** foi concebido exclusivamente sob a arquitetura **WebApp**. Está vedado o uso de qualquer tecnologia desktop (JavaFX, FXML, Scene Builder, jpackage, etc.).

A solução é distribuída em três níveis principais:

```text
+-----------------------------------------------------------+
|                        Navegador                          |
+-----------------------------------------------------------+
                             |
                             v
+-----------------------------------------------------------+
|                     Frontend (Next.js)                    |
|  - React, TypeScript, Tailwind CSS, App Router            |
|  - Renderização Server/Client, Formulários com Zod        |
|  - Camada de visualização e orquestração de UI            |
+-----------------------------------------------------------+
                             |
                      HTTPS / REST (JSON)
                             |
                             v
+-----------------------------------------------------------+
|                   Backend (Spring Boot)                   |
|  - Java 21, Spring Web, Spring Security, Spring Data JPA  |
|  - Camada de Aplicação e Serviços                         |
|  - Regras de negócio estritas e validação de domínio      |
+-----------------------------------------------------------+
                             |
                            JDBC
                             |
                             v
+-----------------------------------------------------------+
|               Banco de Dados (PostgreSQL / Neon)          |
|  - Schema versionado exclusivamente via Flyway            |
|  - Sem acesso direto pelo Frontend                        |
+-----------------------------------------------------------+
```

---

## 2. Princípios de Isolamento e Segurança

1. **Frontend Isolado do Banco**: O Next.js nunca estabelece conexões diretas com o PostgreSQL ou Neon. Toda interação de dados é mediada pela API REST exposta pelo Spring Boot.
2. **Centralização de Regras de Negócio**: Regras de negócio, cálculos tributários, validações financeiras e transações operacionais residem estritamente no backend. O frontend realiza apenas validações de formato para melhor experiência do usuário (UX).
3. **Gestão de Segredos**: Nenhuma chave de API, credencial de banco ou segredo de assinatura de tokens é embutida no código-fonte ou versionada no Git. Variáveis de ambiente são carregadas em tempo de execução.
4. **Comunicação Segura**: Comunicação padronizada em JSON com contratos estritos validados via DTOs no backend e schemas Zod/TypeScript no frontend.
