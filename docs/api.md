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
