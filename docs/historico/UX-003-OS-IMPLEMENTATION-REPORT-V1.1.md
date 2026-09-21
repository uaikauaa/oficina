# UX-003 — RELATÓRIO DE IMPLEMENTAÇÃO DA NOVA TELA DE ORDENS DE SERVIÇO
# OFICINA GESTÃO V1.1

**Data de Conclusão:** 17 de Setembro de 2026  
**Status da Tela de OS:** APROVADA  
**Versão do Sistema:** V1.1 (V1.2 NÃO iniciada)  
**Banco de Dados:** PostgreSQL / Neon Serverless (V1–V9 intactas, 0 migrations)  

---

## 1. Estrutura Anterior

A tela anterior de Ordens de Serviço (`/ordens-servico`) sofria de sobrecarga visual e redundâncias:
- Cabeçalho com tags técnicas de desenvolvimento (*"Fluxo Técnico Central"* e *"Fase 5"*).
- Botão *"Prontas para Retirada ({metricas.prontas})"* posicionado no topo ao lado do botão de Nova OS, competindo com a ação principal e atuando como um filtro disfarçado de ação.
- 5 cards grandes de métricas que omitiam status críticos do dia a dia da oficina (como *Aguardando Aprovação* e *Aguardando Peça*).
- Barra de filtros com duas linhas verticais volumosas, mantendo inputs de data abertos e ocupando mais de 360px verticais.
- Tabela com baixa visibilidade na primeira dobra (apenas 2 a 3 linhas visíveis em 1366x768 com 125% de escala do Windows).
- Disparo de **7 requisições HTTP** no carregamento inicial (incluindo 5 chamadas fragmentadas `size=1` apenas para contadores parciais).

---

## 2. Estrutura Nova

A nova interface foi simplificada e otimizada para o trabalho operacional da oficina:
```
+--------------------------------------------------------------------------------------------------+
| ORDENS DE SERVIÇO                                                    [ + NOVA ORDEM DE SERVIÇO ] |
| Gestão e acompanhamento operacional dos atendimentos da oficina                                  |
+--------------------------------------------------------------------------------------------------+
| [Lupa] Buscar por nº da OS, cliente, telefone ou equipamento...  [X]   [ Mais Filtros v ] [Limpar]|
+--------------------------------------------------------------------------------------------------+
| (Painel Retrátil quando aberto: Período, Data Início e Data Fim)                                 |
+--------------------------------------------------------------------------------------------------+
| [Todas (14)] [Abertas (12)] [Ag. Aprovação (0)] [Em Manut. (0)] [Ag. Peça (0)] [Prontas (0)]...  |
+--------------------------------------------------------------------------------------------------+
| (Chip Ativo quando filtrado: Filtrando por: Prontas para Retirada (0 encontradas) [✕ Limpar] )   |
+--------------------------------------------------------------------------------------------------+
| TABELA COMPACTA (6–8 linhas visíveis na primeira dobra em 1366x768 @ 125%)                       |
| Nº OS | CLIENTE | EQUIPAMENTO | DATA | STATUS | TOTAL | AÇÃO                                      |
+--------------------------------------------------------------------------------------------------+
| Mostrando 1 a 14 de 14 ordens                                              [ < Página 1 de 1 > ] |
+--------------------------------------------------------------------------------------------------+
```

---

## 3. Filtros

- **Busca Principal Dominante:**
  - Campo unificado com debounce de 400ms.
  - Suporta pesquisa ampla: número da OS, nome do cliente, telefone, CPF/CNPJ, marca/modelo do equipamento e número de série.
  - Botão interativo `[X]` integrado para limpar a busca digitada em 1 clique.
- **Filtros Avançados (Painel Retrátil):**
  - Acionado pelo botão `[Mais Filtros ▼]` / `[Ocultar Filtros ▲]`.
  - Contém atalhos de período (*Todos*, *Últimos 30 dias*, *Últimos 90 dias*, *Este Ano*) e campos de data inicial e final.
  - Fica recolhido por padrão, liberando espaço vertical valioso na tela.
  - Indicador numérico em badge quando houver filtros de data ativos.
- **Limpeza Rápida:**
  - Botão *"Limpar"* exibido dinamicamente na barra superior sempre que houver qualquer filtro aplicado.

---

## 4. Status Operacionais e Filtro Ativo

- **Pills Compactas de Status:**
  - Substituição dos 5 cards volumosos por abas/pills horizontais com rolagem suave.
  - Contadores reais em tempo real para todos os status:
    - `Todas`
    - `Abertas`
    - `Aguardando Aprovação` *(NOVO — antes inexistente nos atalhos)*
    - `Em Manutenção`
    - `Aguardando Peça` *(NOVO — antes inexistente nos atalhos)*
    - `Prontas para Retirada` *(com badge esmeralda de destaque)*
    - `Concluídas`
    - `Canceladas`
- **Feedback de Filtro Ativo (Sincronização Dashboard $\rightarrow$ OS):**
  - Ao chegar por `/ordens-servico?status=PRONTA` ou `/ordens-servico?status=AGUARDANDO_APROVACAO`, a pill correspondente é destacada e um chip é exibido:  
    `Filtrando por: [Nome do Status] (X encontradas) [✕ Limpar filtro]`
  - O clique no `✕ Limpar filtro` reseta o status e recarrega todas as ordens em 1 clique.

---

## 5. Tabela Operacional

Tabela otimizada com 7 colunas funcionais:
1. **Nº da OS:** Badge mono contrastante (`OS-2026-XXXX`).
2. **Cliente:** Nome completo em negrito + telefone de contato em cinza.
3. **Equipamento:** Marca/modelo + número de série.
4. **Data:** Data de entrada formatada no padrão limpo `DD/MM/AAAA`.
5. **Status:** Badge semântico oficial com cor semântica.
6. **Total:** Valor monetário formatado (`R$ 0,00`) alinhado à direita.
7. **Ação:** Botão compacto `Abrir` com ícone de seta externa.

*A linha inteira da tabela possui `cursor-pointer` e hover suave, abrindo a OS com 1 clique.*

---

## 6. Paginação

- Texto informativo claro: *"Mostrando X a Y de Z ordens"*.
- Indicador *"Página X de Y"*.
- Botões de navegação anterior/próxima com estados desabilitados nos limites.
- Cálculo preciso do intervalo exibido para 0, 1, 15, 20 ou centenas de registros.

---

## 7. Performance e Chamadas HTTP

| Métrica | ANTES (Legado) | DEPOIS (UX-003) | Redução |
| :--- | :---: | :---: | :---: |
| **Total de Requisições HTTP** | **7 chamadas** | **3 chamadas** | **-57.1%** |

### Detalhamento das Requisições no Carregamento:
- **Antes (7 chamadas):**
  1. `GET /api/auth/me`
  2. `GET /api/ordens-servico?page=0&size=15...` (listagem)
  3. `GET /api/ordens-servico?size=1` (contador total)
  4. `GET /api/ordens-servico?status=ABERTA&size=1`
  5. `GET /api/ordens-servico?status=EM_MANUTENCAO&size=1`
  6. `GET /api/ordens-servico?status=PRONTA&size=1`
  7. `GET /api/ordens-servico?status=CONCLUIDA&size=1`
- **Depois (3 chamadas):**
  1. `GET /api/auth/me`
  2. `GET /api/ordens-servico/contadores-status` *(Consolida todos os 8 status + total em 1 única requisição)*
  3. `GET /api/ordens-servico?page=0&size=15&sort=dataEntrada,desc`

---

## 8. Arquivos Alterados

### Backend
1. [NEW] [OrdemServicoContadoresStatusDTO.java](file:///c:/Projetos/oficina-gestao/backend/src/main/java/com/oficinagestao/dto/OrdemServicoContadoresStatusDTO.java)
   - DTO consolidado com contadores para todos os status.
2. [MODIFY] [OrdemServicoService.java](file:///c:/Projetos/oficina-gestao/backend/src/main/java/com/oficinagestao/service/OrdemServicoService.java)
   - Adicionado método `obterContadoresStatus()`.
3. [MODIFY] [OrdemServicoController.java](file:///c:/Projetos/oficina-gestao/backend/src/main/java/com/oficinagestao/controller/OrdemServicoController.java)
   - Adicionado endpoint `GET /api/ordens-servico/contadores-status`.
4. [MODIFY] [OrdemServicoServiceTest.java](file:///c:/Projetos/oficina-gestao/backend/src/test/java/com/oficinagestao/service/OrdemServicoServiceTest.java)
   - Adicionado teste unitário `deveObterContadoresStatusCorretamente`.

### Frontend
5. [MODIFY] [types.ts](file:///c:/Projetos/oficina-gestao/frontend/src/lib/types.ts)
   - Adicionada interface `OrdemServicoContadoresStatus`.
6. [MODIFY] [page.tsx](file:///c:/Projetos/oficina-gestao/frontend/src/app/ordens-servico/page.tsx)
   - Redesenho completo da tela com cabeçalho compacto, botão hero, barra de busca dominante, painel retrátil de filtros, pills com contadores reais, chip de filtro ativo, tabela compacta e paginação.
7. [NEW] [ordensServicoLista.test.ts](file:///c:/Projetos/oficina-gestao/frontend/src/lib/ordensServicoLista.test.ts)
   - 17 testes unitários cobrindo renderização de status, contadores, filtro ativo, limpeza, busca, filtros avançados, paginação, estados vazio/erro, navegação e formatação.

---

## 9. Testes e Regressão

### Backend (Maven)
- **Comando**: `.\mvnw.cmd test`
- **Total de Testes**: **195 testes** (194 existentes + 1 novo teste de contadores de status)
- **Falhas**: **0**
- **Erros**: **0**
- **Resultado**: `BUILD SUCCESS`

### Frontend (Node Test Runner)
- **Comando**: `npm test`
- **Total de Testes**: **61 testes** (44 existentes + 17 novos testes unitários da listagem)
- **Falhas**: **0**
- **Resultado**: APROVADO

### Linting (ESLint)
- **Comando**: `npm run lint`
- **Erros**: **0**
- **Warnings**: **0**
- **Resultado**: APROVADO

### Build de Produção
- **Comando**: `npm run build`
- **Compilador**: Next.js 16.3.5 (Turbopack)
- **Rotas Estáticas e Dinâmicas**: 14/14 compiladas com sucesso
- **Resultado**: `SUCCESS`

---

## 10. Validação Funcional dos 10 Cenários Operacionais

Executado script automatizado de ponta a ponta `scratch/test_ux_003_ordens_servico.mjs`:
- **TESTE 1 (/ordens-servico)**: Listagem carregada com sucesso retornando 14 ordens reais.
- **TESTE 2 (Pesquisar OS)**: Busca por "Solda" retornou 2 registros com precisão.
- **TESTE 3 (Aguardando Aprovação)**: Filtro por `AGUARDANDO_APROVACAO` executado e sincronizado com os contadores.
- **TESTE 4 (Prontas)**: Filtro por `PRONTA` executado e sincronizado.
- **TESTE 5 (Mais Filtros)**: Filtro avançado com período de 30 dias retornou as ordens do intervalo.
- **TESTE 6 (Limpar Filtros)**: Ação de limpeza restaurou a listagem completa (14 registros).
- **TESTE 7 (Abrir OS)**: Detalhes da OS carregados com integridade total (`/ordens-servico/315`).
- **TESTE 8 (Nova OS)**: Rota `/ordens-servico/nova` íntegra.
- **TESTE 9 & 10 (Frontend & URL com Status)**: Acesso direto com query string `?status=PRONTA` no Next.js retornando HTTP 200.

---

## 11. Responsividade e Primeira Dobra

- Em resolução **1366x768 com 125% de escala do Windows**:
  - A altura dos blocos superiores foi reduzida de 360px para aproximadamente 185px.
  - São exibidas de **6 a 8 linhas da tabela diretamente na primeira dobra**, eliminando o esforço de rolagem para ver os atendimentos de entrada.
- Zero scroll horizontal global; overflow contido na tabela em telas menores (1280x720).

---

## 12. Migrations e Integridade do Banco

- **Migrations Adicionadas**: **0**
- **Migrations Alteradas**: **0**
- **Schema**: Preservado integralmente (V1–V9 intactas).
