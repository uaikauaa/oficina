# UX-008 — AUDITORIA PROFUNDA E PROPOSTA TÉCNICA
# MODERNIZAÇÃO DO MÓDULO GERENCIAL DE RELATÓRIOS
## Oficina Gestão — Versão 1.1

- **Data**: 17/09/2026
- **Status**: PROPOSTA PARA APROVAÇÃO (NÃO IMPLEMENTAR AINDA)
- **Domínio**: Oficina Técnica Especializada em Máquinas de Solda (Inversoras TIG/MIG/MMA) e Geradores de Energia
- **Alvo**: `/relatorios` (Módulo Gerencial e Consultivo)
- **Regra de Ouro**: **0 migrations**, **0 alterações de schema**, **0 alterações de código nesta etapa**, foco em ergonomia, performance, eliminação de bloqueios nativos e experiência gerencial fluida.

---

## 1. Objetivo

Realizar a auditoria profunda da área de **Relatórios (`/relatorios`)** e apresentar a proposta técnica e de design para o **UX-008**, consolidando o módulo como o **centro gerencial consultivo** da oficina.

O módulo deve fornecer respostas imediatas para tomada de decisão estratégica e técnica:
- Faturamento consolidado por período e ordens concluídas;
- Posição crítica de reposição de estoque técnico (IGBTs, pontes retificadoras, capacitores, tochas, reguladores);
- Histórico auditável de movimentações de estoque vinculadas a Ordens de Serviço;
- Ranking de componentes de maior giro para compras preventivas;
- Valor e volume histórico gerado por cada cliente;
- Indicadores de manutenção e faturamento acumulado por equipamento atendido.

A proposta visa eliminar a sobrecarga visual e vertical em telas compactas (1366x768 com 125% de escala no Windows), extinguir 12 popups nativos `window.alert()`, otimizar cascatas de requisições na inicialização, introduzir atalhos rápidos de período ("Hoje", "7 dias", "30 dias", "Mês Atual"), eliminar botões redundantes e assegurar exportações CSV completas e robustas.

---

## 2. Auditoria Funcional da Tela Atual

A rota `/relatorios` foi construída como um painel de consulta em abas, dividida em 6 visões operacionais e gerenciais.

### 2.1 Mapeamento de Recursos Existentes
- **Abas de Navegação**: 6 abas horizontais com ícones e rótulos (`Ordens de Serviço`, `Situação do Estoque`, `Movimentações de Estoque`, `Peças Mais Utilizadas`, `Clientes`, `Equipamentos`).
- **Filtros por Período**: Campos `type="date"` manuais para data inicial e final em Ordens de Serviço e Movimentações de Estoque.
- **Filtros Específicos**:
  - Em *Ordens de Serviço*: seletor de status (`Todos`, `ABERTA`, `EM_DIAGNOSTICO`, `AGUARDANDO_PECA`, `EM_EXECUCAO`, `EM_TESTE`, `PRONTA`, `CONCLUIDA`, `CANCELADA`).
  - Em *Estoque*: seletores de Categoria e Fornecedor, e checkboxes para "Apenas Estoque Baixo" e "Apenas Zerados".
  - Em *Movimentações*: seletor de tipo (`ENTRADA`, `SAIDA_MANUAL`, `BAIXA_ORDEM_SERVICO`, `ESTORNO_ORDEM_SERVICO`) e campo de texto livre para `Número da OS`.
- **Paginação**: Controle de páginas com `size=15` e botões de anterior/próximo (`ChevronLeft` / `ChevronRight`).
- **Exportação CSV**: Botão principal no topo da página e botões individuais redundantes dentro de cada bloco de filtros.
- **Cards de Resumo**: Exclusivos da aba de *Ordens de Serviço* (Total de OS, Concluídas, Abertas, Canceladas, Faturamento de Concluídas).
- **Tratamento de Erros**: Faixa superior de alerta (`AlertTriangle`) e múltiplos alertas nativos do navegador (`window.alert`).

### 2.2 Diagnóstico de Fricção e Ineficiências
1. **Excesso de Cliques para Filtrar Períodos**: Não existem botões de atalho (*Hoje*, *Últimos 7 dias*, *Últimos 30 dias*, *Mês Atual*). Para consultar o mês corrente, o usuário é obrigado a abrir dois calendários manuais, navegar entre meses e selecionar os dias individualmente.
2. **Duplicação Visual de Botões**: Em todas as abas, há um botão "Exportar CSV" na barra de filtros e outro botão "Exportar CSV" idêntico no cabeçalho superior.
3. **Eager Loading Desnecessário**: Ao carregar a página (que inicia por padrão na aba *Ordens de Serviço*), o frontend dispara `GET /api/categorias?size=100` e `GET /api/fornecedores?size=100`, dados que só são utilizados se o usuário clicar na aba *Situação do Estoque*.
4. **Alerta Nativo Invasivo (`window.alert`)**: Ao tentar exportar um relatório vazio ou quando ocorre uma falha de rede, são disparados alertas modais nativos que congelam a execução do navegador e degradam a experiência.
5. **Digitação sem Debounce em Movimentações**: O input de texto "Número da OS" não possui debounce na digitação se for associado à busca dinâmica.
6. **Ambiguidade de Timezone nos Parâmetros de Data**: O frontend concatena `T00:00:00Z` e `T23:59:59Z` nas datas escolhidas, forçando UTC zero, enquanto o servidor e a oficina operam no fuso horário de Brasília (`America/Sao_Paulo`, UTC-3).

---

## 3. Auditoria dos 6 Relatórios Existentes

A tabela a seguir consolida a auditoria individual dos 6 relatórios oficiais do sistema:

| Relatório | Endpoint Backend | Finalidade Gerencial | Usuário Típico | Freq. Uso | Filtros Disponíveis | Requests Iniciais | Paginação | Exportação CSV | Problemas Identificados | Oportunidade de Simplificação |
|---|---|---|---|---|---|---|---|---|---|---|
| **1. Ordens de Serviço** | `GET /api/relatorios/ordens-servico` | Acompanhar volume de entradas, ordens em andamento, taxas de conclusão e faturamento acumulado | Proprietário / Gerente / Atendente | Diária | Data Início, Data Fim, Status | 1 (resumo + itens) | Sim (size=15) | Sim (completa via `fetchTodosRegistrosRelatorio`) | A cada troca de página ou exportação, recalcula 5 queries agregadas no banco. Não tem presets de data. | Adicionar presets de período ("Hoje", "7 dias", "Mês Atual"). Compactar os 5 cards para poupar espaço. |
| **2. Situação do Estoque** | `GET /api/relatorios/estoque` | Prevenção de falta de peças de alto giro para inversoras e geradores; controle de reposição | Técnico Líder / Gerente de Peças | 2 a 3x por semana | Categoria, Fornecedor, Estoque Baixo, Zerado | 1 (mais 2 auxiliares no mount) | Sim (size=15) | Sim (completa) | Categorias e fornecedores são carregados no mount global mesmo que a aba não seja aberta. | Carregar categorias e fornecedores sob demanda (lazy load) apenas ao acessar a aba. |
| **3. Movimentações de Estoque** | `GET /api/relatorios/movimentacoes` | Rastreabilidade e auditoria de entradas, saídas manuais, baixas automáticas em OS e estornos de bancada | Gerente / Almoxarife | Semanal | Data Início, Data Fim, Tipo Movimentação, Número OS | 1 (histórico) | Sim (size=15) | Sim (completa) | Filtro de OS sem debounce. Falta de atalhos de data. | Integrar presets de data e alinhar layout com tabela compacta. |
| **4. Peças Mais Utilizadas** | `GET /api/relatorios/pecas-mais-utilizadas` | Identificar componentes mais aplicados em manutenções para negociação de compras em lote e estoque de segurança | Gerente / Comprador | Mensal | Nenhum (ranking geral por consumo) | 1 (ranking) | Sim (size=15) | Sim (completa) | Cabeçalho muito alto com card descritivo desnecessariamente expansivo. | Reduzir card descritivo para uma linha compacta com badge de destaque do pódio (1º, 2º, 3º). |
| **5. Clientes** | `GET /api/relatorios/clientes` | Avaliar carteira de clientes ativos, volume de máquinas vinculadas, fidelidade e receita gerada | Gerente Comercial / Atendimento | Semanal / Mensal | Nenhum (ordenado por nome) | 1 (clientes) | Sim (size=15) | Sim (completa) | Executa 4 subconsultas correlacionadas por cliente no banco. Card de introdução ocupa espaço excessivo. | Compactar cabeçalho, permitir busca por nome no client-side ou manter paginação ágil. |
| **6. Equipamentos** | `GET /api/relatorios/equipamentos` | Histórico técnico consolidado de máquinas atendidas (soldas e geradores), quantidade de manutenções e faturamento gerado | Técnico Líder / Gerente | Semanal / Mensal | Nenhum (ordenado por ID desc) | 1 (equipamentos) | Sim (size=15) | Sim (completa) | Executa 3 subconsultas correlacionadas por máquina. Card de topo consome altura excessiva. | Compactar cabeçalho e harmonizar badges de tipo de equipamento (`MAQUINA_SOLDA`, `GERADOR`, `OUTROS`). |

---

## 4. Auditoria da Exportação CSV

A exportação CSV foi submetida a teste prático contra o banco de dados real via script dedicado de homologação (`test_csv_export_live.mjs`):

### 4.1 Conformidade Técnica Verificada
- **UTF-8 Byte Order Mark (BOM: `\uFEFF`)**: **PRESENTE E HOMOLOGADO**. O arquivo inicia com `\uFEFF`, garantindo abertura direta no Microsoft Excel brasileiro sem desconfigurar caracteres como `ã`, `õ`, `ç`, `é` (ex: "Concluída", "Módulo IGBT", "Homologação").
- **Delimitador Ponto e Vírgula (`;`)**: **PRESENTE E HOMOLOGADO**. Separação por `;`, padrão exigido pelas configurações regionais do Windows em português.
- **Escape RFC 4180**: Campos contendo ponto e vírgula, quebras de linha ou aspas duplas são encapsulados por aspas duplas e têm aspas internas duplicadas (`""`).
- **Quebras de Linha CRLF (`\r\n`)**: **CONFIRMADO**. Compatibilidade nativa com Windows sem linhas vazias extras.
- **Formatação Monetária e Numérica**: Valores decimais formatados no padrão pt-BR (`R$ 150,00`, `1.540,50`).

### 4.2 Verificação de Integridade de Múltiplas Páginas (Dataset Completo)
- O sistema conta com a função `fetchTodosRegistrosRelatorio` em `frontend/src/lib/csvExportHelper.ts`.
- Foi realizado teste forçando lotes menores de requisição (`batchSize = 5` para Ordens de Serviço e `batchSize = 10` para Movimentações):
  - **Ordens de Serviço**: 17 registros no banco recuperados com sucesso em 4 páginas e exportados integralmente em 18 linhas (1 cabeçalho + 17 dados).
  - **Movimentações de Estoque**: 40 registros no banco recuperados com sucesso em 4 páginas e exportados integralmente.
- **Conclusão**: O problema histórico de exportar apenas a página atual ativa na tela **está 100% resolvido**. A exportação extrai **todo o conjunto de dados filtrado**.

### 4.3 Ponto de Atenção na Exportação
- Em todas as funções `handleExportarCsv*`, existem blocos que disparam `alert('Não há dados...')` e `alert(err.message)`.
- Se o conjunto de dados estiver vazio, em vez de um toast discreto, a tela é bloqueada por um diálogo nativo.

---

## 5. Ergonomia e UX em 1366x768 (Escala Windows 125%)

Em monitores típicos de escritório e bancada com resolução física de 1366x768 e zoom de tela de 125%, o espaço de visualização útil (viewport) é de aproximadamente **1092 x 614 pixels**.

### 5.1 Ocupação Vertical Atual (Aba Ordens de Serviço)
1. Cabeçalho global do sistema (`Header.tsx`): **~68px**
2. Título da página e subtítulo (`Relatórios da Oficina` + descrição): **~76px**
3. Barra de abas horizontais (6 botões): **~46px**
4. Barra de filtros (3 inputs + botões em bloco alto): **~84px**
5. Grade de 5 cards de resumo (grid 2x5): **~112px**
6. Margens e paddings intermediários (`space-y-6` = 24px cada intervalo): **~96px**
7. Cabeçalho da tabela de dados: **~44px**

**Soma acumulada antes da primeira linha de dados**: **~526px**.
Em uma janela de navegador com barra de navegação e abas (que consome ~90-120px da tela física de 614px), sobram menos de **50px** para o conteúdo útil da tabela. O usuário **não enxerga nenhum registro sem rolar a página para baixo**.

### 5.2 Comparativo com o Padrão V1.1 Consolidado
- **Dashboard (UX-002)**: Header compacto de 44px com métricas condensadas em linha única.
- **Ordens de Serviço (UX-003)**: Filtros em linha horizontal única com pills de status de acesso instantâneo.
- **Clientes (UX-004)**: Título enxuto com busca integrada e tabela iniciando imediatamente após a barra de ferramentas.
- **Equipamentos (UX-005)**: Barra de busca com debounce, pills rápidas de tipo (`Soldas`, `Geradores`) e tabela visível na primeira dobra.
- **Produtos & Estoque (UX-006)**: Cards de contadores compactados e barra de filtros densa e ergonômica.
- **Diagnóstico em Relatórios**: É a única tela que manteve um cabeçalho inchado, botões duplicados de exportação e cards desnecessariamente altos.

---

## 6. Performance e Ciclo de Requisições

### 6.1 Cascatas e Requisições Iniciais
- Ao entrar em `/relatorios`:
  1. `GET /api/auth/me` (validação de usuário autenticado);
  2. `GET /api/categorias?size=100` (eager load para filtros de estoque);
  3. `GET /api/fornecedores?size=100` (eager load para filtros de estoque);
  4. `GET /api/relatorios/ordens-servico?page=0&size=15` (dados da aba padrão).
- **Inconsistência**: As requisições 2 e 3 são desnecessárias se o usuário apenas quiser consultar Ordens de Serviço, Clientes ou Equipamentos. Devem ser migradas para carga sob demanda (lazy) acionada apenas quando a aba *Situação do Estoque* for selecionada.

### 6.2 Custo de Execução no Backend (`obterRelatorioOsPorPeriodo`)
- Cada chamada a este método executa:
  1. `ordemServicoRepository.contarPorPeriodoEStatus(dataInicio, dataFim, null)`
  2. `ordemServicoRepository.contarPorPeriodoEStatus(dataInicio, dataFim, CONCLUIDA)`
  3. `ordemServicoRepository.contarAbertasPorPeriodo(dataInicio, dataFim)`
  4. `ordemServicoRepository.contarPorPeriodoEStatus(dataInicio, dataFim, CANCELADA)`
  5. `ordemServicoRepository.somarValorConcluidasPorPeriodo(dataInicio, dataFim)`
  6. `ordemServicoRepository.pesquisarGlobal(null, status, dataInicio, dataFim, pageable)` (contagem de paginação + busca de linhas)
- Total: **7 queries SQL executadas por página**. Durante a paginação da tabela ou exportação em múltiplos lotes, as 5 queries de resumo são recalculadas de forma redundante.

---

## 7. Segurança e Proteção de Rotas

1. **Frontend**:
   - `frontend/src/middleware.ts` intercepta todas as requisições para `/relatorios` e `/relatorios/:path*`.
   - Na ausência do cookie `access_token`, redireciona imediatamente para `/login?redirect=/relatorios`.
2. **Backend**:
   - `SecurityConfig.java` exige a autoridade `ROLE_ADMIN` para qualquer endpoint `/api/**`.
   - `RelatorioController` é anotado com `@SecurityRequirement(name = "cookieAuth")` e `@SecurityRequirement(name = "bearerAuth")`.
   - Tentativas de acesso não autenticado retornam `HTTP 401 Unauthorized` estruturado via `ApiErrorResponse`.
3. **Exposição de Dados**:
   - DTOs específicos retornam apenas os dados agregados necessários para a visão gerencial.
   - Nenhuma senha, hash de segurança ou token é trafegado ou exposto nos endpoints de relatórios.

---

## 8. Contratos e Validação de Entradas

- Os endpoints de `/api/relatorios/*` foram submetidos a testes com entradas inválidas:
  - `status=INVALIDO` em OS → **HTTP 400 Bad Request** (`MethodArgumentTypeMismatchException`).
  - `dataInicio=nao-e-data` → **HTTP 400 Bad Request**.
  - `categoriaId=abc` em Estoque → **HTTP 400 Bad Request**.
  - `tipo=INEXISTENTE` em Movimentações → **HTTP 400 Bad Request**.
  - Requisição sem cookie → **HTTP 401 Unauthorized**.
- **Comportamento Conforme**: Todas as entradas inválidas são interceptadas e tratadas pelo `GlobalExceptionHandler`, retornando código 400 com mensagem clara em JSON (`ApiErrorResponse`), sem nunca disparar erro 500 não tratado.

---

## 9. Catálogo de Problemas Identificados

| ID | Severidade | Rota / Componente | Descrição do Problema | Evidência Técnica | Impacto Operacional | Comportamento Proposto | Risco | Migration |
|---|---|---|---|---|---|---|---|---|
| **UX008-01** | **P1** | `/relatorios` (`page.tsx`) | 12 chamadas nativas de `window.alert()` em fluxos de exportação CSV vazio e falha de API | Linhas 324, 347, 369, 386, 408, 427, 445, 459, 477, 493, 511, 529 | Trava a thread da interface; experiência antiquada que quebra automações e padrão do sistema | Substituir por toasts elegantes de notificação e banner de erro não-bloqueante | Mínimo | 0 |
| **UX008-02** | **P1** | `/relatorios` (`page.tsx`) | Ocupação vertical excessiva (526px) empurrando a tabela para fora da tela em 1366x768 @ 125% | Cabeçalho alto + 6 abas + filtros em bloco + 5 cards grandes = tabela oculta sem scroll | Usuário precisa rolar a página repetidamente a cada filtro ou consulta de dados | Cabeçalho compacto (linha única), cards de resumo condensados e barra de filtros enxuta | Mínimo | 0 |
| **UX008-03** | **P1** | `/relatorios` (`page.tsx`) | Eager loading ineficiente de Categorias e Fornecedores no mount global da página | `useEffect` nas linhas 137–150 busca `/api/categorias` e `/api/fornecedores` mesmo na aba de OS | Requisições HTTP inúteis consumindo banda e processamento na entrada da página | Carregar categorias e fornecedores sob demanda apenas ao abrir a aba "Situação do Estoque" | Mínimo | 0 |
| **UX008-04** | **P1** | `/relatorios` (`page.tsx`) | Botão de exportação CSV duplicado em cada aba e no topo da página | Botão "Exportar CSV" presente no header e replicado dentro da caixa de filtros de cada aba | Desperdício de espaço em telas compactas e poluição visual | Manter botão de exportação no cabeçalho superior contextual à aba ativa, eliminando botões duplicados | Mínimo | 0 |
| **UX008-05** | **P2** | `/relatorios` (`page.tsx`) | Ausência de atalhos rápidos de período ("Presets de Data") | Usuário é forçado a manipular inputs `type="date"` com múltiplos cliques no calendário | Perda de tempo ao gerar consultas do dia, semana ou mês corrente | Inclusão de pílulas rápidas: "Hoje", "7 Dias", "30 Dias", "Mês Atual" e "Limpar" | Mínimo | 0 |
| **UX008-06** | **P2** | `/relatorios` (`page.tsx`) | Ausência de debounce no campo textual de filtro de OS em Movimentações | Campo `movNumeroOs` atualiza estado sem debounce e não há chip indicador de filtros ativos | Risco de consultas prematuras e falta de clareza sobre filtros aplicados | Aplicar debounce de 300ms no campo e adicionar badge de contagem de filtros ativos | Mínimo | 0 |
| **UX008-07** | **P2** | `/relatorios` (`page.tsx`) | Formatação rígida de datas com sufixo `Z` ignorando fuso local | Parâmetros enviados como `${osDataInicio}T00:00:00Z` e `T23:59:59Z` em vez do offset de Brasília | Possibilidade de corte de 3 horas em ordens geradas no fim da noite | Formatar datas respeitando a virada de dia no horário local ou enviando sem offset rígido incorreto | Mínimo | 0 |
| **UX008-08** | **P2** | `RelatorioService.java` | Recálculo redundante dos 5 agregadores de resumo da OS em todas as requisições de página e exportação | 5 queries agregadas executadas repetidamente em cada página navegada e em cada lote de CSV | Carga desnecessária de queries no PostgreSQL / Neon | Manter contrato DTO estável; frontend pode preservar resumo e não reexecutar caso os filtros de período não tenham mudado | Baixo | 0 |
| **UX008-09** | **P3** | `/relatorios` (`page.tsx`) | Estados vazios com textos simples sem ação de recuperação | Tabelas exibem mensagem estática cinza sem botão "Limpar filtros" para retorno rápido | Usuário precisa localizar os campos de filtro para resetar a busca | Adicionar botão interativo "Limpar Filtros" diretamente no estado vazio | Mínimo | 0 |
| **UX008-10** | **P3** | `/relatorios` (`page.tsx`) | Inconsistência na formatação de colunas inteiras no CSV | Quantidade de equipamentos e OS exportadas como número bruto sem padronização de tipo | Estética desigual ao abrir o arquivo no Excel | Padronizar formatação numérica inteira e monetária em todas as 6 funções de exportação | Mínimo | 0 |

---

## 10. Priorização Objetiva

Com base nos critérios estabelecidos na diretriz de auditoria (frequência de uso, impacto na ergonomia, redução de cliques, risco de erro e consumo de rede):

1. **Prioridade Máxima (P1)**:
   - **UX008-02**: Redesenho do layout para 1366x768 @ 125% DPI (tabela visível na primeira dobra sem scroll forçado).
   - **UX008-01**: Eliminação completa dos 12 alertas nativos `window.alert()`.
   - **UX008-04**: Remoção da duplicidade do botão de exportação e unificação no cabeçalho contextual.
   - **UX008-03**: Lazy loading de categorias e fornecedores para eliminar requisições desperdiçadas no mount.

2. **Prioridade Média (P2)**:
   - **UX008-05**: Implementação de pílulas com presets de data (*Hoje*, *7 Dias*, *30 Dias*, *Mês Atual*).
   - **UX008-06**: Debounce no filtro textual e badge de filtros ativos.
   - **UX008-07**: Correção do timezone nos limites de data enviados à API.
   - **UX008-08**: Otimização no envio e reuso dos dados de resumo de OS.

3. **Polimento Visual (P3)**:
   - **UX008-09**: Estados vazios amigáveis com botão "Limpar Filtros".
   - **UX008-10**: Harmonização das colunas numéricas no gerador de CSV.

---

## 11. Proposta Técnica e de Interface (UX-008)

### 11.1 Nova Arquitetura de Interface em 1366x768 (Windows 125%)
A tela de relatórios adotará a mesma linguagem refinada desenvolvida no **UX-002** (Dashboard) e **UX-005** (Equipamentos):

```
+-----------------------------------------------------------------------------------------------+
| HEADER COMPACTO: [BarChart3] RELATÓRIOS GERENCIAIS | [Exportar CSV (Aba Ativa)] [Atualizar]   |
+-----------------------------------------------------------------------------------------------+
| ABAS SLIM: [Ordens de Serviço (17)]  [Estoque (10)]  [Movimentações]  [Peças]  [Clientes]  [Equip]|
+-----------------------------------------------------------------------------------------------+
| BARRA DE FILTROS INTEGRADA (Linha Única):                                                     |
| Presets: [Hoje] [7 Dias] [30 Dias] [Mês Atual] | [Data Início] [Data Fim] [Status v] [Limpar]  |
+-----------------------------------------------------------------------------------------------+
| MINI-CARDS DE RESUMO CONDENSADOS (Aba OS):                                                    |
| [ Total: 17 ]  [ Concluídas: 3 ]  [ Abertas: 13 ]  [ Canceladas: 1 ]  [ Faturamento: R$ 380 ] |
+-----------------------------------------------------------------------------------------------+
| TABELA DE DADOS VISÍVEL IMEDIATAMENTE (Primeira dobra da tela sem necessidade de scroll)       |
| Nº OS      | Cliente                 | Equipamento         | Entrada    | Status    | Total   |
| OS-2026-56 | Cliente Solda UX 178... | ESAB LHN 280i Plus  | 17/09/2026 | CONCLUIDA | R$ 150  |
+-----------------------------------------------------------------------------------------------+
| PAGINAÇÃO COMPACTA: Página 1 de 2 (Total: 17 registros)                       [< Anterior] [Próximo >] |
+-----------------------------------------------------------------------------------------------+
```

### 11.2 Detalhamento das Melhorias
1. **Cabeçalho Unificado**:
   - Título em linha única: `Relatórios Gerenciais` com badge discreta `Módulo Consultivo`.
   - Botão de exportação CSV único no topo direito, com ícone e estado dinâmico (`Exportar Ordens (CSV)`, `Exportar Estoque (CSV)`, etc.) com animação suave de loading durante o processamento.
2. **Presets Rápidos de Período**:
   - Pílulas clicáveis que preenchem instantaneamente as datas:
     - **Hoje**: data atual nas duas pontas.
     - **7 Dias**: últimos 7 dias corridos.
     - **30 Dias**: últimos 30 dias corridos.
     - **Mês Atual**: do dia 1 do mês corrente até a data atual.
   - Elimina até 8 cliques de calendário por consulta.
3. **Cards de Resumo Condensados**:
   - Em vez de caixas verticais de 112px com textos explicativos redundantes, transformar em chips horizontais elegantes de 48px de altura com ícones compactos e valores destacados.
4. **Lazy Loading de Dados Auxiliares**:
   - Categorias e fornecedores são requisitados apenas se a aba `estoque` for clicada pela primeira vez.
5. **Eliminação de `window.alert()`**:
   - Substituição por banners informativos e toasts temporários no canto superior/inferior direito da tela.

---

## 12. Escopo do UX-008

### 12.1 Escopo Incluído
- Refatoração da página `frontend/src/app/relatorios/page.tsx` para seguir o design system compacto V1.1.
- Criação de componente de pílulas de filtros de data rápida (`DatePresetPills`).
- Redução da altura dos cards de resumo e do cabeçalho de página.
- Remoção de todos os 12 `window.alert()`, implementando feedback visual moderno.
- Remoção dos botões redundantes de exportação dentro dos formulários de filtro.
- Otimização do carregamento de categorias e fornecedores (lazy loading na aba Estoque).
- Adição de debounce de 300ms na busca textual de OS em Movimentações.
- Ajuste no envio de datas locais para a API (eliminação do sufixo `Z` incorreto).
- Garantia de 0 regressões nas 6 abas e nas exportações CSV.
- Testes automatizados unitários no frontend para os novos helpers de relatório e presets de data.

### 12.2 Escopo Estritamente Excluído
- Criação de relatórios novos além dos 6 existentes.
- Geração de relatórios em formato PDF ou impressão (não previstos na V1.1 e sem necessidade técnica).
- Criação de novas tabelas ou migrations de banco de dados (0 migrations).
- Alteração de rotas ou quebra de contratos de API existentes.
- Inclusão de conceitos automotivos (a oficina atende exclusivamente soldas e geradores).

---

## 13. Critérios de Aceite

1. **Ergonomia e Visibilidade na Primeira Dobra**:
   - Em viewport 1092x614 (1366x768 @ 125%), as primeiras 3 a 5 linhas da tabela de dados devem estar visíveis imediatamente sem exigir scroll vertical na carga inicial da aba.
2. **Zero Popups Nativos do Navegador**:
   - Nenhuma chamada a `window.alert()`, `window.confirm()` ou `window.prompt()` deve existir em todo o código de relatórios.
3. **Presença de Presets de Data**:
   - As opções "Hoje", "7 Dias", "30 Dias", "Mês Atual" devem estar presentes nas abas de Ordens de Serviço e Movimentações e preencher os campos corretamente ao clique.
4. **Exportação CSV Íntegra e Completa**:
   - As 6 exportações devem gerar arquivos `.csv` válidos com UTF-8 BOM, separador `;`, acentuação legível no Excel e 100% dos dados filtrados (múltiplas páginas recuperadas sem truncamento).
5. **Carga Sob Demanda**:
   - A carga inicial de `/relatorios` não deve disparar requisições para `/api/categorias` nem `/api/fornecedores` antes do clique na aba de estoque.
6. **Integridade de Contratos**:
   - Todos os endpoints backend mantêm compatibilidade total com os DTOs atuais.
7. **Estabilidade da Suíte de Testes**:
   - 100% dos 209 testes de backend e 155 testes de frontend continuam passando com sucesso.
   - Lint sem erros e build de produção aprovado.

---

## 14. Plano de Testes Detalhado

### 14.1 Testes Automatizados no Frontend
- Testes para as funções de presets de data:
  - Cálculo correto da data de "Hoje" (início e fim no mesmo dia);
  - Cálculo correto de "7 Dias" e "30 Dias";
  - Cálculo correto do "Mês Atual" (dia 1 até dia de hoje);
  - Limpeza dos filtros.
- Testes para a formatação de parâmetros de consulta sem quebra de timezone.
- Testes de renderização dos dados das 6 abas e exportação CSV completa.

### 14.2 Testes Automatizados no Backend
- Manutenção e validação de:
  - `RelatorioServiceTest`: 100% verde (cálculo de resumo, contadores, ranking de peças, clientes e máquinas);
  - `ReleaseSmokeTest`: 100% verde;
  - `GlobalExceptionHandlerTest`: validação de retorno 400 para filtros inválidos.

### 14.3 Testes de Validação de CSV
- Execução de script automatizado testando a extração dos 6 relatórios com datasets reais:
  - Ordens de Serviço: 17 registros;
  - Movimentações de Estoque: 40 registros com paginação;
  - Situação de Estoque: 10 produtos;
  - Peças Mais Utilizadas: ranking de componentes;
  - Clientes: lista consolidada com faturamento;
  - Equipamentos: lista consolidada com histórico.
- Checagem automática do byte `\uFEFF`, quebras `\r\n` e delimitador `;`.

---

## 15. Plano de Regressão Operacional Obrigatória

Após a implementação do UX-008, será executada a bateria completa de regressão em todos os módulos:

1. `/dashboard`: Carregamento dos contadores operacionais, status de bancada e atalhos de navegação.
2. `/clientes`: Listagem, busca, cadastro de novo cliente e visualização da ficha detalhada.
3. `/maquinas`: Listagem, pills de filtro (`Soldas`, `Geradores`), cadastro de máquina e histórico de manutenções.
4. `/ordens-servico`: Gestão de OS, contadores de status, filtro por período e listagem paginada.
5. `/ordens-servico/nova`: Fluxo rápido de abertura de OS com seleção de cliente e equipamento.
6. `/ordens-servico/[id]`: Cockpit de Bancada Técnica (UX-007), adição e estorno de peças, checklist de testes técnicos sob carga, transição de status, geração de PDF e link do WhatsApp.
7. `/produtos`: Cadastro de peças, tabela com busca e controle de estoque mínimo.
8. `/estoque`: Movimentações manuais de entrada e saída, auditoria de estoque.
9. `/relatorios`: Navegação fluida entre as 6 abas, filtros com presets, exportação CSV em lote e visualização otimizada.

---

## 16. Necessidade de Migrations

- **Necessidade de Alteração de Banco**: **ZERO (0 MIGRATIONS)**.
- Todas as estruturas necessárias (tabelas `tb_ordem_servico`, `tb_ordem_servico_item`, `tb_produto`, `tb_estoque_movimentacao`, `tb_cliente`, `tb_maquina`) já estão indexadas e atendem plenamente às consultas consolidadas e relatórios.
- As versões Flyway V1 a V9 permanecerão rigorosamente intactas.

---

## 17. Conclusão da Proposta

O **UX-008** completará o ciclo de modernização da interface da aplicação **Oficina Gestão V1.1**, alinhando o módulo gerencial de relatórios ao mesmo patamar de excelência, ergonomia e velocidade operacional implementado nos módulos anteriores (UX-001 ao UX-007).
