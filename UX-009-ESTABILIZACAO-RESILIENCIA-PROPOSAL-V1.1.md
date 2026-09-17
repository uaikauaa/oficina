# UX-009 — PROPOSTA TÉCNICA
# ESTABILIZAÇÃO GLOBAL, RESILIÊNCIA DE SESSÃO E INTEGRIDADE OPERACIONAL

**Data:** 17/09/2026  
**Status:** PROPOSTA PARA AVALIAÇÃO  
**Ciclo:** UX-009 (Fase de Estabilização e Endurecimento da V1.1)  
**Pré-requisito:** UX-001 a UX-008 Concluídos e Homologados  

---

## 1. Contexto e Justificativa

Com a conclusão e homologação das 8 fases de experiência do usuário (Dashboard, Clientes, Equipamentos, Ordens de Serviço, Nova OS, Produtos, Estoque e Relatórios), o sistema **Oficina Gestão V1.1** alcançou cobertura completa de todas as telas operacionais e gerenciais da oficina especializada em máquinas de solda (TIG/MIG/MMA) e geradores.

A auditoria global de estabilização realizada revelou que **não há necessidade de redesign de novas telas**. No entanto, a análise aprofundada de código, concorrência, fuso horário e segurança identificou **gargalos estruturais e bugs latentes** que impactam diretamente a confiabilidade do sistema em regime de produção contínua.

O maior risco operacional identificado reside na **race condition da renovação silenciosa de tokens** (`apiFetch` vs. detecção de reutilização no `AuthService`), além de **inconsistências de fuso horário** na abertura e listagem de OS que herdaram padrões UTC obsoletos corrigidos apenas pontualmente em fases anteriores.

---

## 2. Inventário e Classificação dos Problemas Identificados

| ID | Severidade | Categoria | Rota Afetada | Arquivo Principal | Descrição Sintética |
|---|:---:|:---:|---|---|---|
| **ISSUE-01** | **P1** | Bug Real / Resiliência | Todas (Global) | `frontend/src/lib/api.ts` e `AuthService.java` | Race condition no refresh token simultâneo causando logout acidental e revogação em massa. |
| **ISSUE-02** | **P1** | Bug Real / Integridade | `/ordens-servico/nova` | `frontend/src/app/ordens-servico/nova/page.tsx` | Duplo drift UTC de data/hora (+6h de adiantamento) em ordens de serviço criadas à noite. |
| **ISSUE-03** | **P2** | Bug Real / Fuso | `/estoque/movimentacoes` | `frontend/src/app/estoque/movimentacoes/page.tsx` | Sufixo rígido "Z" remanescente no filtro de período de movimentações. |
| **ISSUE-04** | **P2** | Bug de UX / Inconsistência | `/maquinas/[id]` | `frontend/src/app/maquinas/[id]/page.tsx` | Chamada nativa `window.alert()` remanescente no toggle de status de equipamento. |
| **ISSUE-05** | **P2** | Bug Real / Fuso | `/ordens-servico` | `frontend/src/app/ordens-servico/page.tsx` | Tratamento assimétrico de datas de filtro gerando corte indevido de registros. |
| **ISSUE-06** | **P2** | Risco de Segurança | `/login` | `frontend/src/app/login/page.tsx` | Parâmetro `redirect` sem validação de caminho local (vetor de Open Redirect). |
| **ISSUE-07** | **P3** | Dívida Técnica / UX | `/` | `frontend/src/app/page.tsx` | Rota raiz estática de "Fase 0" sem redirecionamento inteligente para `/dashboard`. |
| **ISSUE-08** | **P3** | Dívida Técnica / Banco | Backend Auth | `RefreshTokenRepository.java` | Acúmulo indefinido de refresh tokens expirados e revogados sem rotina de purga. |
| **ISSUE-09** | **P3** | Performance | `/estoque` | `frontend/src/app/estoque/page.tsx` | Eager loading de categorias e fornecedores no mount sem abertura de filtros avançados. |
| **ISSUE-10** | **P3** | Dívida Técnica | Global Next.js | `frontend/src/middleware.ts` | Depreciação da convenção `middleware` reportada pelo Turbopack no Next.js 16. |

---

## 3. Detalhamento Técnico das Descobertas

### ISSUE-01 — Race Condition no Refresh Token Silencioso (P1 — ALTA)
- **Rota:** Qualquer tela que execute 2 ou mais requisições simultâneas após expiração do access token de 15 minutos (ex: `/dashboard`, `/clientes/[id]`, `/estoque`).
- **Arquivos:** `frontend/src/lib/api.ts` (linhas 16–31) e `backend/src/main/java/com/oficinagestao/service/AuthService.java` (linhas 130–135).
- **Evidência:**
  Quando o `access_token` expira, a função `apiFetch` intercepta o status 401 e dispara `fetch('/api/auth/refresh')`.
  Se 3 requisições paralelas (ex: contadores, equipamentos e clientes) receberem 401 simultaneamente, as 3 disparam `/api/auth/refresh` quase no mesmo milissegundo com o mesmo cookie `refresh_token`.
  A primeira requisição chega ao backend, rotaciona o token e marca o anterior como `revogado = true`.
  A segunda requisição chega com o token que acabou de ser revogado. O backend aciona a política anti-reutilização:
  ```java
  if (Boolean.TRUE.equals(oldToken.getRevogado())) {
      if (oldToken.getUsuario() != null) {
          refreshTokenRepository.revokeAllByUsuarioId(oldToken.getUsuario().getId());
      }
      throw new BadCredentialsException("Refresh token revogado.");
  }
  ```
  Isso revoga **todos** os tokens da usuária, invalidando inclusive o token novo emitido milissegundos antes, resultando em logout forçado no meio da navegação.
- **Impacto:** Sessão desconectada inesperadamente enquanto a usuária está trabalhando.
- **Solução Proposta:** Implementar em `frontend/src/lib/api.ts` uma trava por Promise única (*in-flight refresh mutex/promise*). Todas as requisições que receberem 401 aguardam a mesma Promise de renovação; uma única requisição ao `/api/auth/refresh` é disparada e, ao concluir, todas as chamadas originais são repetidas com sucesso.

---

### ISSUE-02 — Duplo Drift Temporal de Data/Hora na Nova OS (P1 — ALTA)
- **Rota:** `/ordens-servico/nova`
- **Arquivo:** `frontend/src/app/ordens-servico/nova/page.tsx` (linhas 63 e 220).
- **Evidência:**
  - Inicialização do formulário:
    ```typescript
    dataEntrada: new Date().toISOString().slice(0, 16) // YYYY-MM-DDTHH:mm
    ```
    No fuso de Brasília (UTC-3), às 21h30 do dia 17/09, `new Date().toISOString()` produz `2026-09-18T00:30:00Z`. O slice extrai `2026-09-18T00:30`, exibindo a data de amanhã no input datetime-local.
  - Submissão:
    ```typescript
    dataEntrada: formData.dataEntrada ? new Date(formData.dataEntrada).toISOString() : undefined
    ```
    O construtor `new Date("2026-09-18T00:30")` interpreta a string como horário local e adiciona mais 3 horas para convertê-la em UTC: `2026-09-18T03:30:00Z`.
- **Impacto:** Distorção cumulativa de +6 horas na data de recepção de equipamentos atendidos no período noturno.
- **Solução Proposta:** Utilizar o formatador padronizado `formatarDataLocalYmd` ou formatador local que produza `YYYY-MM-DDTHH:mm` no fuso de São Paulo sem conversão UTC intermediária, e anexar `-03:00` no envio do payload.

---

### ISSUE-03 — Sufixo Rígido "Z" Remanescente em Movimentações de Estoque (P2 — MÉDIA)
- **Rota:** `/estoque/movimentacoes`
- **Arquivo:** `frontend/src/app/estoque/movimentacoes/page.tsx` (linhas 74–75).
- **Evidência:**
  ```typescript
  if (dataInicio) params.append('dataInicio', `${dataInicio}T00:00:00Z`);
  if (dataFim) params.append('dataFim', `${dataFim}T23:59:59Z`);
  ```
- **Impacto:** Consultas por período cortam 3 horas do início do dia e invadem 3 horas do dia seguinte.
- **Solução Proposta:** Substituir o sufixo rígido `"Z"` por `-03:00`, alinhando-se com a regra oficial adotada na V1.1 e implementada em `relatorioDateHelper.ts`.

---

### ISSUE-04 — Chamada Nativa a `window.alert()` em `/maquinas/[id]` (P2 — MÉDIA)
- **Rota:** `/maquinas/[id]`
- **Arquivo:** `frontend/src/app/maquinas/[id]/page.tsx` (linhas 176 e 179).
- **Evidência:**
  ```typescript
  alert(err.message || 'Erro ao alterar status do equipamento.');
  alert('Falha na comunicação com o servidor.');
  ```
- **Impacto:** Quebra a consistência visual e o padrão moderno estabelecido nas fases UX-001 a UX-008.
- **Solução Proposta:** Substituir por toast ou banner de erro inline, mantendo a consistência do Cockpit de Equipamentos.

---

### ISSUE-05 — Inconsistência Temporal na Filtragem de Ordens de Serviço (P2 — MÉDIA)
- **Rota:** `/ordens-servico`
- **Arquivo:** `frontend/src/app/ordens-servico/page.tsx` (linhas 140–146).
- **Evidência:**
  ```typescript
  if (dataInicio) {
    params.append('dataInicio', new Date(dataInicio).toISOString());
  }
  if (dataFim) {
    const dtFim = new Date(dataFim);
    dtFim.setHours(23, 59, 59, 999);
    params.append('dataFim', dtFim.toISOString());
  }
  ```
- **Impacto:** `new Date("YYYY-MM-DD")` cria a data à 00:00 UTC (21h do dia anterior em São Paulo), enquanto `dtFim.setHours(23, 59, 59)` opera sobre o relógio local e gera UTC `02:59:59` do dia posterior.
- **Solução Proposta:** Utilizar o padrão determinístico com offset `-03:00`: `${dataInicio}T00:00:00-03:00` e `${dataFim}T23:59:59-03:00`.

---

### ISSUE-06 — Risco de Open Redirect no Login (P2 — MÉDIA)
- **Rota:** `/login`
- **Arquivo:** `frontend/src/app/login/page.tsx` (linhas 20 e 66).
- **Evidência:**
  `const redirectUrl = searchParams.get('redirect') || '/dashboard';`
  `router.push(redirectUrl);`
  Sem sanitização, valores como `https://dominio-malicioso.com` ou `//externo.com` podem ser fornecidos na URL.
- **Impacto:** Vulnerabilidade comum de segurança web (CWE-601).
- **Solução Proposta:** Validar rigorosamente que `redirectUrl` inicia com `/` e NÃO inicia com `//`, rejeitando qualquer protocolo externo e redirecionando para `/dashboard` por padrão.

---

### ISSUE-07 a ISSUE-10 — Dívidas Técnicas e Performance (P3 — BAIXA)
- **ISSUE-07 (Rota `/`):** Redirecionar a rota raiz para `/dashboard` (se autenticado) ou `/login` (se não autenticado), eliminando a página estática de fundação.
- **ISSUE-08 (Purga de Tokens):** Criar rotina agendada no backend (`@Scheduled(cron = "0 0 3 * * ?")`) para excluir da tabela `refresh_tokens` registros expirados há mais de 30 dias.
- **ISSUE-09 (Lazy Loading Estoque):** Postergar a requisição de categorias e fornecedores em `/estoque` apenas para quando a seção de filtros avançados for expandida.
- **ISSUE-10 (Middleware Next.js):** Manter monitoramento da recomendação do Next.js sem intervenção abrupta, visto que o middleware atual é plenamente suportado e funcional.

---

## 4. Escopo Proposto para o Ciclo UX-009

A fase UX-009 terá como objetivo **exclusivo a estabilização e o endurecimento operacional**.
Nenhuma nova tela será criada. Nenhuma migration de schema de banco será introduzida.

### Itens Incluídos no Escopo:
1. **Resiliência de Sessão:** Implementar Promise de renovação compartilhada (*refresh mutex*) em `frontend/src/lib/api.ts`.
2. **Harmonização de Fuso Horário:**
   - Corrigir a inicialização e envio de data/hora em `/ordens-servico/nova`.
   - Substituir sufixo rígido `"Z"` em `/estoque/movimentacoes` por `-03:00`.
   - Padronizar filtros de período em `/ordens-servico` com `-03:00`.
3. **Eliminação de Alertas:** Substituir os últimos dois `alert()` nativos em `/maquinas/[id]`.
4. **Segurança de Redirecionamento:** Sanitizar o parâmetro `redirect` em `/login` contra open redirect.
5. **Aprimoramento da Rota Raiz (`/`):** Redirecionamento automático com base na sessão.
6. **Lazy Loading em `/estoque`:** Carregar categorias/fornecedores apenas sob demanda.
7. **Purga Automática de Sessões:** Adicionar método de limpeza periódica de tokens expirados no Spring Boot sem alterar schema.

---

## 5. Critérios de Aceite Objetivos

1. **Resiliência contra Concorrência:** Disparar 5 requisições simultâneas com token expirado deve resultar em exatamente 1 chamada ao `/api/auth/refresh`, todas as 5 requisições devem ser bem-sucedidas e a usuária não deve ser deslogada.
2. **Precisão Temporal Local:**
   - Abertura de OS após as 21h em fuso `-03:00` deve registrar a data e hora exatamente como selecionadas na tela.
   - Filtro de movimentações de estoque deve cobrir de `00:00:00` a `23:59:59` no horário de Brasília.
   - Filtro de ordens de serviço deve cobrir exatamente o mesmo intervalo na tela e no backend.
3. **Zero `window.alert()`:** O grep por `\balert\(` em todo o código de produção do frontend deve retornar 0 resultados.
4. **Proteção contra Open Redirect:** Parâmetros `?redirect=https://google.com` ou `?redirect=//evil.com` no login devem obrigatoriamente redirecionar para `/dashboard`.
5. **Integridade de Build e Testes:**
   - `mvnw.cmd test`: 210+ testes passando.
   - `npm test`: 190+ testes passando.
   - `npm run lint`: 0 erros, 0 warnings.
   - `npm run build`: sucesso sem falhas.
6. **Regras de Banco e Migrations:**
   - 0 migrations Flyway criadas.
   - V1–V9 100% intactas.
   - 0 tabelas/colunas modificadas no Neon.

---

## 6. Plano de Testes e Homologação

1. **Testes Unitários Frontend:**
   - Teste de concorrência de `apiFetch` simulando chamadas paralelas com 401.
   - Teste de sanitização de `redirectUrl` em `/login`.
   - Teste de formatação e parsing de datetime-local no fuso `-03:00`.
2. **Testes Unitários Backend:**
   - Teste do método de purga de refresh tokens no `AuthServiceTest`.
3. **Bateria de Homologação Manual (A a J):**
   - A. Múltiplas abas abertas simultaneamente após expiração de token.
   - B. Abertura de OS em horários de borda (00h01 e 23h55).
   - C. Filtro de movimentações por data e verificação de registros às 23h30.
   - D. Filtro de OS por data e conferência com banco.
   - E. Inativação de equipamento em `/maquinas/[id]` com toast.
   - F. Login com tentativa de redirecionamento malicioso.
   - G. Acesso à rota `/` autenticado e não autenticado.
   - H. Expansão de filtros avançados em `/estoque` e inspeção do Network.
   - I. Execução de rotina de purga sem falhas de integridade referencial.
   - J. Regressão completa de todas as 8 rotas principais.

---

## 7. Decisão e Recomendação Final

- **Caminho Escolhido:** **CAMINHO A**
- **Justificativa:** A existência de bugs comprovados de severidade **P1** (Race condition de refresh token que causa logout involuntário e drift temporal de data em Nova OS) e **P2** (inconsistências de fuso e segurança de redirect) requer uma intervenção cirúrgica de estabilização antes de declarar o sistema pronto para produção.
- **Orientação:** A fase **UX-009** deve ser focada e compacta, sem expandir escopo funcional ou criar novas interfaces.
