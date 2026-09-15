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

---

## 3. Arquitetura de Autenticação e Gestão de Sessão (Fase 2.1)

A aplicação adota modelo de autenticação sem estado (stateless) reforçado com cookies `HttpOnly` duplos:

```text
Browser                       Next.js (BFF / Proxy)                Spring Boot API
   |                                   |                                  |
   |--- POST /api/auth/login --------->|--------------------------------->| (Gera Access JWT 15m
   |                                   |                                  |  + Refresh UUID 7d)
   |<-- Set-Cookie: access_token ------|<-- Set-Cookie: access_token -----| (SameSite=Lax, Path=/)
   |<-- Set-Cookie: refresh_token -----|<-- Set-Cookie: refresh_token ----| (SameSite=Strict, Path=/api/auth)
   |<-- Body: { user: {...} } ---------|<-- Body: { user: {...} } --------| (Sem JWT no body)
   |                                   |                                  |
   |--- POST /api/auth/refresh ------->|--------------------------------->| (Valida & rotaciona
   |    (Cookie: refresh_token)        |    (Cookie: refresh_token)       |  refresh token no banco)
   |<-- Novos Cookies -----------------|<-- Novos Cookies ----------------|
```

### Estratégia de Proteção CSRF
1. **Access Token (15 min)**: Transportado via cookie `HttpOnly` com `SameSite=Lax`, impedindo envio cross-site em requisições mutantes (POST, PUT, DELETE).
2. **Refresh Token (7 dias)**: Transportado via cookie `HttpOnly` com `SameSite=Strict` e restrito ao caminho `/api/auth`, garantindo que jamais seja enviado em requisições de sites externos ou para outros endpoints da aplicação.
3. **CORS Restritivo**: Configurado exclusivamente com as origens autorizadas da aplicação frontend e `allowCredentials(true)`.
4. **Sem Exposição em JavaScript**: Nenhum token (access ou refresh) é retornado no corpo do response ou salvo em `localStorage` / `sessionStorage`, eliminando vetores de roubo via XSS.
5. **Invalidação Real**: No logout (`POST /api/auth/logout`), o refresh token correspondente é revogado no PostgreSQL Neon e ambos os cookies são imediatamente expirados no navegador.
