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

---

## 4. Arquitetura da API e Padrões do Backend (Fase 3)

### 4.1. Fluxo em Camadas Obrigatório

```text
Requisição HTTP (JSON / Cookies)
              ↓
[ Controller ]  (Validação Bean Validation / DTOs de entrada, status HTTP)
              ↓
    [ DTO ]     (Objetos de transferência imutáveis / Java Records)
              ↓
  [ Service ]   (Regras de negócio, demarcação transacional, auditoria)
              ↓
[ Repository ]  (Spring Data JPA, interfaces tipadas)
              ↓
  [ Entity ]    (Mapeamento ORM Hibernate validado contra Neon)
```

#### Responsabilidades por Camada:
- **Controller**: Trata exclusivamente o protocolo HTTP, extrai headers/cookies/parâmetros, aciona validações de entrada (`@Valid`), delega ao Service e retorna DTOs tipados com códigos HTTP semânticos (200, 201, 204).
- **DTO**: Records imutáveis para transferência de dados. Nenhuma entidade JPA vaza para o cliente através do Controller.
- **Service**: Concentra toda a lógica de negócio, orquestração e demarcação de transações. Nunca recebe `HttpServletRequest` ou `HttpServletResponse` diretamente para lógica funcional (apenas para auditoria quando aplicável).
- **Repository**: Interfaces estendendo `JpaRepository`, consultas derivadas e JPQL seguro com binds parametrizados contra SQL Injection.
- **Entity**: Modelos JPA mapeados rigorosamente contra as tabelas gerenciadas pelo Flyway no PostgreSQL Neon.

### 4.2. Limites Transacionais
- **Leituras**: Métodos de leitura utilizam `@Transactional(readOnly = true)` para otimizar conexões JDBC, evitar dirty-checking desnecessário e permitir réplicas de leitura.
- **Escritas**: Métodos de criação, atualização ou exclusão utilizam `@Transactional` explícito, garantindo atomicidade estrita e rollback em falhas de execução.

### 4.3. Estrutura Modular de Pacotes
A aplicação foi reorganizada em pacotes modulares coesos:
- `com.oficinagestao.config`: Configurações do framework (OpenAPI/Swagger, bootstrap).
- `com.oficinagestao.security`: Filtros JWT, codificação BCrypt, CORS e SecurityFilterChain.
- `com.oficinagestao.auth`: DTOs, controllers e serviços de autenticação, rotação e encerramento de sessão.
- `com.oficinagestao.usuario`: Entidades (`Usuario`, `Role`, `RefreshToken`) e repositórios de usuários.
- `com.oficinagestao.auditoria`: Entidade, repositório e serviço desacoplado de auditoria de eventos.
- `com.oficinagestao.exception`: Hierarquia de exceções de negócio e `GlobalExceptionHandler`.
- `com.oficinagestao.common`: Contratos genéricos como `PageResponse<T>`, `SystemController` e endpoints utilitários.
- **Pacotes de Domínio Reservados**: `cliente`, `maquina`, `produto`, `estoque`, `fornecedor`, `ordem`, `relatorio`.

### 4.4. Tratamento Global de Exceções e Segurança de Informação
O `GlobalExceptionHandler` intercepta todas as exceções e produz respostas padronizadas via `ApiErrorResponse`:
- `MethodArgumentNotValidException` → `400 Bad Request` com mapa de campos inválidos.
- `BadCredentialsException` / `AuthenticationException` → `401 Unauthorized` com mensagem genérica (evita enumeração).
- `AccessDeniedException` → `403 Forbidden`.
- `ResourceNotFoundException` → `404 Not Found`.
- `ConflictException` → `409 Conflict`.
- `BusinessException` → `400 Bad Request`.
- `Exception` (inesperado) → `500 Internal Server Error` com mensagem genérica amigável. **Nenhum stack trace, detalhe SQL, schema de banco ou segredo é exposto**.

### 4.5. Documentação OpenAPI 3 / Swagger
Documentação interativa gerada automaticamente pelo SpringDoc OpenAPI (`/swagger-ui.html` e `/v3/api-docs`):
- Suporte a autenticação mista: Cookie `access_token` e Header `Authorization: Bearer <token>`.
- Modelagem precisa dos contratos de erro e paginação.

