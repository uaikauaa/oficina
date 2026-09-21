# UX-003 — PROPOSTA DE SIMPLIFICAÇÃO DA TELA DE ORDENS DE SERVIÇO
## OFICINA GESTÃO V1.1

**Data:** 17 de Setembro de 2026  
**Fase:** Auditoria e Proposta de UX (Sem alteração de código nesta etapa)  
**Versão:** V1.1 (V1.2 NÃO iniciada)  
**Status:** PROPOSTA PRONTA PARA APROVAÇÃO  

---

## 1. Estrutura Atual

A página de Ordens de Serviço (`/ordens-servico`) é o ponto nevrálgico da rotina da oficina. Atualmente, sua estrutura na tela apresenta os seguintes blocos verticais:

1. **Cabeçalho:**
   - Badge com texto técnico *"Fluxo Técnico Central"* e label *"Fase 5"*.
   - Título *"Ordens de Serviço"* acompanhado de ícone e descrição longa.
   - Dois botões no canto direito:
     - Botão verde destacado: *"Prontas para Retirada ({metricas.prontas})"*.
     - Botão âmbar: `"+ Nova Ordem de Serviço"`.
2. **Cards de Métricas / Filtros Rápidos (5 cards em grid):**
   - `Total de OS` (todas as ordens).
   - `Abertas` (status = `ABERTA`).
   - `Em Manutenção` (status = `EM_MANUTENCAO`).
   - `Prontas para Retirada` (status = `PRONTA`).
   - `Concluídas` (status = `CONCLUIDA`).
3. **Barra de Filtros e Pesquisa (composta por 2 linhas verticais):**
   - Linha 1:
     - Input de busca textual com placeholder longo (*"Buscar por Nº da OS, cliente, CPF/CNPJ, equipamento ou nº de série..."*).
     - Dropdown `<select>` de status contendo *"Todos os Status"* e os 8 status do enum.
     - Botão *"Limpar"*.
   - Linha 2 (Período):
     - Label *"Período:"* com 4 atalhos em botões (*"Todos"*, *"Últimos 30 dias"*, *"Últimos 90 dias"*, *"Este Ano"*).
     - Dois inputs de data nativos (`<input type="date">` início e fim) com texto intermediário *"até"*.
4. **Tabela de Ordens de Serviço (7 colunas):**
   - `Nº da OS`: Badge com fonte mono (ex: `OS-2026-0045`).
   - `Cliente`: Nome em negrito + telefone em cinza abaixo.
   - `Equipamento`: Marca + Modelo na primeira linha, Tipo de Equipamento + Número de Série na segunda linha.
   - `Data Entrada`: Data e hora formatadas (`DD/MM/AAAA HH:mm`).
   - `Status`: Badge colorido no formato pill com a descrição do status.
   - `Valor Total`: Valor formatado em moeda (`R$ 0,00`) alinhado à direita.
   - `Ações`: Botão cinza *"Detalhes"* com ícone de seta externa.
5. **Paginação:**
   - Informação de paginação (*"Mostrando X de Y registros"*).
   - Botões de navegação anterior/próxima e indicador *"Página X de Y"*.
   - Tamanho fixo em 15 registros por página sem seletor de quantidade.

---

## 2. Problemas Encontrados

A pergunta central da auditoria é:  
> *"Uma pessoa que trabalha diariamente na oficina consegue encontrar e alterar uma OS rapidamente?"*

A resposta atual é: **Encontra, mas enfrenta atritos, poluição visual, cliques desnecessários e desorientação de contexto.**

### Principais Inconsistências e Problemas:

1. **Disputa Visual com a Ação Principal:**
   - O botão `+ Nova Ordem de Serviço` divide a atenção com o botão vizinho *"Prontas para Retirada"*. O botão de prontas é, na verdade, um filtro disfarçado de botão de ação no topo.
2. **Sobrecarga Vertical na Primeira Dobra (1366x768 @ 125%):**
   - Cabeçalho grande + 5 cards de métricas + 2 linhas de filtros consomem mais de **360px verticais**. Em telas com resolução comum de oficina (notebooks ou monitores 1366x768 com 125% de escala do Windows), sobram apenas 2 a 3 linhas da tabela visíveis sem rolar a página.
3. **Ausência do Status Crítico "Aguardando Aprovação" nos Cards de Topo:**
   - A nova Dashboard possui o indicador *"Aguardando Aprovação"*, que direciona para `/ordens-servico?status=AGUARDANDO_APROVACAO`. Ao aterrissar na tela de OS, o usuário se depara com 5 cards no topo que **NÃO contêm** "Aguardando Aprovação". Isso causa confusão visual e perda do contexto de navegação.
4. **Filtros de Data Ocupando Espaço Nobre Desnecessariamente:**
   - No dia a dia da oficina mecânica, o operador quase nunca filtra por faixa de data específica para atender quem está no balcão; ele busca pelo nome, pela placa/série ou pelo status da bancada. Os filtros de data avançada ficam ocupando espaço nobre permanentemente.
5. **Redundância de Ações e Cliques:**
   - Existem 3 formas diferentes de filtrar "Prontas para Retirada": o botão do cabeçalho, o card de métricas e o dropdown de status.
   - A linha inteira da tabela já possui clique (`onClick`), tornando o botão isolado *"Detalhes"* na última coluna redundante e desperdiçando largura útil da tela.
6. **Falta de Indicador Visual Claro de Filtro Ativo:**
   - Quando a usuária clica num card da Dashboard (ex: *Prontas para Retirada* ou *Aguardando Aprovação*), a página de OS aplica o filtro no select, mas **não exibe nenhuma tag/badge em evidência** indicando *"Filtrando por: Prontas para Retirada (X encontradas) [Limpar filtro]"*.
7. **Linguagem Técnica Residual:**
   - O cabeçalho ainda exibe badges de desenvolvimento: *"Fluxo Técnico Central"* e *"Fase 5"*, totalmente irrelevantes para a proprietária ou técnico da oficina.
8. **Inchaço de Requisições HTTP (Performance):**
   - Ao carregar a página `/ordens-servico`, o frontend dispara **7 requisições HTTP** simultâneas (1 para usuário, 1 para listagem principal e 5 chamadas fragmentadas `size=1` apenas para preencher os 5 cards de contadores).

---

## 3. Elementos para Manter

Os seguintes elementos funcionam bem e devem ser preservados:

1. **Campo de Busca Global Rápida:**
   - O mecanismo de busca unificada por número de OS, cliente, telefone, CPF/CNPJ, equipamento e número de série é extremamente útil e rápido (debounce de 400ms).
2. **Identificação Clara das OS:**
   - A exibição combinada do número da OS em fonte mono e cor destacada (`OS-2026-XXXX`).
3. **Badges Oficiais de Status:**
   - Manter as cores semânticas já consolidadas no sistema (esmeralda para PRONTA, âmbar para ABERTA/AGUARDANDO_APROVACAO, azul para EM_MANUTENCAO, verde para CONCLUIDA, vermelho para CANCELADA).
4. **Navegação com Clique na Linha Inteira:**
   - A facilidade de clicar em qualquer ponto da linha da OS para abrir seus detalhes.
5. **Parâmetro de URL `?status=...`:**
   - Manter suporte ao parâmetro via query string para total integração com os cartões da Dashboard.

---

## 4. Elementos para Reduzir

1. **Cards de Métricas Superiores:**
   - Reduzir a altura dos cards ou substituí-los por uma **barra integrada de abas/pills de status operacionais** (ex: Todas, Abertas, Em Diagnóstico, Aguardando Aprovação, Em Manutenção, Aguardando Peça, Prontas, Concluídas), alinhando contadores diretamente com os cliques de filtro.
2. **Espaçamento do Cabeçalho:**
   - Reduzir o padding vertical do topo e a descrição institucional para ganhar no mínimo 60px úteis de visualização vertical.
3. **Filtros Avançados de Período:**
   - Condensar o bloco de filtros de data (30 dias, 90 dias, ano, data início/fim) em um dropdown recolhível de *"Filtros Avançados"*, exibido apenas sob demanda.
4. **Largura da Coluna de Ações:**
   - Substituir o botão largo *"Detalhes"* por uma indicação sutil de navegação (ícone de visualização rápida ou foco no clique natural da linha).

---

## 5. Elementos para Remover

1. ❌ **Linguagem Técnica de Desenvolvimento:**
   - Remover os badges *"Fluxo Técnico Central"* e *"Fase 5"*.
2. ❌ **Botão Redundante no Topo:**
   - Remover o botão *"Prontas para Retirada ({metricas.prontas})"* posicionado ao lado do botão de Nova OS no cabeçalho. (Esse filtro pertencerá exclusivamente à barra de filtros/abas de status).
3. ❌ **Inputs de Data Permanentes:**
   - Remover os inputs de data abertos que ocupam a segunda linha da barra de filtros.
4. ❌ **Requisições Fragmentadas de Contadores:**
   - Eliminar as 5 chamadas HTTP separadas para `/api/ordens-servico?status=...&size=1`.

---

## 6. Filtros Propostos

A nova organização dos filtros separará claramente a **Busca Operacional Imediata** dos **Filtros Avançados Ocasionais**.

### A. Busca Principal (Linha Única, Alta Visibilidade)
- **Input de Busca Rápida:**
  - Campo largo com ícone de lupa e botão rápido "X" para limpar busca digitada.
  - Placeholder direto: *"Buscar por nº da OS, cliente, telefone ou equipamento..."*.
- **Ação Principal Hero:**
  - Botão `+ NOVA ORDEM DE SERVIÇO` posicionado em destaque máximo no topo direito.
- **Botão "Mais Filtros" (Toggle retrátil):**
  - Permite abrir/fechar o painel de filtros secundários (datas e períodos).

### B. Abas de Status Operacionais (Pills Rápidas com Contadores)
Em vez de cards volumosos, utilizar uma linha de pills horizontais com rolagem suave que cobre os fluxos reais de oficina:
- **Todas** (total)
- **Abertas**
- **Aguardando Aprovação** *(NOVO - ausente na tela antiga)*
- **Em Manutenção**
- **Aguardando Peça** *(NOVO - ausente na tela antiga)*
- **Prontas para Retirada** *(Destaque especial esmeralda)*
- **Concluídas**
- **Canceladas**

### C. Feedback Visual de Filtro Ativo
Quando a página for aberta vindo da Dashboard (ex: `?status=PRONTA` ou `?status=AGUARDANDO_APROVACAO`):
- Exibir chip destacado:
  `[Filtro Ativo: Prontas para Retirada (X) ✕ Limpar]`
- Permitir desfazer o filtro com 1 único clique no botão de limpar.

---

## 7. Estrutura de Tabela Proposta

Tabela otimizada com 6 colunas funcionais, fontes legíveis e máximo aproveitamento horizontal:

| Coluna | Conteúdo | Justificativa Operacional |
| :--- | :--- | :--- |
| **Nº OS** | Código em fonte mono (ex: `OS-2026-0045`) | Identificador principal da oficina mecânica. |
| **Cliente** | Nome do cliente em destaque + Telefone abaixo | Contato imediato sem precisar abrir o cadastro. |
| **Equipamento** | Marca e Modelo + Tipo e Nº de Série | Identificação precisa da máquina na bancada. |
| **Data Entrada** | Data formatada (`DD/MM/AAAA`) | Controle do tempo em que a máquina está na oficina. |
| **Status** | Badge semântico com cor e label amigável | Visibilidade imediata da etapa atual do serviço. |
| **Valor Total** | R$ alinhado à direita | Valor aprovado ou total de peças e mão de obra. |
| **Ação** | Ícone discreto de abertura (`Eye` ou `ChevronRight`) | Feedback visual adicional de que o item é navegável. |

*(A linha inteira continua clicável para abrir a OS em 1 clique).*

---

## 8. Ações Propostas

### Ação Principal da Página
- **`+ NOVA ORDEM DE SERVIÇO`**
  - Posicionamento: Topo direito da página.
  - Estilo: Cor âmbar vibrante, ícone de `Plus`, peso em negrito.
  - Destino: `/ordens-servico/nova` em **1 clique**.
  - Sem concorrência visual com botões secundários no mesmo bloco.

### Ação na Linha da OS
- Clique na linha $\rightarrow$ Navega diretamente para `/ordens-servico/{id}`.
- O cursor muda para `cursor-pointer` com feedback de hover (`hover:bg-slate-800/50`).
- O botão *"Detalhes"* é substituído por um botão/ícone compacto de visualização rápida (`Abrir OS`).

---

## 9. Fluxo Ideal

```
1. OPERADOR ENTRA NA TELA DE OS:
   Visualiza imediatamente:
   - Botão Hero "+ NOVA ORDEM DE SERVIÇO"
   - Campo de Busca Rápida
   - Abas com contadores por status operacional
   - Tabela com as ordens de serviço mais recentes na primeira dobra

2. OPERADOR VEM DA DASHBOARD (ex: "Prontas para Retirada"):
   - Aterrissa em /ordens-servico?status=PRONTA
   - Vê a aba "Prontas para Retirada" selecionada
   - Vê tag de filtro: "Filtrando por: Prontas para Retirada (X encontradas) [✕ Limpar]"
   - Encontra a OS e abre com 1 clique

3. OPERADOR VEM DA DASHBOARD (ex: "Aguardando Aprovação"):
   - Aterrissa em /ordens-servico?status=AGUARDANDO_APROVACAO
   - Vê a aba "Aguardando Aprovação" selecionada com o contador exato
   - Visualiza imediatamente a lista dos orçamentos pendentes
   - Abre a OS para registrar a aprovação do cliente com 1 clique
```

---

## 10. Redução de Cliques

| Cenário Operacional | Cliques no Fluxo Atual | Cliques no Fluxo Proposto | Redução |
| :--- | :---: | :---: | :---: |
| **Criar Nova OS a partir da listagem** | 1 clique | 1 clique | Mantido imediato (sem distração) |
| **Consultar OS "Aguardando Aprovação" (vinda da tela de OS)** | 3 cliques (procurar select, abrir, selecionar) | 1 clique na pill de status | **-66%** |
| **Limpar filtro e voltar para todas** | 2 a 3 cliques | 1 clique no chip "Limpar" | **-50%** |
| **Buscar e abrir uma OS específica** | 2 cliques (focar campo, digitar, clicar) | 2 cliques com atalho de tecla opcional | Mantido rápido |
| **Visualizar ordens na primeira dobra (1366x768)** | 1 scroll longo obrigatório | 0 scroll (visível direto na primeira dobra) | **-100% de esforço de rolagem** |

---

## 11. Responsividade e Primeira Dobra

### Metas de Visualização:
- **Resolução 1366x768 (125% zoom do Windows):**
  - Altura total do cabeçalho + busca + abas de status $\le 190\text{px}$ (redução de $\sim 45\%$ em relação aos $360\text{px}$ atuais).
  - Pelo menos **6 a 8 linhas da tabela** devem estar visíveis imediatamente na primeira dobra, sem necessidade de rolagem.
- **Resolução 1280x720 (Monitores padrão de entrada):**
  - Tabela com rolagem horizontal contida e sem quebrar o layout da página.
  - Abas de status com rolagem horizontal suave (`overflow-x-auto`).
- **Dispositivos Móveis / Tablets (360px a 768px):**
  - Em telas pequenas, a linha da OS pode ser apresentada em formato de card compacto contendo: Número da OS, Cliente, Status e Valor.

---

## 12. Performance de Rede

| Métrica | Antes (Atual) | Depois (Proposto) | Ganho |
| :--- | :---: | :---: | :---: |
| **Requisições no Carregamento** | 7 chamadas HTTP | 2 ou 3 chamadas HTTP | **Redução de $\sim 60\%$** |
| **Chamadas Fragmentadas de Métricas** | 5 requisições `size=1` | 1 requisição consolidada (`/api/ordens-servico/contadores-dashboard`) | Eliminação de 4 requisições |

---

## 13. Wireframe Textual da Nova Interface

```
+--------------------------------------------------------------------------------------------------+
| [Header Global Oficina Gestão]                                                                  |
+--------------------------------------------------------------------------------------------------+
|                                                                                                  |
| ORDENS DE SERVIÇO                                                    [ + NOVA ORDEM DE SERVIÇO ] |
| Gestão e acompanhamento operacional dos atendimentos da oficina                                  |
|                                                                                                  |
| +---------------------------------------------------------------------+ +----------------------+ |
| | [Lupa] Buscar por nº da OS, cliente, telefone ou equipamento... [X] | | [ Mais Filtros v ]   | |
| +---------------------------------------------------------------------+ +----------------------+ |
|                                                                                                  |
| [Todas (42)] [Abertas (8)] [Aguardando Aprovação (5)] [Em Manutenção (6)] [Prontas (4)] [Conc.]  |
|                                                                                                  |
| (Quando houver filtro ativo: [Filtro Ativo: Aguardando Aprovação (5 encontradas) ✕ Limpar] )     |
|                                                                                                  |
| +----------------------------------------------------------------------------------------------+ |
| | Nº DA OS     | CLIENTE            | EQUIPAMENTO        | DATA       | STATUS       | TOTAL   |   | |
| +--------------+--------------------+--------------------+------------+--------------+---------+---| |
| | OS-2026-0045 | Construtora Silva  | ESAB LHN 280i      | 17/09/2026 | [EM MANUT.]  | R$ 250  | > | |
| | OS-2026-0044 | Metalúrgica Souza  | Schulz MSV 20      | 16/09/2026 | [AG. APROV.] | R$ 480  | > | |
| | OS-2026-0043 | João dos Santos    | Bambozzi 250A      | 16/09/2026 | [PRONTA]     | R$ 180  | > | |
| | OS-2026-0042 | Locadora Minas     | Toyama TG3000      | 15/09/2026 | [ABERTA]     | R$   0  | > | |
| | OS-2026-0041 | Auto Mecânica Vale | Vonder TIG 200     | 14/09/2026 | [CONCLUÍDA]  | R$ 320  | > | |
| +----------------------------------------------------------------------------------------------+ |
|                                                                                                  |
| Mostrando 1 a 15 de 42 ordens                              [ < Página 1 de 3 > ]                 |
+--------------------------------------------------------------------------------------------------+
```

---

## 14. Arquivos que Seriam Alterados na Futura Implementação

*(Apenas listagem para planejamento; nenhum arquivo foi alterado nesta etapa de auditoria)*

1. **Frontend:**
   - `frontend/src/app/ordens-servico/page.tsx`
     - Remoção dos jargões técnicos (*"Fluxo Técnico Central"*, *"Fase 5"*).
     - Remoção do botão redundante *"Prontas para Retirada"* ao lado do botão de Nova OS.
     - Unificação dos cards de contadores em abas/pills de status compactas (incluindo *Aguardando Aprovação* e *Aguardando Peça*).
     - Adição do chip/badge de feedback visual de filtro ativo com botão de limpeza rápida.
     - Recolhimento dos filtros de período em painel retrátil de filtros avançados.
     - Otimização do layout da tabela para liberar espaço vertical na primeira dobra (1366x768 @ 125%).
     - Substituição das 5 chamadas HTTP de métricas por consulta consolidada.
   - `frontend/src/lib/types.ts`
     - Atualização de interfaces auxiliares de contadores de OS, se necessário.
   - `frontend/src/lib/ordensServicoLista.test.ts` *(Novo teste unitário)*
     - Testes cobrindo comportamento dos filtros de status, abas, chip de filtro ativo e extração de dados.

2. **Backend:**
   - `backend/src/main/java/com/oficinagestao/service/OrdemServicoService.java`
     - Ajustar `obterContadoresDashboard()` ou criar método complementar para retornar os totais de status necessários para as abas da tela de OS de forma agrupada e performática.
   - `backend/src/main/java/com/oficinagestao/controller/OrdemServicoController.java`
     - Ajustar DTO de contadores se novas contagens forem incorporadas.

---

## 15. Conclusão da Auditoria

A proposta acima simplifica substancialmente a experiência diária da oficina mecânica na tela de Ordens de Serviço:
- Transforma a tela em uma ferramenta de trabalho rápida, limpa e direta;
- Garante visualização de 6 a 8 ordens já na primeira dobra em 1366x768 @ 125%;
- Dá destaque hegemônico ao botão `+ NOVA ORDEM DE SERVIÇO`;
- Soluciona a desconexão entre os cards da Dashboard (*Aguardando Aprovação* e *Prontas para Retirada*) e a tela de listagem de OS;
- Reduz em até 60% o tráfego HTTP desnecessário.

**STATUS: PROPOSTA PRONTA PARA APROVAÇÃO**
