# Guia de Implantação em Produção — Oficina Gestão

Este documento descreve a estratégia oficial, os requisitos e os procedimentos passo a passo para a implantação em ambiente de produção da aplicação **Oficina Gestão** (Release 1.0.0).

---

## 1. Visão Geral da Arquitetura de Produção

```text
       Navegador do Balcão / Usuária
                   │
                   ▼ (HTTPS / TLS 1.3)
      +──────────────────────────+
      │   Frontend (Next.js)     │  Hospedagem: Vercel / Cloudflare / Node
      │   Domínio: app.oficina...│  Next.js 16.3.5 (Turbopack)
      +──────────────────────────+
                   │
                   ▼ (REST JSON / Cookies HttpOnly Secure)
      +──────────────────────────+
      │   Backend (Spring Boot)  │  Hospedagem: Railway / Render / AWS App Runner
      │   Domínio: api.oficina...│  Java 21 (Docker ou Native Buildpack)
      +──────────────────────────+
                   │
                   ▼ (TLS com SSLMode=require / PgBouncer Pooler)
      +──────────────────────────+
      │   PostgreSQL (Neon)      │  Projeto: summer-frost-22688608 (aws-sa-east-1)
      │   Schema: neondb         │  Branch Produção: production (br-wispy-truth-acn1bsbe)
      +──────────────────────────+  Branch Dev Isolada: development (br-cool-feather-actev7kw)
```

---

## 2. Requisitos de Infraestrutura

1. **Protocolo HTTPS Estrito**: Toda comunicação externa deve trafegar sobre HTTPS com certificados TLS válidos (emitidos automaticamente via Let's Encrypt / Cloudflare).
2. **Isolamento de Ambientes no Neon**:
   - **Projeto**: `summer-frost-22688608` (Região `aws-sa-east-1` — São Paulo).
   - **Branch de Produção**: `production` (`br-wispy-truth-acn1bsbe`) — Branch padrão com endpoint dedicado e pooler ativo.
   - **Branch de Desenvolvimento Isolada**: `development` (`br-cool-feather-actev7kw`) — Criada a partir da produção para experimentos e testes futuros sem qualquer impacto em produção.
   - **Snapshot de Salvaguarda Pré-Release**: `snap-spring-thunder-acvzytef` (`snapshot-pre-release-1-0-0`) gerado antes do início da operação piloto.
3. **Gestão Segura de Segredos**: Nenhuma chave, senha ou token deve residir em código. Todas as credenciais são injetadas exclusivamente via painel de variáveis de ambiente do provedor de nuvem.

---

## 3. Matriz de Variáveis de Ambiente de Produção

### 3.1. Backend (Spring Boot)

| Variável | Descrição | Exemplo em Produção |
|---|---|---|
| `SERVER_PORT` | Porta HTTP interna do container | `8080` |
| `SPRING_PROFILES_ACTIVE` | Perfil ativo do Spring Boot | `prod` |
| `DB_URL` | URL JDBC de conexão com o pooler Neon (branch `production`) | `jdbc:postgresql://ep-proud-field-ac7s6w1q-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require` |
| `DB_USERNAME` | Usuário administrador do banco Neon | `neondb_owner` |
| `DB_PASSWORD` | Senha criptografada gerada no Neon | `[SENHA_FORTE_NEON_PROD]` |
| `JWT_SECRET` | Chave de assinatura HMAC-SHA256 (mínimo 64 caracteres hex/random) | `[CHAVE_ALEATORIA_ALTA_ENTROPIA_PROD]` |
| `JWT_EXPIRATION_MS` | Validade do Access Token (15 minutos) | `900000` |
| `SECURITY_COOKIE_SECURE` | Força flag `Secure` nos cookies HttpOnly | `true` |
| `CORS_ALLOWED_ORIGINS` | Origem autorizada do frontend em produção | `https://app.oficinagestao.com.br` |
| `INITIAL_ADMIN_EMAIL` | E-mail do usuário administrativo da proprietária | `oficina.soldas@oficinagestao.com.br` |
| `INITIAL_ADMIN_PASSWORD` | Senha forte inicial (mínimo 8 caracteres) | `[SENHA_INICIAL_ADMIN]` |
| `INITIAL_ADMIN_NAME` | Nome completo da dona da oficina | `Proprietária Oficina` |

### 3.2. Frontend (Next.js)

| Variável | Descrição | Exemplo em Produção |
|---|---|---|
| `NODE_ENV` | Modo de execução do Node | `production` |
| `NEXT_PUBLIC_API_URL` | URL base pública da API Spring Boot | `https://api.oficinagestao.com.br` |

---

## 4. Passo a Passo para Implantação

### Etapa 1: Validação do Banco de Dados Neon (Produção)
1. Acesse o console do [Neon](https://console.neon.tech).
2. Verifique a branch padrão `production` (`br-wispy-truth-acn1bsbe`) do projeto `summer-frost-22688608`.
3. Verifique a existência do snapshot de recuperação `snap-spring-thunder-acvzytef` (`snapshot-pre-release-1-0-0`).
4. Utilize a connection string do **Connection Pooler** (porta 5432 / pooled mode) com `sslmode=require`.
5. O Flyway aplica automaticamente todas as migrações estruturais `V1` até `V9` na inicialização do backend.

### Etapa 2: Implantação do Backend (Spring Boot)
1. Vincule o repositório GitHub ao serviço de nuvem (ex: Railway, Render ou AWS App Runner).
2. Configure o comando de build e execução:
   - Build: `./mvnw clean package -DskipTests`
   - Run: `java -Duser.timezone=America/Sao_Paulo -jar target/backend-0.0.1-SNAPSHOT.jar`
3. Configure todas as variáveis de ambiente descritas na seção 3.1.
4. Certifique-se de que a variável `SECURITY_COOKIE_SECURE` está definida como `true`.
5. Valide a inicialização através do endpoint de saúde:
   `GET https://api.oficinagestao.com.br/api/health` -> deve retornar `{"status":"UP"}` com HTTP 200.

### Etapa 3: Implantação do Frontend (Next.js)
1. Vincule o repositório à Vercel ou plataforma de hospedagem Next.js.
2. Defina o Root Directory como `frontend`.
3. Configure as variáveis de ambiente da seção 3.2.
4. Execute o build de produção: `npm run build`.
5. Valide se a tela de login carrega e se os cookies `HttpOnly` com flag `Secure` são configurados no handshake de autenticação.

---

## 5. Checklist de Verificação Pós-Deploy

- [ ] Endpoint `/api/health` retornando HTTP 200 e `{"status":"UP"}`.
- [ ] Cookies `access_token` e `refresh_token` recebendo as flags `HttpOnly`, `Secure` e `SameSite` corretas no navegador.
- [ ] Login da proprietária realizado com sucesso.
- [ ] Abertura de OS, inclusão de peça e conferência de dedução atômica no estoque.
- [ ] Download do PDF de Ordem de Serviço (`/api/ordens-servico/{id}/pdf`) abrindo em visualizador A4 sem falhas.
