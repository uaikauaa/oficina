# PROD-006 — PLANO TÉCNICO DE INFRAESTRUTURA DE PRODUÇÃO (V1.1)

**Data de Elaboração**: 17/09/2026  
**Status do Projeto**: Código Homologado (224+ testes backend PASS, 214+ testes frontend PASS, V1–V9 intactas)  
**Objetivo**: Definir a especificação técnica e a seleção da infraestrutura real de produção para Frontend, Backend, Banco de Dados e Backup Externo.

---

## 1. VISÃO GERAL DA ARQUITETURA DE PRODUÇÃO

A solução opera sob o modelo de **três camadas isoladas**, com separação total entre cliente, lógica de negócio e persistência, adicionando uma quarta camada independente de salvaguarda de desastres (Disaster Recovery).

```text
========================================================================================
                                FLUXO DE REQUISIÇÕES
========================================================================================

                 [ Usuário / Dispositivo do Balcão ]
                                 │
                                 ▼ (HTTPS / TLS 1.3 estrito)
                      [ DNS / WAF (Cloudflare) ]
                      ┌──────────┴──────────┐
                      │                     │
                      ▼                     ▼
          https://app.oficina...   https://api.oficina...
          ┌─────────────────────┐  ┌──────────────────────────────┐
          │  FRONTEND (Next.js) │  │    BACKEND (Spring Boot)     │
          │  App Router / React │  │    Java 21 / REST API        │
          │  Hospedagem Edge/SSR│  │    Container Docker          │
          └─────────────────────┘  └──────────────┬───────────────┘
                                                  │
                                                  ▼ (TLS com sslmode=require)
                                           [ PgBouncer Pooler ]
                                                  │
                                                  ▼
                                       ┌──────────────────────┐
                                       │   BANCO DE DADOS     │
                                       │   Neon PostgreSQL    │
                                       │   Branch production  │
                                       └──────────────────────┘

========================================================================================
                          FLUXO DE BACKUP E DISASTER RECOVERY
========================================================================================

    ┌──────────────────────┐
    │   Neon PostgreSQL    │
    │   Branch production  │
    └──────────┬───────────┘
               │
               ▼ (pg_dump lógico criptografado)
    ┌──────────────────────┐
    │  Rotina de Backup    │ (Job agendado: cron 02:00 BRT)
    │  (CLI / Container)   │
    └──────────┬───────────┘
               │
               ▼ (AES-256 / Chave assimétrica GPG)
    ┌────────────────────────────────────────┐
    │  ARMAZENAMENTO EXTERNO OFF-SITE        │
    │  (Cloudflare R2 / AWS S3)              │
    │  Bucket com Política de Menor          │
    │  Privilégio (PutObject Only)           │
    └──────────────────┬─────────────────────┘
                       │
                       ▼ (Restauração periódica simulada)
    ┌────────────────────────────────────────┐
    │  AMBIENTE ISOLADO DE RESTORE PILOTO    │
    │  (Branch temporária / BD de Teste)     │
    └────────────────────────────────────────┘
```

---

## 2. AVALIAÇÃO DE HOSPEDAGEM DO FRONTEND (NEXT.JS 16)

O frontend utiliza **Next.js 16.3.5** com App Router, React 19, TypeScript e Tailwind CSS.

### 2.1. Comparativo de Provedores

| Critério | Opção A: Vercel | Opção B: Cloudflare Pages (OpenNext) | Opção C: Container Docker (Railway / Render / VPS) |
|---|---|---|---|
| **Compatibilidade Next.js** | **Nativa (100%)** — Criadora do framework, suporte instantâneo a Turbopack e App Router | **Alta**, via wrapper OpenNext; algumas APIs nativas do Node exigem polyfill | **Total (100%)** — Runtime Node.js padrão em container standalone |
| **HTTPS e TLS** | Automático com renovação Let's Encrypt | Automático via Edge Cloudflare com TLS 1.3 e HTTP/3 | Automático gerenciado pela plataforma ou Caddy/Traefik |
| **Domínio Customizado** | Configuração simples via CNAME/A | Nativo no ecossistema Cloudflare | Suportado em todas as plataformas |
| **Variáveis de Ambiente** | Segregadas por ambiente (`Production`, `Preview`, `Development`) | Suportadas via painel Pages | Injetadas no container via painel de secrets |
| **Build & Deploy** | CI/CD nativo acoplado ao GitHub; build ultra-rápido | Build no edge runner via GitHub Actions | Build Docker multistage; ligeiramente mais lento |
| **Rollback** | **Instantâneo (1 clique)** para qualquer commit anterior | Instantâneo via preview deployment | Rápido através de re-deploy da imagem anterior |
| **Logs & Observabilidade** | Runtime logs em tempo real + métricas Web Vitals | Logs básicos de edge functions | Logs completos do container (stdout/stderr) |
| **Classificação de Custo** | **Gratuito** (Hobby) para operação inicial; **Baixo Custo Fixo** (Pro) | **Gratuito / Custo Irrisório** (sem limite de bandwidth) | **Baixo Custo Variável** por consumo de memória/CPU |
| **Facilidade Operacional** | **Máxima** — Zero gerenciamento de servidores | **Média** — Exige configuração do adapter edge | **Média/Baixa** — Exige manutenção de container/Node |

### 2.2. Recomendação Técnica para o Frontend
* **Opção Recomendada**: **Vercel** (Plano Hobby para homologação/início ou Pro para regras comerciais corporativas).
* **Justificativa**: O Next.js 16 tem paridade nativa na Vercel, garantindo suporte imediato a Server Actions, streaming SSR, roteamento dinâmico e rollback sem necessidade de gerenciar containers ou runtime Node.js.

---

## 3. AVALIAÇÃO DE HOSPEDAGEM DO BACKEND (SPRING BOOT / JAVA 21)

O backend é uma aplicação Spring Boot 3.4.3 compilada para Java 21, empacotada em `.jar` executável ou container Docker com conexão persistente via HikariCP ao Neon.

### 3.1. Comparativo de Provedores

| Critério | Opção 1: Railway | Opção 2: Render | Opção 3: AWS App Runner | Opção 4: VPS (Hetzner/Linode + Coolify) |
|---|---|---|---|---|
| **Compatibilidade Java 21** | **Nativa** via Dockerfile ou Nixpacks | **Nativa** via Dockerfile | **Nativa** via imagem ECR / Dockerfile | **Nativa** via Docker Compose |
| **Gestão de Secrets** | Excelente; interface simples com criptografia | Boa; variáveis de ambiente no dashboard | Excelente (AWS Secrets Manager / SSM) | Arquivo `.env` protegido no servidor |
| **Health Check (`/api/health`)** | **Nativo** — monitora endpoint e reinicia se falhar | **Nativo** — suporta path HTTP | **Nativo** com intervalo e limiar configurável | Via Docker healthcheck / Coolify |
| **Forwarded Headers** | Totalmente compatível com `SERVER_FORWARD_HEADERS_STRATEGY=framework` | Totalmente compatível | Compatível atrás do AWS ALB | Configurável no proxy reverso |
| **Conexão com Neon (sa-east-1)** | Excelente latência se provisionado na região compatível | Boa (US-East ou Frankfurt) | Baixíssima latência (se provisionado em `sa-east-1`) | Depende da localização do datacenter |
| **Comportamento de Cold Start** | Sem suspensão nos planos ativos | Plano gratuito suspende após 15m; planos pagos contínuos | Escala a zero (pode ter cold start JVM se não mantiver min=1) | Zero cold start (processo roda 24/7) |
| **Rollback de Aplicação** | 1 clique para release/commit anterior | 1 clique no histórico de deploys | Reversão de versão no App Runner | Reversão de tag na imagem Docker |
| **Classificação de Custo** | **Baixo Custo Variável** (baseado em RAM/CPU consumidos) | **Baixo Custo Fixo** (planos individuais para não suspender) | **Custo Recorrente Moderado** (mínimo de compute contínuo) | **Baixo Custo Fixo Previsível** (aluguel de VM fixa) |
| **Facilidade de Manutenção** | **Alta** (PaaS totalmente gerenciado) | **Alta** (PaaS gerenciado) | **Média** (requer familiaridade com AWS) | **Média** (requer manutenção de OS/segurança) |

### 3.2. Calibração Mandatória do Backend para Produção
Independentemente do provedor selecionado, o runtime deve obedecer aos seguintes parâmetros já preparados no código:
- `SPRING_PROFILES_ACTIVE=prod`
- `SERVER_FORWARD_HEADERS_STRATEGY=framework`
- `SECURITY_COOKIE_SECURE=true`
- `CORS_ALLOWED_ORIGINS=https://app.oficinagestao.com.br`
- Pool HikariCP: `maximum-pool-size=10`, `minimum-idle=2`, `max-lifetime=600000` (10 min), `idle-timeout=300000` (5 min), `connection-timeout=20000` (20s).

---

## 4. ESTRATÉGIA DE DOMÍNIO, DNS E HTTPS

### 4.1. Topologia de Nomes
- **Domínio Principal**: `oficinagestao.com.br` (exemplo oficial, a ser registrado no Registro.br).
- **Aplicação Web (Frontend)**: `app.oficinagestao.com.br`
- **API REST (Backend)**: `api.oficinagestao.com.br`

### 4.2. Camada de Borda e Segurança TLS
- **Serviço de DNS**: Cloudflare DNS (modo Full / Strict SSL).
- **Certificados**: TLS 1.3 obrigatório com renovação automática e HSTS (`Strict-Transport-Security`).
- **Políticas de Redirect**: Redirecionamento forçado de HTTP (porta 80) para HTTPS (porta 443).
- **Isolamento de Cookies**:
  - `access_token`: cookie HttpOnly com `SameSite=Lax`, `Path=/`, `Secure=true`.
  - `refresh_token`: cookie HttpOnly com `SameSite=Strict`, `Path=/api/auth`, `Secure=true`.

---

## 5. ESTRATÉGIAS PARA O NEON POSTGRESQL

Durante a auditoria PROD-005, constatou-se que a API do Neon rejeitou a proteção da branch com:
`NeonApiError: You have reached the maximum number of protected branches for your current plan.`

### 5.1. Comparativo das Estratégias

| Aspecto | Estratégia A: Upgrade do Plano Neon | Estratégia B: Plano Atual com Controles Compensatórios |
|---|---|---|
| **Branch Protection** | **Ativa** nativamente na branch `production` via console/API | **Inativa** no console; protegida por restrição de acesso e credenciais |
| **Cota de Snapshots** | Múltiplos snapshots sob demanda e agendamento automático | Restrito a 1 snapshot manual (atualmente `snap-spring-thunder-acvzytef`) |
| **Histórico PITR** | Janela de Time Travel estendida (até 30 dias) | Janela de Time Travel padrão do plano gratuito (7 dias) |
| **Compute / Conexões** | Maior cota de horas de CPU e pooler expandido | Cota suficiente para operação inicial de balcão (oficina de porte médio) |
| **Classificação de Custo** | **Custo Recorrente Fixo** (assinatura comercial Neon) | **Gratuito** |
| **Complexidade Operacional** | Baixa — salvaguarda em nível de plataforma | Média — exige disciplina estrita e rotina de backup externo obrigatória |

### 5.2. Controles Compensatórios Mandatórios (Caso adotada a Estratégia B)
Se a organização optar por permanecer no plano atual durante o início da operação:
1. **Credenciais de Menor Privilégio**: Não expor credenciais de admin (`neondb_owner`) fora do cofre de secrets. Criar usuário específico da aplicação para o runtime.
2. **2FA Obrigatório no Console Neon**: Todo acesso à conta Neon deve exigir autenticação em dois fatores, impedindo exclusão acidental de branch por terceiros.
3. **Proibição de Comandos Destrutivos no CI/CD**: A chave de API do Neon integrada a agentes ou ferramentas de automação não deve possuir permissão de `delete_branch` ou `delete_project`.
4. **Dependência Crítica no Backup Externo**: Toda a responsabilidade de Disaster Recovery é transferida para o backup off-site diário fora do Neon.

---

## 6. ESPECIFICAÇÃO DO BACKUP EXTERNO E RESTORE PILOTO

Snapshots internos do Neon **não substituem** o backup externo, pois compartilham a mesma infraestrutura de provedor e conta.

### 6.1. Pipeline de Backup Off-Site
1. **Mecanismo de Dump**: Utilitário oficial `pg_dump` versão 17 em container isolado executando em rotina agendada (ex: cronjob à 02:00 BRT).
2. **Formato do Dump**: `--format=custom --no-owner --no-privileges` com compressão nativa gzip.
3. **Criptografia em Trânsito e Repouso**:
   - Chave assimétrica GPG ou encriptação nativa do bucket (SSE-S3 com KMS).
4. **Destino de Armazenamento**:
   - **Cloudflare R2** (Recomendado: 100% compatível com API S3, **sem custos de transferência/egresso**, redundância geográfica).
   - Alternativa: **AWS S3** (Região distinta de São Paulo, ex: `us-east-1`).
5. **Política de Menor Privilégio (IAM)**:
   - A credencial usada pela rotina de backup possui apenas permissão `s3:PutObject`.
   - **Nenhuma permissão de `s3:DeleteObject`** é concedida ao processo de backup, eliminando o vetor de ataque de sequestro de dados (ransomware).
6. **Política de Retenção (Lifecycle Rules)**:
   - Diários: Retenção de 14 dias.
   - Semanais: Retenção de 8 semanas.
   - Mensais: Retenção de 12 meses.

### 6.2. Procedimento de Teste de Restore Piloto
Para cumprir o critério de homologação de desastre:
1. Disparar o backup off-site.
2. Criar uma branch de teste temporária no Neon (`restore-validation-temp`).
3. Executar o `pg_restore` contra essa branch temporária.
4. Executar script de validação de contagens:
   - `SELECT COUNT(*) FROM clientes;`
   - `SELECT COUNT(*) FROM maquinas;`
   - `SELECT COUNT(*) FROM ordens_servico;`
   - `SELECT COUNT(*) FROM produtos;`
   - `SELECT COUNT(*) FROM movimentacoes_estoque;`
5. Confirmar que o hash e a contagem de tabelas batem 100% com a base principal.
6. Descartar a branch temporária.

---

## 7. MATRIZ COMPARATIVA DE CUSTOS ESTIMADOS

| Componente | Opção Gratuita / Baixo Custo | Opção Comercial Padrão |
|---|---|---|
| **Frontend** | Vercel (Hobby) — **Gratuito** | Vercel (Pro) — **Custo Fixo Recorrente** |
| **Backend** | Railway / Render — **Baixo Custo Variável** | AWS App Runner / ECS — **Custo Recorrente Moderado** |
| **Banco Neon** | Neon Free (com controles compensatórios) — **Gratuito** | Neon Launch — **Custo Fixo Recorrente** |
| **Backup Off-Site** | Cloudflare R2 (Free Tier até 10 GB) — **Gratuito / Baixo Custo** | AWS S3 Standard + Lifecycle — **Baixo Custo Variável** |
| **Domínio / DNS** | Registro.br + Cloudflare Free DNS — **Baixo Custo Anual** | Registro.br + Cloudflare Pro — **Custo Fixo Recorrente** |

---

## 8. CHECKLIST OPERACIONAL DE PRÉ-IMPLANTAÇÃO

Antes da liberação definitiva para produção, todos os itens devem ser preenchidos:

- [ ] Provedor de frontend definido e repositório conectado
- [ ] Provedor de backend definido e imagem/build Java 21 configurada
- [ ] Domínio público registrado no Registro.br e zona DNS delegada ao Cloudflare
- [ ] Certificados TLS/HTTPS ativos com redirect automático HTTP -> HTTPS
- [ ] Variáveis de ambiente secretas injetadas no backend (`JWT_SECRET`, `CORS_ALLOWED_ORIGINS`, etc.)
- [ ] Variável `NEXT_PUBLIC_API_URL` configurada no frontend apontando para o backend HTTPS
- [ ] `SERVER_FORWARD_HEADERS_STRATEGY=framework` confirmado no runtime do backend
- [ ] Flag `SECURITY_COOKIE_SECURE=true` ativada em produção
- [ ] Estratégia Neon definida (Upgrade ou Plano Free com Controles Compensatórios formalizados)
- [ ] Bucket externo configurado com permissão estrita `PutObject`
- [ ] Primeiro backup lógico (`pg_dump`) executado com sucesso e armazenado no bucket externo
- [ ] Restore piloto executado e validado em ambiente isolado
- [ ] Health check público (`GET /api/health`) respondendo HTTP 200 com `{"status":"UP","database":"UP"}`
- [ ] Smoke test público executado e aprovado em 16/16 passos sem utilizar `localhost`
- [ ] Procedimento de rollback de aplicação validado

---

## 9. ORDEM RECOMENDADA DE EXECUÇÃO

A sequência cronológica para a execução do go-live real deve obedecer à seguinte ordem:

```text
Passo 1: Aquisição e Configuração de DNS
         └── Registrar domínio -> Delegar para Cloudflare -> Criar entradas CNAME (app e api)

Passo 2: Definição da Estratégia Neon
         └── Decisão de contratação: Upgrade ou formalização dos Controles Compensatórios

Passo 3: Provisionamento do Bucket de Backup Off-Site
         └── Criar bucket no Cloudflare R2 / AWS S3 -> Gerar credenciais IAM com permissão PutObject

Passo 4: Provisionamento do Backend
         └── Deploy do Spring Boot -> Injeção de secrets -> Validação de /api/health

Passo 5: Provisionamento do Frontend
         └── Deploy do Next.js na Vercel -> Injeção de NEXT_PUBLIC_API_URL -> Validação de login

Passo 6: Execução do Primeiro Backup Off-Site Real
         └── Disparo do pg_dump -> Criptografia -> Upload para R2/S3 -> Verificação de integridade

Passo 7: Execução do Restore Piloto em Ambiente Isolado
         └── Restauração do dump em branch temporária Neon -> Validação de tabelas e registros

Passo 8: Smoke Test Público Final (16/16 Passos)
         └── Teste fim a fim pelo domínio público -> Aprovação definitiva de Go-Live
```
