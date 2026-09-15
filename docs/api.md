# Padrões e Especificação de API — Oficina Gestão

## 1. Padrões REST

- **Formato**: JSON (`application/json; charset=UTF-8`)
- **Prefixação**: Todos os endpoints públicos e operacionais utilizam o prefixo `/api`
- **Códigos de Resposta**:
  - `200 OK`: Sucesso com retorno de payload
  - `201 Created`: Recurso criado com sucesso
  - `204 No Content`: Ação executada sem conteúdo retornado
  - `400 Bad Request`: Erro de validação ou parâmetros inválidos
  - `401 Unauthorized`: Autenticação ausente ou inválida
  - `403 Forbidden`: Sem permissão para o recurso solicitado
  - `404 Not Found`: Recurso não localizado
  - `500 Internal Server Error`: Falha interna do servidor

---

## 2. Endpoints da Fase 0 (Fundação)

### `GET /api/health`

Verifica a disponibilidade do serviço backend.

- **Método**: `GET`
- **URL**: `/api/health`
- **Autenticação**: Não requerida
- **Resposta Sucesso (200 OK)**:
  ```json
  {
    "status": "UP"
  }
  ```

---

## 3. Endpoints da Fase 2 e 2.1 (Autenticação da Proprietária e Hardening)

### `POST /api/auth/login`

Autentica a proprietária via e-mail e senha. Define cookies `HttpOnly` seguros para access token e refresh token. **Não expõe tokens JWT no corpo da resposta**. Registra auditoria com ação `LOGIN`.

- **Método**: `POST`
- **URL**: `/api/auth/login`
- **Autenticação**: Não requerida
- **Headers**: `Content-Type: application/json`
- **Corpo da Requisição**:
  ```json
  {
    "email": "admin@oficina.com",
    "senha": "sua_senha_segura"
  }
  ```
- **Resposta Sucesso (200 OK)**:
  - **Set-Cookie (Access)**: `access_token=<JWT>; Path=/; Max-Age=900; HttpOnly; SameSite=Lax`
  - **Set-Cookie (Refresh)**: `refresh_token=<UUID>; Path=/api/auth; Max-Age=604800; HttpOnly; SameSite=Strict`
  - **Body**:
    ```json
    {
      "user": {
        "id": 1,
        "nome": "Proprietária",
        "email": "admin@oficina.com",
        "roles": ["ROLE_ADMIN"]
      }
    }
    ```
- **Respostas de Erro**:
  - `400 Bad Request`: E-mail ou senha em branco/inválido.
  - `401 Unauthorized`: "Credenciais inválidas." (Protegido contra enumeração de usuários).

---

### `POST /api/auth/refresh`

Renova silenciosamente a sessão ativa utilizando o cookie `refresh_token`. Aplica rotação de token: invalida o refresh token utilizado e emite um novo par de tokens.

- **Método**: `POST`
- **URL**: `/api/auth/refresh`
- **Autenticação**: Não requerida via Authorization Header (controlada estritamente via Cookie `refresh_token`)
- **Headers**: Nenhum header adicional obrigatório (navegador anexa cookies automaticamente)
- **Resposta Sucesso (200 OK)**:
  - **Set-Cookie (Novo Access)**: `access_token=<Novo JWT>; Path=/; Max-Age=900; HttpOnly; SameSite=Lax`
  - **Set-Cookie (Novo Refresh)**: `refresh_token=<Novo UUID>; Path=/api/auth; Max-Age=604800; HttpOnly; SameSite=Strict`
  - **Body**:
    ```json
    {
      "user": {
        "id": 1,
        "nome": "Proprietária",
        "email": "admin@oficina.com",
        "roles": ["ROLE_ADMIN"]
      }
    }
    ```
- **Respostas de Erro**:
  - `401 Unauthorized`: Refresh token ausente, expirado ou revogado.

---

### `GET /api/auth/me`

Retorna os dados cadastrais e permissões do usuário logado na sessão atual.

- **Método**: `GET`
- **URL**: `/api/auth/me`
- **Autenticação**: Requerida (via Cookie `access_token` ou Header `Authorization: Bearer <token>`)
- **Resposta Sucesso (200 OK)**:
  ```json
  {
    "id": 1,
    "nome": "Proprietária",
    "email": "admin@oficina.com",
    "roles": ["ROLE_ADMIN"]
  }
  ```
- **Respostas de Erro**:
  - `401 Unauthorized`: Sessão inválida ou expirada.

---

### `POST /api/auth/logout`

Encerra a sessão, revoga o refresh token correspondente no banco de dados, expira ambos os cookies (`access_token` e `refresh_token`) e registra a auditoria com ação `LOGOUT`.

- **Método**: `POST`
- **URL**: `/api/auth/logout`
- **Autenticação**: Opcional (pública para limpeza de cookies; autenticada para auditoria vinculada)
- **Resposta Sucesso (200 OK)**:
  - **Set-Cookie**: `access_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`
  - **Set-Cookie**: `refresh_token=; Path=/api/auth; Max-Age=0; HttpOnly; SameSite=Strict`
  - **Body**: Vazio (200 OK)

---

## 4. Endpoints de Diagnóstico e Sistema (Fase 3)

### `GET /api/system/status`

Retorna informações operacionais do sistema backend, status do banco de dados e ambiente em execução.

- **Método**: `GET`
- **URL**: `/api/system/status`
- **Autenticação**: Requerida (perfil `ROLE_ADMIN`)
- **Resposta Sucesso (200 OK)**:
  ```json
  {
    "status": "UP",
    "timestamp": "2026-09-15T01:00:00Z",
    "database": "CONNECTED",
    "environment": "dev",
    "version": "1.0.0"
  }
  ```
- **Respostas de Erro**:
  - `401 Unauthorized`: Usuário não autenticado.
  - `403 Forbidden`: Usuário sem a autoridade `ROLE_ADMIN`.

---

## 5. Contrato Padrão de Erro (`ApiErrorResponse`)

Todas as respostas de erro da API (4xx e 5xx) seguem estritamente a seguinte estrutura JSON:

```json
{
  "timestamp": "2026-09-15T01:00:00.000Z",
  "status": 400,
  "error": "Bad Request",
  "message": "Erro de validação nos campos informados.",
  "path": "/api/exemplo",
  "details": {
    "campo": "mensagem específica de validação"
  }
}
```

- **Campos**:
  - `timestamp`: Data/hora ISO-8601 da ocorrência do erro.
  - `status`: Código HTTP semântico (400, 401, 403, 404, 409, 500).
  - `error`: Nome resumido do erro HTTP.
  - `message`: Descrição amigável e segura da causa.
  - `path`: URI requisitada.
  - `details`: Mapa opcional com detalhes de validação por campo (omitido quando vazio).
- **Segurança de Dados**: O contrato garante que **nenhuma** stack trace, comando SQL, nome interno de constraint ou segredo seja divulgado ao cliente.

---

## 6. Contrato Padrão de Paginação (`PageResponse<T>`)

Para listagens paginadas nos módulos de negócio, a resposta padronizada encapsula os dados e metadados de paginação:

```json
{
  "content": [
    { "id": 1, "nome": "Exemplo" }
  ],
  "pageNumber": 0,
  "pageSize": 20,
  "totalElements": 1,
  "totalPages": 1,
  "first": true,
  "last": true
}
```

---

## 7. Documentação OpenAPI 3 / Swagger UI

A documentação interativa e a especificação JSON estão disponíveis nos seguintes endpoints públicos:

- **Swagger UI (Interface Web)**: `http://localhost:8080/swagger-ui/index.html` (ou `/swagger-ui.html`)
- **OpenAPI JSON Spec**: `http://localhost:8080/v3/api-docs`
- **Esquemas de Autenticação Suportados**:
  - `cookieAuth`: Cookie `access_token` (padrão do navegador).
  - `bearerAuth`: Header `Authorization: Bearer <token>` (para testes via Swagger UI ou integrações).

