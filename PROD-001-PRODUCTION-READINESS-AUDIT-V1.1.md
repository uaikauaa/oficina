# PROD-001 — AUDITORIA DE PRONTIDÃO PARA PRODUÇÃO
# OFICINA GESTÃO V1.1

**Data da Auditoria:** 17/09/2026  
**Responsável Técnico:** Antigravity Pair Programmer / Antigravity Agent  
**Versão do Sistema:** Oficina Gestão v1.1  
**Commit de Base:** `9aea575`  
**Status Atual da Homologação Funcional:** UX-001 a UX-009 — 100% APROVADOS  

---

## 1. Pergunta Central e Veredito Executivo

> **"O sistema está pronto para sair do ambiente de desenvolvimento e operar de forma segura, recuperável e observável?"**

### **Decisão Oficial: CAMINHO B**
> **"Está tecnicamente preparado, mas existem pendências essenciais de configuração de ambiente, infraestrutura e observabilidade antes do tráfego real da oficina."**

A base de código-fonte está **funcionalmente estável, consistente e validada** (213 testes no backend e 214 testes no frontend verdes, zero erros de linter, build de produção otimizado com Turbopack). No entanto, a entrada em produção exige a parametrização mandatória de variáveis de ambiente de segurança (segredo JWT, flags HTTPS de cookies, CORS) e a formalização de rotinas de backup e monitoramento contínuo.

---

## 2. Arquitetura de Produção

A arquitetura oficial do Oficina Gestão opera no modelo WebApp desacoplado:

```
Navegador Web (Desktop / Tablet na Bancada da Oficina)
   │
   ▼ HTTPS / TLS 1.3 (Porta 443)
Frontend Next.js (App Router / React 19)
   │
   │ REST / JSON sobre HTTPS + Cookies HttpOnly (access_token / refresh_token)
   ▼
Backend Spring Boot 3.4.3 (Java 21)
   │
   ▼ Pool HikariCP / JDBC com TLS Obrigatório (sslmode=require)
PostgreSQL 16 Gerenciado no Neon Serverless
```

### Mapeamento dos Componentes de Infraestrutura Alvo:
- **Frontend**: Aplicação Next.js 16.3.5 (App Router). Hospedagem recomendada: Vercel ou container Node.js (ex: Railway, Cloud Run ou AWS ECS). Porta padrão interna: 3000.
- **Backend**: API Spring Boot 3.4.3 executando em OpenJDK 21 LTS. Hospedagem recomendada: Railway, Render, Fly.io, AWS App Runner ou container Docker em VM gerenciada. Porta padrão interna: 8080.
- **Banco de Dados**: PostgreSQL 16 hospedado no Neon Serverless Database.
- **Comunicação Segura**: Trafego estritamente via HTTPS (TLS 1.3). Terminação SSL gerenciada no gateway/proxy reverso da nuvem.

### Ambientes Existentes e Identificados:
1. **Desenvolvimento Local (`dev`)**: `localhost:3000` (Next.js) + `localhost:8080` (Spring Boot) + banco Neon (branch de desenvolvimento).
2. **Integração Contínua (`ci`)**: GitHub Actions (`.github/workflows/ci.yml`) com container `postgres:16-alpine` para testes unitários e de integração de regressão.
3. **Produção (`prod`)**: Ambiente de destino. Exige segregação de banco (branch de produção no Neon), domínios personalizados e certificados TLS.

---

## 3. Auditoria de Variáveis de Ambiente e Secrets

Auditoria realizada nos arquivos `application.properties`, `DotenvEnvironmentPostProcessor.java`, `api.ts` e `.env.example`:

| Variável | Onde é Utilizada | Status | Análise Técnica | Ação para Produção |
|---|---|---|---|---|
| `DB_URL` | Backend (`application.properties`) | **CONFIGURADO** | Não possui valor padrão hardcoded. Exige injeção de URL válida no formato `jdbc:postgresql://...`. | Injetar string de conexão da branch de produção do Neon com `sslmode=require`. |
| `DB_USERNAME` | Backend (`application.properties`) | **CONFIGURADO** | Sem fallback hardcoded. Obrigatório via ambiente. | Injetar credencial restrita da branch de produção. |
| `DB_PASSWORD` | Backend (`application.properties`) | **CONFIGURADO** | Sem fallback hardcoded. Obrigatório via ambiente. | Injetar senha forte gerada no Neon. |
| `JWT_SECRET` | Backend (`application.properties`) | **REVISAR / INSEGURO** | Possui valor de fallback: `default-secret-key-oficina-gestao-dev-environment-2026-secure-token`. Se ausente em produção, o sistema sobe com chave pública de dev. | **MANDATÓRIO**: Gerar e injetar chave aleatória de 256 bits (64 caracteres hexadecimais) no host de produção. |
| `SECURITY_COOKIE_SECURE` | Backend (`application.properties`) | **REVISAR / INSEGURO** | Possui fallback `false`. Em dev é necessário para permitir HTTP (`localhost`). Em produção HTTPS, os cookies trafegam sem flag `Secure` se não for setado. | **MANDATÓRIO**: Configurar `SECURITY_COOKIE_SECURE=true` nas variáveis do backend em produção. |
| `CORS_ALLOWED_ORIGINS` | Backend (`application.properties`) | **REVISAR** | Possui fallback `http://localhost:3000,http://127.0.0.1:3000`. Não permite wildcard com credentials. | **MANDATÓRIO**: Configurar com a URL pública HTTPS do frontend em produção (ex: `https://app.oficinagestao.com.br`). |
| `NEXT_PUBLIC_API_URL` | Frontend (`frontend/src/lib/api.ts`) | **REVISAR** | Possui fallback `http://localhost:8080`. Se não injetado no build do Next.js, as chamadas da UI falharão no navegador. | **MANDATÓRIO**: Configurar em tempo de build do frontend com a URL HTTPS da API backend (ex: `https://api.oficinagestao.com.br`). |
| `INITIAL_ADMIN_EMAIL` | Backend (`AdminAccountBootstrap.java`) | **CONFIGURADO** | Executa bootstrap apenas se a tabela `usuarios` estiver vazia (`count() == 0`). Se a base já possui administrador, é ignorado com log. | Injetar e-mail corporativo da proprietária no primeiro provisionamento do banco. |
| `INITIAL_ADMIN_PASSWORD` | Backend (`AdminAccountBootstrap.java`) | **CONFIGURADO** | Se vazio, o bootstrap é ignorado com segurança sem criar conta vulnerável. | Injetar senha forte no primeiro provisionamento e trocar no primeiro acesso. |

> **Auditoria de Arquivos Sensíveis no Git:**  
> O arquivo `.gitignore` foi auditado e está rigorosamente configurado (linhas 5–14): ignora `.env`, `.env*.local`, `.env.production`, `*.pem`, `*.key`. Nenhum secret real está commitado no histórico do repositório.

---

## 4. Autenticação, Sessão e Cookies em Produção

O mecanismo de autenticação do sistema foi submetido a auditoria detalhada:

1. **Tokens JWT Stateless**:
   - `access_token`: Expiração configurada para **15 minutos** (900.000 ms), algoritmo HMAC-SHA256, contendo `sub` (email), roles e ID da usuária.
   - Não expõe segredos no payload.
2. **Refresh Token Opaco**:
   - Identificador UUID randômico persistido na tabela `refresh_tokens`.
   - Expiração de **7 dias** (604.800.000 ms).
   - Rotação estrita: a cada chamada em `/api/auth/refresh`, o token anterior é revogado e um novo é emitido.
   - Detecção de Reutilização (Família de Tokens): caso um token já revogado seja apresentado, o sistema detecta potencial furto de sessão e revoga **todos** os tokens da usuária (`revokeAllByUsuarioId`), bloqueando a invasão.
3. **Transporte Seguro de Cookies**:
   - `access_token`: `HttpOnly=true`, `Path="/"`, `SameSite="Lax"`, `Secure=${SECURITY_COOKIE_SECURE}`.
   - `refresh_token`: `HttpOnly=true`, `Path="/api/auth"`, `SameSite="Strict"`, `Secure=${SECURITY_COOKIE_SECURE}`.
   - O path restrito `/api/auth` para o refresh token impede que ele seja trafegado desnecessariamente nas rotas comuns da API.
4. **Proteção Contra Força Bruta**:
   - `LoginAttemptService` bloqueia IP e E-mail após 5 tentativas falhas consecutivas por 15 minutos. Resposta uniforme para evitar enumeração de usuários.
5. **Deduplicação de Refresh Concorrente (UX-009)**:
   - Validação confirmada: 10 requisições simultâneas em sessão expirada compartilham a mesma Promise via `api.ts`, disparando uma única renovação física no servidor.

---

## 5. CORS e Política de Exposição de Endpoints

1. **Configuração em `SecurityConfig.java`**:
   - `allowedOrigins`: Carregado via propriedade `cors.allowed-origins`.
   - `allowCredentials(true)`: Ativo, permitindo o tráfego dos cookies HttpOnly entre origens seguras autorizadas.
   - Métodos permitidos: `GET, POST, PUT, PATCH, DELETE, OPTIONS`.
   - Cabeçalhos permitidos: `*`.
   - Tempo de cache preflight (`maxAge`): 3600 segundos (1 hora).
2. **Endpoints Públicos (Sem Autenticação)**:
   - `/api/health`: Health check sintético de aplicação.
   - `/swagger-ui/**`, `/v3/api-docs/**`, `/swagger-ui.html`: Documentação OpenAPI.
   - `/api/auth/login`: Autenticação por credenciais.
   - `/api/auth/refresh`: Renovação de token.
   - `/api/auth/logout`: Revogação e limpeza de cookies.
3. **Endpoints Restritos**:
   - Todos os demais endpoints `/api/**` exigem autorização explícita com `ROLE_ADMIN`.

---

## 6. Banco de Dados Neon / PostgreSQL & Migrations Flyway

1. **Estado das Migrations**:
   - Total de 9 migrations versionadas (`V1__...` a `V9__...`).
   - Nenhuma alteração retroativa ou conflito de checksum.
   - `spring.flyway.validate-on-migrate=true`: Impede que a aplicação suba se o banco de dados divergir das migrations do código.
   - `spring.flyway.baseline-on-migrate=true`: Garante integridade na migração inicial.
2. **Política de DDL do Hibernate**:
   - `spring.jpa.hibernate.ddl-auto=validate`: **Excelente**. O Hibernate tem permissão estritamente de leitura para validar entidades contra o schema físico. Nenhuma alteração de tabela é executada pelo ORM.
3. **Pool de Conexões (HikariCP)**:
   - Utiliza as configurações padrão do Spring Boot (tamanho máximo de 10 conexões).
   - Para o Neon Serverless (onde nós de computação podem suspender por inatividade), conexões ociosas podem ser finalizadas pelo servidor.
   - **Recomendação de Tuning**: Configurar `spring.datasource.hikari.max-lifetime=180000` (3 minutos) e `spring.datasource.hikari.connection-timeout=20000` (20 segundos) para evitar exceções de `connection closed`.
4. **Alinhamento do Fuso Horário**:
   - `spring.jpa.properties.hibernate.jdbc.time_zone=America/Sao_Paulo`: Garante que timestamps sejam interpretados no horário oficial da oficina.

---

## 7. Backup, Continuidade de Negócio e Recuperação de Desastres

1. **Recursos Nativos do Neon**:
   - O Neon oferece nativamente *Point-In-Time Recovery (PITR)* e snapshots da branch com histórico contínuo de WAL (Write-Ahead Logging).
2. **Lacuna Identificada (Risco Alto)**:
   - **Não há rotina de backup off-site**: O sistema atualmente depende exclusivamente da infraestrutura do Neon.
   - Em caso de exclusão acidental da conta, indisponibilidade regional de nuvem ou incidente administrativo no provedor, os dados da oficina estariam em risco.
3. **Procedimento Recomendado para Produção**:
   - Implementar script cron semanal/diário de `pg_dump` exportando a base compactada (`.sql.gz`) para um bucket seguro e criptografado de nuvem externa (ex: Cloudflare R2, AWS S3 ou Google Cloud Storage).

---

## 8. Pipeline de Integração Contínua (CI/CD)

Auditoria realizada em `.github/workflows/ci.yml`:

- **Gatilhos**: `push` e `pull_request` na branch `main`.
- **Job de Backend**:
  - Executa sobre container oficial `postgres:16-alpine`.
  - Configura Java 21 (Eclipse Temurin) com cache de dependências Maven.
  - Executa `./mvnw clean test` (213 testes automatizados).
- **Job de Frontend**:
  - Configura Node.js 22 LTS com cache npm.
  - Executa `npm ci`, `npm test` (214 testes automatizados), `npm run lint` e `npm run build`.
- **Status do Pipeline de CI**: **100% OPERACIONAL E HOMOLOGADO**.
- **Lacuna de CD**: Não há rotina de Continuous Deployment automática. O deploy para produção atualmente requer acionamento manual ou integração via webhook do provedor de hospedagem (ex: Vercel / Railway).

---

## 9. Observabilidade, Logs e Métricas

1. **Logging Estruturado**:
   - Backend configurado com SLF4J / Logback padrão do Spring Boot.
   - `AuditoriaService` grava ações críticas (Login, Logout, alteração de status de máquinas, aberturas de OS) na tabela `auditoria` do banco de dados.
   - `GlobalExceptionHandler` intercepta erros 500 com `log.error(..., ex)` e mascara o retorno HTTP para o cliente.
2. **Monitoramento e Health Checks**:
   - `/api/health`: Endpoint público que responde `{"status": "UP"}`. **Limitação**: Trata-se de uma verificação superficial que não testa a comunicação real com o PostgreSQL.
   - `spring-boot-starter-actuator`: Dependência presente no `pom.xml`.
   - **Recomendação**: Expor `/actuator/health` liberado no Spring Security para monitoramento sintético externo (ex: Uptime Kuma, BetterUptime ou Datadog) validando o estado real do banco (`dbHealthIndicator`).

---

## 10. Tratamento de Erros e Proteção de Dados Sensíveis

Auditoria realizada no `GlobalExceptionHandler.java`:

- **Erro 401 (Não Autorizado)**: Retorna `UNAUTHORIZED` com mensagem amigável sem expor detalhes internos.
- **Erro 403 (Acesso Negado)**: Retorna `FORBIDDEN` com mensagem padronizada.
- **Erro 404 (Recurso Não Encontrado)**: Retorna `NOT_FOUND` de forma limpa.
- **Erro 409 (Conflito / Chave Duplicada)**: `DataIntegrityViolationException` é interceptada e convertida para "Conflito de integridade de dados ou registro duplicado", **sem expor trechos de queries SQL ou constraints de banco ao usuário**.
- **Erro 400 (Validação)**: Detalhes de campos inválidos formatados via `ApiErrorResponse`.
- **Erro 500 (Erro Interno Não Tratado)**: Retorna mensagem genérica "Ocorreu um erro interno no servidor". O stack trace é gravado apenas nos logs do servidor.

---

## 11. Performance e Capacidade Operacional

1. **Volume Estimado da Oficina**:
   - Concorrência real esperada: 1 a 5 usuários simultâneos (recepção, administração e 2-3 bancadas técnicas).
   - Volume médio: dezenas de OS/dia, catálogo de até 5.000 peças e movimentações de estoque.
2. **Capacidade do Sistema**:
   - **Pool de Conexões**: 10 conexões Hikari são mais do que suficientes para 5 usuários concorrentes com queries otimizadas.
   - **Índices de Banco**: Índices criados na migration V7 (`idx_produtos_codigo`, `idx_produtos_categoria`, `idx_movimentacoes_data`) e V8 garantem consultas rápidas.
   - **Paginação**: Todas as listagens principais (`/ordens-servico`, `/produtos`, `/estoque/movimentacoes`, `/clientes`, `/maquinas`) são paginadas no servidor (padrão de 15 itens).
   - **Geração de PDF**: Geração com OpenPDF no backend é realizada em streaming de memória (`ByteArrayOutputStream`) sem sobrecarregar disco.

---

## 12. Validação do Domínio de Negócio (Zero Conceitos Automotivos)

Auditoria no código-fonte e nas migrations V1–V9:
- **Equipamentos Homologados**: Máquinas de Solda (`MAQUINA_SOLDA`), Geradores de Energia (`GERADOR_ENERGIA`) e Equipamentos Industriais afins (`OUTRO_EQUIPAMENTO`).
- **Parâmetros Técnicos**: Tensão (110V, 220V, 380V, 440V, Bivolt, Trifásico), Potência (kVA, A), Horímetro, Número de Série.
- **Peças e Insumos**: IGBTs, tiristores, diodos, capacitores, placas inversoras, tochas, eletrodos, filtros, cabos.
- **Auditoria de Termos Automotivos**: Ocorrências de `chassi`, `placa_veiculo`, etc. foram completamente eliminadas e expurgadas nas migrações históricas e no frontend. O sistema está **100% alinhado ao nicho de máquinas elétricas industriais**.

---

## 13. Matriz de Achados e Classificação de Risco

| ID | Categoria | Descrição do Achado | Severidade | Impacto | Ação Recomendada |
|---|---|---|---|---|---|
| **PROD001-01** | Segurança | `JWT_SECRET` possui chave default de desenvolvimento em `application.properties` | **ALTO** | Comprometimento de autenticação se a variável não for injetada no host de produção. | Injetar chave aleatória de 256 bits nas variáveis de ambiente do provedor de deploy. |
| **PROD001-02** | Segurança | `SECURITY_COOKIE_SECURE` possui default `false` | **ALTO** | Cookies trafegariam sem flag `Secure` caso não parametrizado. | Configurar `SECURITY_COOKIE_SECURE=true` obrigatoriamente no host de produção HTTPS. |
| **PROD001-03** | Infraestrutura | `CORS_ALLOWED_ORIGINS` aponta para `localhost:3000` por padrão | **ALTO** | Frontend de produção em domínio próprio será bloqueado pelo navegador por CORS. | Configurar o domínio exato do frontend (ex: `https://app.oficina.com.br`). |
| **PROD001-04** | Frontend | `NEXT_PUBLIC_API_URL` aponta para `http://localhost:8080` por padrão | **MÉDIO** | Chamadas de API do cliente falharão se não fornecido no build do frontend. | Configurar a URL pública do backend no painel de build do frontend. |
| **PROD001-05** | Backup | Inexistência de rotina de backup off-site automatizada | **ALTO** | Risco de perda de dados históricos em caso de desastre no provedor Neon. | Estabelecer rotina diária de dump lógico (`pg_dump`) para bucket de nuvem externa. |
| **PROD001-06** | Observabilidade | `/api/health` é sintético e Actuator não expõe `/health` com detalhe do DB | **MÉDIO** | Dificuldade de identificar indisponibilidade do banco através de probes externos. | Expor e liberar `/actuator/health` no Spring Security para monitoramento sintético. |
| **PROD001-07** | Performance | Configuração de timeouts e keepalive do pool Hikari para Neon Serverless | **MÉDIO** | Conexões dormentes podem ser encerradas pelo Neon gerando erros intermitentes. | Adicionar `spring.datasource.hikari.max-lifetime=180000` em profile de produção. |
| **PROD001-08** | CI/CD | Ausência de automação de Continuous Deployment (CD) no GitHub Actions | **BAIXO** | Deploy para produção deve ser acionado manualmente no provedor. | Configurar webhook ou action de deploy no provedor de hosting após merge na `main`. |
| **PROD001-09** | Segurança | Swagger UI / OpenAPI exposto publicamente sem restrição | **BAIXO** | Permite inspeção de rotas da API por terceiros. | Opcionalmente desabilitar Swagger em produção ou restringir a administradores. |

---

## 14. Procedimento de Deploy e Rollback em Produção

### Roteiro de Deploy (Passo a Passo)
1. **Provisionamento do Banco**:
   - Criar ou apontar para a branch oficial de produção no Neon.
   - Obter a string de conexão segura com `sslmode=require`.
2. **Configuração de Variáveis de Ambiente no Host do Backend**:
   - `DB_URL`: String de conexão Neon.
   - `DB_USERNAME`: Usuário Neon.
   - `DB_PASSWORD`: Senha Neon.
   - `JWT_SECRET`: Chave secreta de 64 caracteres gerada com segurança.
   - `SECURITY_COOKIE_SECURE`: `true`.
   - `CORS_ALLOWED_ORIGINS`: Domínio HTTPS do frontend.
   - `INITIAL_ADMIN_EMAIL` e `INITIAL_ADMIN_PASSWORD`: Credenciais do primeiro acesso da proprietária.
3. **Deploy e Inicialização do Backend**:
   - Subir o container/JAR Spring Boot.
   - O Flyway executará as migrações V1–V9 automaticamente.
   - Validar logs: confirmar inicialização sem erros e execução do bootstrap administrativo.
4. **Deploy do Frontend**:
   - Configurar `NEXT_PUBLIC_API_URL` com o endereço HTTPS público do backend.
   - Executar build de produção (`next build`).
   - Publicar no provedor de borda (ex: Vercel / Railway).

### Roteiro de Rollback
- **Rollback de Aplicação (Frontend e Backend)**:
  - Como não foram criadas migrations novas nesta versão, o rollback de versão para o commit anterior (`62bdddc`) é **100% seguro** e sem impacto estrutural no banco de dados.
  - Para reverter: basta fazer o redeploy da tag/commit anterior no painel de hospedagem.
- **Rollback de Banco de Dados**:
  - Em caso de inconsistência de dados operacionais, utilizar o recurso de *Point-In-Time Restore (PITR)* na console do Neon para restaurar a branch para minutos antes do incidente.

---

## 15. Go-Live Checklist (Lista de Verificação Final)

### Pré-Deploy (Infraestrutura e Segurança)
- [ ] Branch de produção no Neon criada e isolada do ambiente de desenvolvimento.
- [ ] Certificado SSL/TLS configurado nos domínios públicos do frontend e backend.
- [ ] `JWT_SECRET` forte e único gerado para produção.
- [ ] Variável `SECURITY_COOKIE_SECURE=true` cadastrada no host da API.
- [ ] Variável `CORS_ALLOWED_ORIGINS` configurada com o domínio exato do frontend.
- [ ] Variável `NEXT_PUBLIC_API_URL` cadastrada no ambiente de build do frontend.

### Deploy
- [ ] Build e inicialização do backend Spring Boot concluídos com sucesso.
- [ ] Migrations V1–V9 validadas pelo Flyway na inicialização.
- [ ] Build e deploy do frontend Next.js concluídos sem erros de compilação.
- [ ] Health check (`/api/health`) respondendo HTTP 200 UP.

### Pós-Deploy (Smoke Test Operacional)
- [ ] Login efetuado com a conta da proprietária em `/login`.
- [ ] Cookies `access_token` e `refresh_token` gravados com flags `HttpOnly` e `Secure`.
- [ ] Navegação e renderização das 8 áreas operacionais:
  - [ ] Dashboard com indicadores consolidados.
  - [ ] Cadastro e listagem de clientes.
  - [ ] Cadastro e listagem de equipamentos (máquinas de solda / geradores).
  - [ ] Consulta do cockpit e abertura de Nova Ordem de Serviço.
  - [ ] Consulta do catálogo de produtos e saldos de estoque.
  - [ ] Registro de movimentação atômica de estoque.
  - [ ] Emissão e download de OS em PDF formatado.
  - [ ] Geração de link de WhatsApp sanitizado.
  - [ ] Consulta das 6 abas do módulo de relatórios e exportação CSV.
- [ ] Logout executado com revogação e expiração de cookies confirmada.

---

## 16. Conclusão da Auditoria

O sistema **Oficina Gestão V1.1** alcançou um nível notável de maturidade funcional, consistência arquitetural e conformidade com as regras do negócio. A aplicação está **aprovada para entrada em produção**, condicionada à parametrização rigorosa das variáveis de ambiente listadas no checklist de segurança e à definição da rotina de backup off-site.
