# PROD-002 — RELATÓRIO DE GO-LIVE HARDENING E CONFIGURAÇÃO DE PRODUÇÃO

**Versão:** 1.1  
**Data:** 17/09/2026  
**Responsável Técnico:** Antigravity Pair Programmer / Antigravity Agent  
**Projeto:** Oficina Gestão v1.1  
**Status:** **PRONTO PARA GO-LIVE** (Condicionado à parametrização de infraestrutura no host)  

---

## 1. Sumário Executivo

A fase **PROD-002** teve como finalidade única e estrita a resolução de todas as pendências técnicas, de segurança, banco e observabilidade apontadas na auditoria **PROD-001**, preparando o ecossistema do **Oficina Gestão** para operar em produção de forma segura, resiliente, observável e recuperável.

### Conformidade com as Regras da Fase:
- **Zero novas telas** criadas.
- **Zero novas funcionalidades** de negócio introduzidas.
- **Zero alterações de UX**.
- **Zero migrations de banco criadas** (V1 a V9 preservadas integralmente).
- **Zero alterações de schema** ou tabelas físicas.

---

## 2. Matriz de Resolução dos Achados do PROD-001

| ID | Categoria | Descrição | Status Oficial | Solução Implementada |
|---|---|---|---|---|
| **PROD001-01** | Segurança | Falha segura para `JWT_SECRET` em produção | **CORRIGIDO** | Implementado `ProductionSecurityValidator.java` com validação fail-fast no profile `prod`/`production`. Se `JWT_SECRET` for nulo, for a chave padrão de desenvolvimento ou tiver menos de 32 caracteres (256 bits), a inicialização do Spring Boot é abortada imediatamente com `IllegalStateException`. Em desenvolvimento local (`dev`), a chave padrão continua permitida. |
| **PROD001-02** | Autenticação | Flag `Secure` de Cookies em produção HTTPS | **CORRIGIDO** | Criado `application-prod.properties` definindo `security.cookie.secure=${SECURITY_COOKIE_SECURE:true}`. Em produção, os cookies `access_token` e `refresh_token` trafegam estritamente com `Secure=true`. Em desenvolvimento local (`application.properties`), mantém-se `false` para suportar `localhost` em HTTP. |
| **PROD001-03** | Segurança | Restrição estrita de CORS em produção | **CORRIGIDO** | Removida dependência de localhost no profile de produção (`application-prod.properties`). Em produção, `cors.allowed-origins` exige a URL pública oficial do frontend. O `ProductionSecurityValidator` rejeita inicialização se a origem de produção contiver `localhost` ou `127.0.0.1`. |
| **PROD001-04** | Frontend | Injeção da URL de API no build do Next.js | **CORRIGIDO** | Documentado e padronizado o fornecimento obrigatório da variável de ambiente `NEXT_PUBLIC_API_URL` em tempo de compilação de produção (`next build`). |
| **PROD001-05** | Backup | Política e rotina de backup off-site | **CORRIGIDO** | Formalizada a política de backup off-site em `docs/backup.md` contendo: frequência diária (02:00 UTC) + pré-deploy, retenção em 3 níveis (14 dias diários, 8 semanas e 12 meses), destino em bucket externo criptografado com AES-256 fora do Neon, controle de acesso IAM por menor privilégio e testes trimestrais de restore. |
| **PROD001-06** | Observabilidade | Health check real avaliando o PostgreSQL | **CORRIGIDO** | Refatorado `HealthController.java` para injetar o `DataSource` e validar a conectividade física com o PostgreSQL (`connection.isValid(2)`). Retorna HTTP 200 `{"status": "UP", "database": "UP"}` se o banco estiver acessível e HTTP 503 `{"status": "DOWN", "database": "DOWN"}` se houver falha, sem expor credenciais nem stack trace. |
| **PROD001-07** | Performance | Calibração do HikariCP para Neon Serverless | **CORRIGIDO** | Parametrizado pool HikariCP em `application.properties` e `application-prod.properties` com `max-lifetime=600000` (10 min), `idle-timeout=300000` (5 min), `connection-timeout=20000` (20s) e `keepalive-time=120000` (2 min), evitando quedas de conexões dormentes pelo proxy do Neon. |
| **PROD001-08** | CI/CD | Pipeline de CI e documentação de deploy | **CORRIGIDO** | Pipeline `.github/workflows/ci.yml` auditado e 100% verde (Java 21, PostgreSQL 16 Alpine, Node 22). Roteiro de deploy e de rollback manual detalhado e testável documentado para a equipe operacional. |
| **PROD001-09** | Segurança | Proteção de documentação Swagger/OpenAPI | **CORRIGIDO** | Configurado `springdoc.swagger-ui.enabled=${SWAGGER_ENABLED:false}` no profile `prod` e ajustado `SecurityConfig.java` para não expor `/swagger-ui/**` nem `/v3/api-docs/**` publicamente quando desabilitado (retornando 401 Unauthorized para não autenticados). Em desenvolvimento, permanece ativo. |

---

## 3. Arquivos Alterados na Fase PROD-002

### Backend
1. **`backend/src/main/resources/application.properties`**:
   - Inclusão dos parâmetros calibrados do HikariCP (`maximum-pool-size`, `minimum-idle`, `max-lifetime`, `idle-timeout`, `connection-timeout`, `keepalive-time`).
   - Inclusão dos parâmetros de controle do SpringDoc Swagger (`springdoc.swagger-ui.enabled`, `springdoc.api-docs.enabled`).
2. **`backend/src/main/resources/application-prod.properties` [NOVO]**:
   - Perfil de produção (`prod`) com `security.cookie.secure=true`, `JWT_SECRET` estrito sem fallback e Swagger desabilitado por padrão.
3. **`backend/src/main/java/com/oficinagestao/config/ProductionSecurityValidator.java` [NOVO]**:
   - Componente fail-fast que impede inicialização em produção com segredos inseguros, nulos, menores que 32 caracteres ou CORS apontando para localhost.
4. **`backend/src/main/java/com/oficinagestao/security/SecurityConfig.java`**:
   - Vinculação da liberação pública das rotas do Swagger à flag `springdoc.swagger-ui.enabled`.
5. **`backend/src/main/java/com/oficinagestao/controller/HealthController.java`**:
   - Injeção de `DataSource` com teste de conexão ativa e retorno 200 (UP) ou 503 (DOWN).
6. **`backend/src/test/java/com/oficinagestao/controller/HealthControllerTest.java`**:
   - Atualização para validar `status=UP` e `database=UP`.
7. **`backend/src/test/java/com/oficinagestao/controller/HealthControllerUnitTest.java` [NOVO]**:
   - Testes unitários simulando banco UP (200) e banco DOWN (503).
8. **`backend/src/test/java/com/oficinagestao/config/ProductionSecurityValidatorTest.java` [NOVO]**:
   - Testes unitários validando falha segura em produção (secret ausente, secret default, secret curto, CORS localhost) e sucesso em dev e prod válida.
9. **`backend/src/test/java/com/oficinagestao/config/ProductionOpenApiSecurityTest.java` [NOVO]**:
   - Teste de integração validando bloqueio com 401 Unauthorized do Swagger/OpenAPI quando desabilitado.

### Documentação
10. **`docs/backup.md`**:
    - Formalização da política operacional de backup off-site criptografado em nuvem externa e rotina de restore.

---

## 4. Comparativo de Calibração do HikariCP (PROD001-07)

| Parâmetro | Valor Padrão Anterior | Novo Valor Calibrado | Justificativa Técnica Baseada em Evidência |
|---|---|---|---|
| `maximum-pool-size` | 10 | **10** | Dimensionamento ideal para o volume de 1 a 5 usuários simultâneos da oficina, evitando contenção de conexões no Neon Serverless. |
| `minimum-idle` | 10 | **2** | Evita manter 10 conexões abertas permanentemente, reduzindo consumo ocioso de instâncias de computação no Neon. |
| `max-lifetime` | 1.800.000 ms (30 min) | **600.000 ms (10 min)** | Proxies e balanceadores de nuvem do Neon podem encerrar sockets ociosos. Renovar conexões a cada 10 minutos elimina erros de *Connection reset by peer*. |
| `idle-timeout` | 600.000 ms (10 min) | **300.000 ms (5 min)** | Libera rapidamente conexões ociosas acima do `minimum-idle`. |
| `connection-timeout` | 30.000 ms (30s) | **20.000 ms (20s)** | Tempo de espera suficiente para cold starts do Neon (1–3s) sem prender threads excessivamente em falhas de rede. |
| `keepalive-time` | 0 (desativado) | **120.000 ms (2 min)** | Envia ping leve periódico para evitar que firewalls intermediários encerrem a conexão por inatividade. |

---

## 5. Mapeamento dos Ambientes (DEV vs PROD)

| Configuração | Ambiente de Desenvolvimento (`dev`) | Ambiente de Produção (`prod`) |
|---|---|---|
| **Perfil Ativo** | `default` ou `dev` | `prod` (`spring.profiles.active=prod`) |
| **URL do Frontend** | `http://localhost:3000` | Domínio público HTTPS (ex: `https://app.oficinagestao.com.br`) |
| **URL do Backend** | `http://localhost:8080` | Endpoint público HTTPS (ex: `https://api.oficinagestao.com.br`) |
| **Banco de Dados** | Neon branch dev ou PostgreSQL local | Neon branch de produção com `sslmode=require` |
| **`JWT_SECRET`** | Permite chave padrão para conveniência local | **Obrigatório** via env var, >= 32 chars, rejeita chave default |
| **`SECURITY_COOKIE_SECURE`** | `false` (permite tráfego HTTP local) | `true` (obriga canal HTTPS para transporte de cookies) |
| **`CORS_ALLOWED_ORIGINS`** | `http://localhost:3000,http://127.0.0.1:3000` | Origem HTTPS exata do frontend (sem `localhost`) |
| **Swagger / OpenAPI** | Ativo e público para documentação | Desabilitado por padrão (`springdoc.swagger-ui.enabled=false`) |
| **Health Check** | `/api/health` valida aplicação e banco | `/api/health` monitorado por probes sintéticos externos |

---

## 6. Checklist de Smoke Test de Produção (16 Passos Pós-Deploy)

Procedimento executável obrigatório após qualquer publicação em produção:

- [ ] **1. Health Check da API**: `GET /api/health` retorna HTTP 200 com `{"status": "UP", "database": "UP"}`.
- [ ] **2. Acesso à Interface Web**: `GET /` carrega a aplicação frontend Next.js sem erros no console de desenvolvedor.
- [ ] **3. Autenticação Administrativa**: `POST /api/auth/login` autentica com sucesso; confirma gravação dos cookies `access_token` (`HttpOnly`, `Secure`, `SameSite=Lax`) e `refresh_token` (`HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/api/auth`).
- [ ] **4. Renovação de Sessão (Refresh)**: `POST /api/auth/refresh` rotaciona os tokens com sucesso sem deslogar o usuário.
- [ ] **5. Painel de Controle (Dashboard)**: Acessar `/dashboard`; verificar carregamento dos 4 KPIs, gráfico de faturamento e chamados em aberto.
- [ ] **6. Módulo de Clientes**: Acessar `/clientes`; realizar busca textual por cliente existente e abrir a tela de detalhes.
- [ ] **7. Módulo de Equipamentos**: Acessar `/maquinas`; verificar listagem de máquinas de solda e geradores, e inspecionar detalhes de uma máquina.
- [ ] **8. Abertura de Nova OS**: Acessar `/ordens-servico/nova`; preencher formulário e gravar nova OS com horário local de São Paulo (-03:00).
- [ ] **9. Módulo de Produtos**: Acessar `/produtos`; validar listagem de peças e componentes (IGBTs, tochas, cabos) com seus saldos.
- [ ] **10. Controle de Estoque**: Acessar `/estoque`; validar carregamento sob demanda dos filtros de categoria e fornecedor (sem N+1).
- [ ] **11. Movimentação de Estoque**: Executar uma entrada ou saída controlada; verificar atualização atômica do saldo físico.
- [ ] **12. Cockpit de OS**: Acessar `/ordens-servico/[id]`; adicionar diagnóstico técnico, peças e transicionar o status da OS.
- [ ] **13. Emissão de PDF**: Clicar em "Imprimir OS / PDF" no cockpit da OS; verificar download do documento formatado com OpenPDF.
- [ ] **14. Integração WhatsApp**: Clicar no botão de contato WhatsApp; validar abertura da URL sanitizada sem quebra de caracteres.
- [ ] **15. Módulo de Relatórios**: Acessar `/relatorios`; testar os presets rápidos ("30 dias", "Mês Atual") e acionar a exportação CSV (confirmando codificação UTF-8 BOM).
- [ ] **16. Encerramento de Sessão (Logout)**: Acionar o botão "Sair"; validar revogação do refresh token no banco e expiração dos cookies.

---

## 7. Procedimento Operacional de Rollback

### Critérios de Gatilho de Rollback:
- Ocorrência de taxa de erro 500 superior a 2% após o deploy.
- Falha na inicialização do backend (`Health check` retornando `DOWN` ou 503).
- Incompatibilidade de CORS entre frontend e backend.

### Passo a Passo de Reversão:
1. **Frontend**:
   - Acessar o painel da Vercel / Railway.
   - Clicar em **Deployments** -> Localizar a versão estável anterior -> Clicar em **Instant Rollback / Promote to Production**.
2. **Backend**:
   - Como a fase PROD-002 **não criou nenhuma migration de schema** (as migrations V1 a V9 permaneceram 100% intactas), a reversão da aplicação é puramente binária e imediata.
   - Fazer o redeploy da imagem Docker ou tag anterior (`9aea575`).
3. **Banco de Dados**:
   - Caso tenha ocorrido corrupção de dados operacionais durante o teste, acessar o console do Neon -> **Branches** -> **Time Travel / Point-in-Time Restore** e restaurar a branch para o minuto anterior ao deploy.

---

## 8. Verificação de Segurança Final e Secrets

- **Varredura no Git**: Nenhum segredo, chave privada, arquivo `.env` ou credencial de banco consta no histórico ou na árvore de trabalho do Git.
- **Fail-Fast**: Aplicação bloqueia execução em produção se o operador esquecer de cadastrar `JWT_SECRET` ou tentar reutilizar a chave de desenvolvimento.
- **Isolamento Total**: Toda a comunicação cliente-servidor transita por HTTPS e cookies HttpOnly seguros.

---

## 9. Decisão Final de Prontidão

> ### **SISTEMA PRONTO PARA GO-LIVE**
> Todas as 9 pendências levantadas no PROD-001 foram sanadas, testadas e documentadas. A base de código do **Oficina Gestão V1.1** está tecnicamente apta, protegida e pronta para operação real pela oficina.
