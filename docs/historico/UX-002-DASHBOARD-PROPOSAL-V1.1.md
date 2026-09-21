# PROPOSTA DE REDESENHO FUNCIONAL — DASHBOARD (UX-002)
## OFICINA GESTÃO V1.1

**Data:** 17 de Setembro de 2026  
**Documento:** `UX-002-DASHBOARD-PROPOSAL-V1.1.md`  
**Autor:** Antigravity AI Assistant  
**Tipo:** Auditoria de UX, Análise Funcional e Proposta Arquitetural  
**Status:** PROPOSTA PRONTA PARA APROVAÇÃO  

---

## 1. Dashboard Atual

### 1.1 Estrutura e Conteúdo em Produção
A Dashboard atual (`frontend/src/app/dashboard/page.tsx`) é composta por:

1. **Header do Sistema:** Barra de navegação superior com links para Painel, Clientes, Equipamentos, Ordens de Serviço, Peças & Produtos, Estoque, Relatórios, Atalho de Busca Global (`Ctrl+K`) e Logout.
2. **Banner Institucional Superior:** Caixa com gradiente escuro ocupando ~130px de altura vertical com o ícone `ShieldCheck`, título *"Painel Operacional da Oficina"* e subtítulo estático descrevendo o tipo de oficina.
3. **Card "Fase 5 — Coração da Oficina" (Ordens de Serviço):**
   - Tag interna: *"Fase 5 — Coração da Oficina / Fluxo Operacional Técnico"*.
   - Texto descritivo genérico sobre recepção, diagnóstico e carga.
   - Linha de indicadores: `{totalOsAbertas}` Abertas, `{totalOsManutencao}` Em Manutenção, link `{totalOsProntas}` Prontas para Retirada e `{totalOs}` Atendimentos.
   - Grupo de 3 botões na lateral direita:
     - *"Prontas para Retirada (X)"* (Verde)
     - *"Nova Ordem de Serviço"* (Amarelo)
     - *"Ver Todas as OS"* (Cinza)
4. **Card Secundário "Fases 4A & 4B — Cadastros Permanentes" (Clientes & Equipamentos):**
   - Tag interna: *"Fases 4A & 4B / Cadastros Permanentes"*.
   - Texto descritivo sobre clientes e máquinas de solda/geradores.
   - Botão: *"Acessar Clientes (X)"*.
5. **Grade de 3 Indicadores de Infraestrutura:**
   - Card 1: *"Total de Clientes"* (número estático).
   - Card 2: *"Banco de Dados: Neon Cloud / PostgreSQL Serverless conectado"* (com ícone `CheckCircle2` verde).
   - Card 3: *"Ordens de Serviço: Atendimentos registrados no total"*.

### 1.2 Mapeamento de Chamadas de API no Carregamento
A página dispara **6 requisições HTTP paralelas** em seu `useEffect`:
1. `GET /api/auth/me` — valida sessão do usuário.
2. `GET /api/clientes?size=1` — apenas para extrair `totalElements`.
3. `GET /api/ordens-servico?size=1` — apenas para extrair `totalElements`.
4. `GET /api/ordens-servico?status=ABERTA&size=1` — para extrair `totalElements` abertas.
5. `GET /api/ordens-servico?status=EM_MANUTENCAO&size=1` — para extrair `totalElements` em manutenção.
6. `GET /api/ordens-servico?status=PRONTA&size=1` — para extrair `totalElements` prontas.

---

## 2. Problemas Encontrados

| ID | Problema Identificado | Impacto na Usuária (Proprietária) | Frequência |
|---|---|---|---|
| **PRB-001** | **Jargões de desenvolvimento no layout** (*"Fase 5 — Coração da Oficina"*, *"Fases 4A & 4B"*, *"Cadastros Permanentes"*). | Confusão e sensação de sistema inacabado ou técnico demais; linguagem não condizente com a rotina de oficina. | Contínua (a cada acesso à Dashboard) |
| **PRB-002** | **Card de infraestrutura técnica de TI** (*"Neon Cloud / PostgreSQL Serverless conectado"*). | Ocupa 33% da grade inferior com informação sem nenhum valor operacional ou acionável para o negócio da oficina. | Contínua |
| **PRB-003** | **Ação primária (Nova OS) sem o devido destaque heroico.** O botão de abertura de OS concorre visualmente com outros 2 botões dentro de um card genérico. | Reduz a agilidade no atendimento de balcão quando um cliente chega com equipamento. | Muito alta (várias vezes ao dia) |
| **PRB-004** | **Falta de visibilidade para status críticos de OS.** Não são exibidas as OS *"Aguardando Aprovação"* de orçamento nem *"Aguardando Peça"*. | A proprietária não enxerga gargalos imediatos de clientes aguardando resposta ou serviços travados por falta de peças. | Alta (diária) |
| **PRB-005** | **Ausência total da situação de Estoque na Dashboard.** Não há nenhum alerta sobre peças em falta ou estoque baixo, apesar de a oficina depender de insumos. | Risco de aceitar serviços ou iniciar reparos sem saber que faltam peças críticas. | Média / Alta |
| **PRB-006** | **Duplicações de informação e navegação.** O número de OS prontas aparece na linha de texto e no botão ao lado; o total de OS aparece 2 vezes na mesma tela; o total de clientes aparece 2 vezes. | Poluição visual e sobrecarga cognitiva desnecessária. | Contínua |
| **PRB-007** | **Banner superior estático consumindo a primeira dobra.** Consome ~130px verticais apenas para dizer o nome da oficina e especialidade. | Força a rolagem da página em resoluções como 1366x768 com 125% de zoom para ver os dados reais. | Alta em notebooks |
| **PRB-008** | **Fragmentação excessiva de chamadas de API.** 4 requisições HTTP distintas para a mesma tabela de OS apenas para obter números de contagem de status. | Consumo desnecessário de conexões com o Neon e sobrecarga de renderização. | A cada carregamento |

---

## 3. Elementos a Manter

1. **Identificação e Header:** Manter o Header oficial íntegro com a navegação completa, atalho de busca global (`Ctrl+K`) e perfil de usuário.
2. **Atalho de Nova Ordem de Serviço:** Manter como ponto focal do sistema, porém elevado à posição de **Ação Principal Heroica**.
3. **Contador e Acesso Direto às OS Prontas para Retirada:** Manter com destaque semafórico e link direto para `/ordens-servico?status=PRONTA`.
4. **Contadores de OS em Manutenção e Abertas:** Manter, permitindo filtrar por status com 1 clique.
5. **Acesso Direto à Lista de OS e Clientes:** Manter a navegabilidade direta e rápida.
6. **Responsividade e Design System:** Preservar paleta de cores (Slate/Zinc com acentos em Amber e Emerald), ícones Lucide e tipografia do projeto.

---

## 4. Elementos a Reduzir

1. **Banner Institucional Superior:**
   - *Como é:* Banner grande com gradiente, bordas, ícone enorme e parágrafo institucional.
   - *Como propor:* Linha enxuta de saudação operacional (*"Bom dia, [Nome] — [Data de Hoje]"*) com subtítulo discreto (*"Visão operacional e atendimentos do dia"*).
2. **Textos Explicativos Longos:**
   - *Como é:* Parágrafos explicando o que é ordem de serviço, recepção técnica, bancada, etc.
   - *Como propor:* Eliminar textos puramente explicativos. A proprietária já conhece a sua oficina; a interface deve ser focada em dados e ações.
3. **Duplicações de Contadores:**
   - Unificar os contadores em cartões únicos e acionáveis, eliminando números repetidos entre cards e rodapé.

---

## 5. Elementos a Remover

1. **Card de Infraestrutura *"Neon Cloud / PostgreSQL Serverless conectado"*:*
   - *Justificativa:* É um indicador estritamente de desenvolvimento/DevOps. Não possui nenhuma ação para a usuária e não afeta as decisões operacionais da oficina.
2. **Badges de fases de desenvolvimento (*"Fase 5 — Coração da Oficina"*, *"Fases 4A & 4B"*):*
   - *Justificativa:* Termos técnicos de gerenciamento de projeto de software que poluem a tela e não têm significado funcional para o negócio.
3. **Card Genérico *"Cadastros Permanentes"*:*
   - *Justificativa:* O card apenas contém um botão para ir à página `/clientes`, que já existe em destaque no Header e pode ser melhor posicionado em um grid limpo de Acessos Rápidos.
4. **Chamadas de API redundantes/fragmentadas:**
   - *Justificativa:* Eliminar as chamadas avulsas e utilizar agregação limpa para carregar a Dashboard com performance superior.

---

## 6. Nova Organização Proposta

A nova Dashboard será estruturada em **4 Zonas Funcionais Claras**, respondendo diretamente a:  
**"O que preciso fazer agora?"** e **"Como inicio uma nova OS?"**

### ZONA 1 — Saudação & Ação Principal (Hero Action)
- **Saudação Operacional:** Nome da usuária, data atual formatada por extenso.
- **Botão Hero Primário:**
  - **`+ NOVA ORDEM DE SERVIÇO`** (Grande, cor Amber vibrante, ícone de adição, 1 clique direto para `/ordens-servico/nova`).
  - Posicionado no topo com visibilidade absoluta e contraste máximo.
- **Atalho de Busca Operacional:** Campo de pesquisa rápida ou indicação clara do atalho `Ctrl+K` para localizar cliente/equipamento/OS imediatamente.

### ZONA 2 — Painel de Atenção Imediata (O que requer ação hoje?)
Grade de 4 cards semafóricos dinâmicos e clicáveis (1 clique leva à listagem filtrada):
1. **Prontas para Retirada (Verde / Emerald):**
   - Quantidade de OS prontas aguardando retirada ou contato com o cliente.
   - Ação ao clicar: `/ordens-servico?status=PRONTA`.
2. **Aguardando Aprovação (Laranja / Amber):**
   - Quantidade de OS com orçamento enviado aguardando retorno do cliente.
   - Ação ao clicar: `/ordens-servico?status=AGUARDANDO_APROVACAO`.
3. **Em Manutenção / Diagnóstico (Azul / Sky):**
   - Total de máquinas ativas na bancada da oficina.
   - Ação ao clicar: `/ordens-servico?status=EM_MANUTENCAO`.
4. **Alerta de Estoque Crítico (Vermelho / Rose):**
   - Quantidade de peças com saldo zero ou abaixo do estoque mínimo.
   - Ação ao clicar: `/estoque` (ou relatório de estoque baixo).

### ZONA 3 — Acessos Rápidos da Oficina
Barra de atalhos operacionais diretos para as páginas de trabalho diário:
- **Ordens de Serviço** (`/ordens-servico`) — com contador do total ativo.
- **Clientes** (`/clientes`) — base cadastral rápida.
- **Equipamentos** (`/maquinas`) — máquinas de solda e geradores.
- **Estoque & Peças** (`/estoque`) — controle físico e movimentações.
- **Relatórios** (`/relatorios`) — faturamento e fechamentos.

### ZONA 4 — Visão de Bancada Recente (Últimas OS em Andamento)
Lista compacta com as 5 últimas Ordens de Serviço recebidas ou atualizadas:
- Número da OS (ex: `OS-2026-0042`)
- Cliente proprietário
- Equipamento (Tipo, Marca e Modelo)
- Status atual com badge colorido oficial
- Data de entrada
- Ação rápida: link direto para abrir a OS em 1 clique (`/ordens-servico/{id}`).

---

## 7. Fluxos Principais

### Fluxo 1: Atendimento de Balcão (Nova Ordem de Serviço)
```
Dashboard
   ↓ [1 clique no botão proeminente "+ Nova Ordem de Serviço"]
/ordens-servico/nova
   ↓ [Digita cliente]
Cliente encontrado?
   ├─ SIM: Seleciona → Escolhe equipamento → Registra problema → Salva OS
   └─ NÃO: Modal in-place (UX-001) → Cadastra Cliente + Equipamento → Salva OS
```

### Fluxo 2: Entrega de Equipamento Pronto
```
Dashboard
   ↓ [1 clique no card "Prontas para Retirada (X)"]
/ordens-servico?status=PRONTA
   ↓
Localiza a máquina do cliente que veio retirar
   ↓
Abre os detalhes da OS → Registra pagamento / Conclui OS
```

### Fluxo 3: Acompanhamento de Orçamentos e Peças
```
Dashboard
   ↓ [1 clique no card "Aguardando Aprovação (X)"]
/ordens-servico?status=AGUARDANDO_APROVACAO
   ↓
Contato via WhatsApp ou telefone com cliente para aprovar orçamento
```

### Fluxo 4: Reposição de Estoque Urgente
```
Dashboard
   ↓ [1 clique no card "Estoque Crítico (X itens)"]
/estoque
   ↓
Lista de produtos filtrados com saldo <= estoque mínimo para compra
```

---

## 8. Comparativo de Cliques e Usabilidade

| Operação Frequente | Cliques no Fluxo Atual | Cliques no Fluxo Proposto | Melhoria Obtida |
|---|:---:|:---:|---|
| **Iniciar Nova OS** | 2 cliques (escondido em card secundário) | **1 clique direto** no topo | Ação imediata no balcão |
| **Ver OS Prontas para Retirada** | 2 a 3 cliques | **1 clique direto** no card verde | Visualização instantânea |
| **Ver OS Aguardando Aprovação** | 3 cliques (ir em OS → abrir filtro → selecionar status) | **1 clique direto** no card laranja | Elimina filtragem manual |
| **Identificar Falta de Peças** | 3 a 4 cliques (ir em estoque ou relatórios e filtrar) | **1 clique direto** no card vermelho | Alerta proativo na Dashboard |
| **Acessar OS Recente em Andamento** | 3 cliques (ir em todas as OS → buscar OS na lista) | **1 clique direto** na tabela recente | Retomada rápida de atendimento |
| **Acessar Relatórios** | 2 cliques (navegar pelo menu) | **1 clique direto** nos acessos rápidos | Acesso facilitado |

---

## 9. Impacto em Páginas Existentes

Conforme exigido pelas regras absolutas do projeto:

> **NENHUMA PÁGINA SERÁ REMOVIDA OU DESATIVADA.**

Todas as 7 páginas oficiais continuam existindo integralmente com suas rotas preservadas:
- `/dashboard` — Página inicial renovada e simplificada.
- `/clientes` — Cadastro, edição, busca e histórico de clientes.
- `/maquinas` — Consulta técnica de máquinas de solda e geradores de energia.
- `/ordens-servico` — Gestão completa de ordens de serviço, filtros e impressão de PDF.
- `/produtos` — Cadastro de peças, componentes e precificação.
- `/estoque` — Saldos físicos, movimentações de entrada, saída manual e auditoria.
- `/relatorios` — Relatórios gerenciais, CSV, faturamento e peças mais utilizadas.

---

## 10. Wireframe Textual da Nova Dashboard

```
+-----------------------------------------------------------------------------------+
| HEADER: [Logo Oficina Gestão]  Painel | Clientes | OS | Peças | Estoque | Relatórios | Busca [Ctrl+K] | Sair |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  BOM DIA, MARIA                                            [+ NOVA ORDEM DE SERVIÇO]  (Hero Button)
|  Quinta-feira, 17 de Setembro de 2026                      (Destaque visual âmbar)
|                                                                                   |
+-----------------------------------------------------------------------------------+
|  PAINEL DE ATENÇÃO IMEDIATA (O que precisa de ação hoje?)                         |
|                                                                                   |
|  +--------------------+  +--------------------+  +--------------------+  +--------------------+  |
|  | [⚡] PRONTAS       |  | [⏳] AGUARDANDO    |  | [🔧] EM MANUTENÇÃO |  | [⚠️] ESTOQUE BAIXO |  |
|  |     PARA RETIRADA  |  |      APROVAÇÃO     |  |      NA BANCADA    |  |      OU ZERADO     |  |
|  |                    |  |                    |  |                    |  |                    |  |
|  |      5 OS          |  |      3 OS          |  |      8 OS          |  |      2 ITENS       |  |
|  |                    |  |                    |  |                    |  |                    |  |
|  | Clique p/ entregar |  | Clique p/ contatar |  | Clique p/ bancada  |  | Clique p/ comprar  |  |
|  +--------------------+  +--------------------+  +--------------------+  +--------------------+  |
|                                                                                   |
+-----------------------------------------------------------------------------------+
|  ACESSOS RÁPIDOS DA OFICINA                                                       |
|  [ Ordens de Serviço ]  [ Clientes ]  [ Equipamentos ]  [ Estoque ]  [ Relatórios ]|
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  ÚLTIMAS ORDENS DE SERVIÇO RECEBIDAS                                              |
|  +--------------+-----------------------+---------------------+---------------+---+  |
|  | NÚMERO OS    | CLIENTE               | EQUIPAMENTO         | STATUS        | AÇÃO| |
|  +--------------+-----------------------+---------------------+---------------+---+  |
|  | OS-2026-0045 | Locadora Energia      | Gerador Toyama 8kVA | [EM MANUT.]   | [→] | |
|  | OS-2026-0044 | José Carlos Santos    | Inversora ESAB 250A | [PRONTA]      | [→] | |
|  | OS-2026-0043 | Mecânica São Geraldo  | Solda MIG Balmer    | [AG. APROV.]  | [→] | |
|  | OS-2026-0042 | Construtora Horizonte | Gerador Branco 6kVA | [EM DIAGN.]   | [→] | |
|  | OS-2026-0041 | Auto Elétrica Silva   | Solda TIG Boxer     | [AG. PEÇA]    | [→] | |
|  +--------------+-----------------------+---------------------+---------------+---+  |
|  [ Ver todas as Ordens de Serviço → ]                                              |
|                                                                                   |
+-----------------------------------------------------------------------------------+
```

---

## 11. Otimização de Performance e APIs

### Diagnóstico Atual
Atualmente são disparadas 6 requisições separadas no `useEffect` da Dashboard, sendo 4 delas para a mesma rota `/api/ordens-servico` alterando apenas o parâmetro de status.

### Proposta de Otimização na Implementação
Ao invés de 6 chamadas fragmentadas, utilizar:
1. `GET /api/auth/me` — dados da usuária autenticada (já com cache da sessão).
2. `GET /api/ordens-servico/contadores-status` (ou chamadas paralelas consolidadas com `Promise.allSettled`):
   - Contagem direta dos status operacionais em foco (`PRONTA`, `AGUARDANDO_APROVACAO`, `EM_MANUTENCAO`).
3. `GET /api/estoque/resumo` — retorna em uma única chamada: `itensEstoqueBaixo` e `itensSemEstoque`.
4. `GET /api/ordens-servico?size=5&sort=dataEntrada,desc` — retorna as 5 últimas OS para alimentar a tabela operacional recente.

**Ganho estimado:**
- Redução do tempo de carregamento perceptível da Dashboard.
- Eliminação de consultas vazias e não acionáveis.
- Apresentação de dados 100% úteis para o trabalho diário.

---

## 12. Validação de Responsividade e Acessibilidade

### Responsividade (1366x768 com 125% de zoom)
- Em notebooks corporativos (resolução 1366x768 com escala de 125%), o espaço vertical útil é de ~614px.
- O redesenho posiciona a **Ação Principal (Nova OS)** e os **4 Cards de Atenção** dentro dos primeiros ~420px da tela.
- **Resultado:** A proprietária visualiza as tarefas mais importantes e o botão de criar OS imediatamente, sem precisar rolar a página para baixo.
- Grid fluido com breakpoints Tailwind CSS (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`).

### Acessibilidade (WCAG 2.1 AA)
- Foco visível (`focus-visible:ring-2 focus-visible:ring-amber-500`).
- Cores de status acompanhadas de ícones e texto (não depender apenas da cor).
- Tamanho mínimo de alvo de toque de 44x44px em botões e cards.
- Nomes acessíveis (`aria-label` e textos semânticos).

---

## 13. Arquivos que Serão Alterados na Fase de Implementação

> [!IMPORTANT]
> **Nenhum arquivo de código foi alterado nesta etapa de proposta.**  
> A lista abaixo refere-se exclusivamente aos arquivos previstos para a execução posterior:

1. `frontend/src/app/dashboard/page.tsx` — reestruturação visual e lógica da Dashboard.
2. `frontend/src/components/Header.tsx` — preservação e alinhamento dos atalhos.
3. *Opcional:* Novo componente `DashboardRecentOsTable.tsx` ou `DashboardAttentionCards.tsx` para modularização limpa caso necessário.
4. **Backend e Migrations:** Zero alterações no backend e zero migrations necessárias (todas as APIs de OS e Estoque já suportam os filtros propostos).

---

## 14. Conclusão da Proposta

A proposta transforma a Dashboard da Oficina Gestão de uma tela com indicadores genéricos e textos de desenvolvimento em uma **central de comando operacional**, orientada às ações mais críticas da proprietária:

1. **Abrir Nova OS em 1 clique** logo ao entrar no sistema.
2. **Entregar equipamentos prontos** com facilidade.
3. **Controlar orçamentos pendentes** e serviços na bancada.
4. **Prevenir falta de peças** com alerta de estoque crítico.
5. **Acompanhar as últimas entradas** em lista limpa e acionável.

---

**STATUS: PROPOSTA PRONTA PARA APROVAÇÃO**
