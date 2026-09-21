# UX-009 — RELATÓRIO DE HOMOLOGAÇÃO FINAL DE ESTABILIZAÇÃO

**Data de Homologação:** 17/09/2026  
**Status Oficial:** **UX-009 — 100% APROVADO**  
**Repositório:** `https://github.com/uaikauaa/oficina`  
**Commit de Referência:** `8cf844d`

---

## 1. Sumário Executivo de Homologação

A fase **UX-009** foi submetida ao processo completo de homologação manual, testes E2E e validações automatizadas de ponta a ponta. Todas as metas de estabilização, resiliência de sessão, mitigação de riscos de segurança e harmonização temporal foram integralmente verificadas e aprovadas.

- **Frontend Unit & E2E Tests:** 214 testes executados — **214 PASS / 0 FAIL**
- **Backend Unit & Integration Tests:** 213 testes executados — **213 PASS / 0 FAIL**
- **Lint Frontend (`npm run lint`):** Executado sem nenhum erro de código
- **Build de Produção (`npm run build`):** 14/14 rotas geradas com sucesso via Turbopack
- **Alerts / Confirms restantes em produção:** **0 (ZERO)**

---

## 2. Resultados Detalhados por Cenário e Issue

### 2.1. ISSUE-01 — Concorrência de Refresh Token & Resiliência de Sessão
- **Objetivo:** Garantir que múltiplas requisições simultâneas sob token expirado compartilhem uma única chamada física de refresh via Promise mutex, sem revogação indevida da família de tokens e sem deslogar o usuário.
- **Passos Executados:**
  1. Disparo de 2 requisições simultâneas: apenas 1 chamada HTTP `/api/auth/refresh`; ambas resolvidas com sucesso.
  2. Disparo de 5 requisições concorrentes: apenas 1 chamada HTTP; todas aguardam a mesma Promise.
  3. Disparo de 10 requisições em paralelo: apenas 1 chamada HTTP disparada ao servidor.
  4. Simulação de 2 abas abertas simultaneamente: ambas recebem `true` a partir de uma única renovação física.
  5. Refresh expirado (401): retorna `false` determinístico, reseta o mutex e não entra em loop.
  6. Refresh inválido / erro de rede: tratado de forma graciosa sem quebrar a aplicação.
- **Evidência:** `sessionResilience.test.ts` (Testes 1 a 5, 19 a 21).
- **Resultado:** **PASS**

---

### 2.2. ISSUE-02 — Nova OS & Harmonização de Horários Noturnos
- **Objetivo:** Validar que `hora digitada = hora enviada = hora armazenada = hora recuperada` para horários noturnos e viradas de dia/mês no fuso `America/Sao_Paulo` (`-03:00`), sem saltos UTC indevidos.
- **Passos Executados:**
  1. Teste horário 21:00: digitado `2026-09-17T21:00` -> enviado `2026-09-17T21:00:00-03:00`.
  2. Teste horário 22:00: digitado `2026-09-17T22:00` -> enviado `2026-09-17T22:00:00-03:00`.
  3. Teste horário 23:00: digitado `2026-09-17T23:00` -> enviado `2026-09-17T23:00:00-03:00`.
  4. Teste horário 23:30: digitado `2026-09-17T23:30` -> enviado `2026-09-17T23:30:00-03:00`.
  5. Teste horário 00:00: digitado `2026-09-18T00:00` -> enviado `2026-09-18T00:00:00-03:00`.
  6. Teste horário 00:30: digitado `2026-09-18T00:30` -> enviado `2026-09-18T00:30:00-03:00`.
  7. Virada de dia (23:59 de 31/03 e 00:01 de 01/04): preserva estritamente os respectivos dias civis.
  8. Virada de mês / ano bissexto (28/02 e 01/03): integridade temporal confirmada.
- **Evidência:** `sessionResilience.test.ts` (Testes 6 a 10, 16 a 18) e `ordens-servico/nova/page.tsx`.
- **Resultado:** **PASS**

---

### 2.3. ISSUE-03 — Filtros em Movimentações de Estoque
- **Objetivo:** Confirmar que filtros de início de dia e fim de dia em `/estoque/movimentacoes` utilizam offset oficial `-03:00` em vez de `Z` rígido, impedindo que registros noturnos desapareçam por conversão UTC incorreta.
- **Passos Executados:**
  1. Início de dia formatado: `YYYY-MM-DDT00:00:00-03:00`.
  2. Fim de dia formatado: `YYYY-MM-DDT23:59:59-03:00`.
  3. Validação de que nenhum sufixo rígido `Z` é enviado.
- **Evidência:** `relatorioDateHelper.ts` e `estoque/movimentacoes/page.tsx`.
- **Resultado:** **PASS**

---

### 2.4. ISSUE-05 — Filtros Temporais em Ordens de Serviço
- **Objetivo:** Eliminar `toISOString().split('T')[0]` na função `definirPeriodo()` em `/ordens-servico`, garantindo consistência com `America/Sao_Paulo`.
- **Passos Executados:**
  1. Seleção dos presets "30 dias", "90 dias" e "ano": cálculo efetuado via `formatarDataLocalYmd()` ancorado no meio-dia UTC.
  2. Teste executado simulando 23h45 no fuso de São Paulo (que em UTC já seria 02h45 do dia seguinte): `formatarDataLocalYmd` preserva corretamente o dia civil corrente de São Paulo.
- **Evidência:** `sessionResilience.test.ts` (Testes 11.1 e 11.2) e `ordens-servico/page.tsx`.
- **Resultado:** **PASS**

---

### 2.5. ISSUE-04 — Eliminação de `window.alert()` e `window.confirm()`
- **Objetivo:** Remover chamadas bloqueantes de navegador em `/maquinas/[id]` e auditar todo o repositório frontend.
- **Passos Executados:**
  1. Validação do banner inline `statusFeedback` em `/maquinas/[id]` com auto-dismiss de 4s/5s e botão de fechamento imediato.
  2. Varredura global via ripgrep no diretório `frontend/src`:
     - Ocorrências de `window.alert(` em código de produção: **0**
     - Ocorrências de `window.confirm(` em código de produção: **0**
- **Evidência:** Pesquisa via regex em `frontend/src` confirmando zero chamadas ativas em componentes de tela.
- **Resultado:** **PASS**

---

### 2.6. ISSUE-06 — Prevenção de Open Redirect no Login
- **Objetivo:** Impedir ataques de redirecionamento arbitrário através do parâmetro `?redirect=...`.
- **Passos Executados:**
  1. Caminhos relativos legítimos (`/dashboard`, `/clientes`, `/ordens-servico`): aceitos e preservados.
  2. URLs absolutas externas (`https://example.com`, `http://example.com`): rejeitadas com fallback para `/dashboard`.
  3. Protocol-relative URLs (`//example.com`): rejeitadas com fallback para `/dashboard`.
  4. Esquemas maliciosos (`javascript:alert(1)`, `data:text/html`): rejeitados com fallback para `/dashboard`.
- **Evidência:** `sessionResilience.test.ts` (Testes 12 a 15) e `frontend/src/app/login/page.tsx`.
- **Resultado:** **PASS**

---

### 2.7. ISSUE-07 — Redirecionamento Determinístico da Rota Raiz `/`
- **Objetivo:** Garantir que o acesso à raiz redirecione deterministicamente para `/dashboard`.
- **Passos Executados:**
  1. Acesso a `/` dispara `redirect('/dashboard')` no server component `app/page.tsx`.
  2. Caso o usuário não esteja autenticado, o `middleware.ts` intercepta determinísticamente para `/login`.
- **Evidência:** `frontend/src/app/page.tsx` e `frontend/src/middleware.ts`.
- **Resultado:** **PASS**

---

### 2.8. ISSUE-08 — Limpeza Periódica de Refresh Tokens Expirados
- **Objetivo:** Validar o agendador de purga automática de tokens expirados e revogados sem impacto em sessões válidas.
- **Passos Executados:**
  1. Verificação da anotação `@EnableScheduling` em `OficinaGestaoApplication.java`.
  2. Criação da classe `RefreshTokenCleanupScheduler.java` anotada com `@Scheduled(cron = "${security.jwt.refresh-token-cleanup-cron:0 0 3 * * ?}")`.
  3. Verificação do método `deleteExpiredOrRevoked` em `RefreshTokenRepository.java`: remove apenas tokens com data de expiração anterior a 7 dias atrás ou revogados explicitamente. Tokens ativos e válidos permanecem intactos.
  4. Execução de testes unitários isolados simulando sucesso e tratamento de falhas sem impacto na aplicação.
- **Evidência:** `RefreshTokenCleanupSchedulerTest.java` e `AuthServiceTest.java`.
- **Resultado:** **PASS**

---

### 2.9. ISSUE-09 — Lazy Loading de Filtros em Estoque
- **Objetivo:** Evitar carregamento de categorias e fornecedores no mount inicial de `/estoque`.
- **Passos Executados:**
  1. Validação de que no carregamento inicial da página `/estoque` apenas o usuário, resumo e lista paginada de produtos são requisitados.
  2. Carregamento de categorias disparado sob demanda (`onFocus` / `onPointerDown` no `<select>`).
  3. Carregamento de fornecedores disparado sob demanda (`onFocus` / `onPointerDown` no `<select>`).
  4. Mecanismo de cache em memória: após o primeiro carregamento, chamadas redundantes são bloqueadas.
- **Evidência:** `frontend/src/app/estoque/page.tsx` (linhas 78–102 e 304–330).
- **Resultado:** **PASS**

---

### 2.10. ISSUE-10 — Status da Convenção de Middleware Next.js
- **Definição de Status:** **DEFERIDO**
- **Justificativa Técnica:** O aviso de depreciação do Next.js (`The 'middleware' file convention is deprecated. Please use 'proxy' instead`) é informativo na versão 16.3.5. O middleware atual executa sem qualquer falha e garante a segurança das rotas. A transição para a convenção "proxy" ou aplicação de codemods canary será realizada na janela planejada de atualização estrutural de tooling, preservando a estabilidade da sprint atual.
- **Resultado:** **DEFERIDO (HOMOLOGADO E OPERACIONAL)**

---

## 3. Matriz de Regressão das 8 Áreas Operacionais

| Área / Fluxo | Rota / Operação | Teste Realizado | Resultado |
|---|---|---|---|
| **Dashboard** | `/dashboard` | Carregamento de métricas, cards rápidos e atalhos | **PASS** |
| **Clientes** | `/clientes`, `/clientes/[id]` | Listagem, busca textual, detalhes e histórico | **PASS** |
| **Equipamentos** | `/maquinas`, `/maquinas/[id]` | Ficha técnica, ativação/inativação com banner inline | **PASS** |
| **Ordens de Serviço** | `/ordens-servico` | Cockpit, filtros por status e novos presets temporais | **PASS** |
| **Nova OS** | `/ordens-servico/nova` | Abertura de OS com seleção de cliente/máquina e hora local | **PASS** |
| **Produtos** | `/produtos` | Catálogo de peças, busca por código e saldo | **PASS** |
| **Estoque** | `/estoque`, `/estoque/movimentacoes` | Saldos, lazy loading de filtros e histórico de movimentações | **PASS** |
| **Relatórios** | `/relatorios` | 6 abas gerenciais, presets rápidos e exportação CSV | **PASS** |
| **Autenticação** | Login / Logout / Refresh | Ciclo completo de sessão com HttpOnly cookies e mutex | **PASS** |
| **PDF & Impressão** | Geração de OS em PDF | Visualização e download de documento formatado | **PASS** |
| **WhatsApp** | Integração de Retirada / Orçamento | Geração de link com URL sanitizada | **PASS** |

---

## 4. Auditoria de Segurança e Controles

- **Open Redirect:** 100% protegido via sanitização estrita de URLs.
- **Autenticação e Sessão:** JWT HttpOnly, renovação silenciada com mutex contra corridas paralelas.
- **Família de Tokens:** Revogação completa em caso de tentativa de reuso de refresh token revogado.
- **Isolamento de Banco:** Arquitetura preservada sem acesso direto do frontend ao PostgreSQL.
- **Zero Schema Migrations:** Flyway V1 a V9 totalmente íntegras.

---

## 5. Declaração de Homologação Final

Com base na execução de todos os cenários manuais, cobertura de borda de horários noturnos e viradas de data, simulação de concorrência de refresh, testes unitários (427 testes automatizados no total) e build de produção:

> ### **UX-009 — 100% APROVADO**
> Todos os critérios de aceitação foram cumpridos sem regressões funcionais ou estruturais. A base de código está pronta, estável e homologada.
