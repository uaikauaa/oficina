# UX-005 — PROPOSTA DE SIMPLIFICAÇÃO DA PÁGINA DE EQUIPAMENTOS
# OFICINA GESTÃO V1.1

> **Documento de Auditoria Técnica e Proposta Oficial de Simplificação Operacional**  
> **Status**: PROPOSTA PRONTA PARA APROVAÇÃO  
> **Data**: 17 de Setembro de 2026  
> **Módulos Auditados**: `/maquinas` e `/maquinas/[id]` (Frontend Next.js) e API de Equipamentos (Spring Boot)  
> **Domínio Oficial**: Máquinas de Solda (MIG/MAG, TIG, Inversora, Transformador, Corte Plasma), Geradores de Energia (Diesel, Gasolina, Estacionários) e Equipamentos Industriais. Sistema NÃO automotivo.

---

## 1. Estrutura Atual

O módulo de Equipamentos concentra a consulta global do parque de máquinas atendido pela oficina, abrangendo o inventário de máquinas de solda e geradores vinculados aos clientes, a consulta de histórico de manutenções e o encaminhamento para novas ordens de serviço.

### 1.1 Elementos Visuais Existentes em `/maquinas`

1. **Cabeçalho da Página**:
   - Ícone de ferramenta (`Wrench`) em contêiner âmbar (`bg-amber-500/10 border-amber-500/20`).
   - Título: `"Equipamentos"`.
   - Subtítulo: *"Consulta global de máquinas de solda, geradores e histórico técnico"*.
   - Badge indicador de contagem: `"{totalElements} equipamentos"` (fundo escuro `bg-slate-900 border-slate-800`).
   - **Ausência Crítica**: **NÃO EXISTE** botão de `+ Novo Equipamento` ou qualquer ação primária no cabeçalho.
2. **Barra de Busca e Filtros**:
   - Painel escuro horizontal (`bg-slate-900/60 border border-slate-800 rounded-2xl`).
   - Campo de busca textual:
     - Placeholder: *"Buscar por marca, modelo, número de série ou cliente..."*.
     - Ícone `Search` à esquerda.
     - Sem botão `[✕]` para limpar pesquisa.
     - Debounce de 200ms no `useEffect`.
   - Dropdown de Tipo de Equipamento (`select` nativo):
     - Opções: *"Todos os Tipos"*, *"Máquina de Solda"*, *"Gerador de Energia"*, *"Outro Equipamento"*.
   - Dropdown de Status Ativo (`select` nativo):
     - Opções: *"Status: Todos"*, *"Ativos"*, *"Inativos"*.
3. **Tabela de Equipamentos**:
   - 6 colunas:
     1. `Equipamento`: Marca e Modelo em negrito (`text-white font-bold text-sm`), com subtítulo em linha contendo Potência e Tensão.
     2. `Tipo`: Badge com rótulo descritivo (`bg-amber-500/10 text-amber-400 border-amber-500/20`).
     3. `Nº de Série`: Fonte monoespaçada (`font-mono font-bold text-slate-300`), ou `S/N` itálico quando nulo.
     4. `Cliente Vinculado`: Link para `/clientes/${m.clienteId}` com ícone `User` e nome do cliente em âmbar (`text-amber-400`).
     5. `Status`: Badge verde (`Ativo`) ou vermelho (`Inativo`).
     6. `Ação`: Botão estilizado `<Link href="/maquinas/${m.id}">` com ícone `History` e texto `"Histórico"`.
4. **Estados de Carregamento, Vazio e Paginação**:
   - `Loading`: Spinner animado centralizado com mensagem *"Carregando equipamentos..."*.
   - `Empty State`: Ícone `Wrench`, título *"Nenhum equipamento localizado"*, subtítulo *"Nenhuma máquina corresponde aos filtros ou termos pesquisados."*.
   - `Paginação`: Visível somente se `totalPages > 1`. Exibe `"Página X de Y (Z registros)"` e botões `"Anterior"` e `"Próxima"`.

### 1.2 Elementos Visuais Existentes em `/maquinas/[id]`

1. **Navegação de Retorno**:
   - Link de volta para `Todos os Equipamentos` (`/maquinas`).
   - Separador `|` e link direto para o cliente proprietário (`/clientes/${maquina.clienteId}`).
2. **Card Principal do Equipamento**:
   - Ícone de ferramenta (`Wrench`) ampliado.
   - Badges de Tipo (`Máquina de Solda` / `Gerador de Energia`) e Status (`Equipamento Ativo` / `Inativo`).
   - Título em destaque: `Marca + Modelo` (ex: *ESAB LHN 280i Plus*).
   - Nome do proprietário clicável.
   - Botão de ação Hero: `+ Abrir Nova OS para esta Máquina` (`bg-amber-500 text-slate-950 font-bold`).
   - Ficha Técnica Rápida (4 quadrantes): *Número de Série*, *Potência / Capacidade*, *Tensão de Trabalho*, *Último Horímetro*.
   - **Ausência Notável**: Não existem botões para `Editar Equipamento` ou `Inativar/Reativar` diretamente na página.
3. **Resumo Operacional (4 KPIs de Topo)**:
   - Card 1 (Âmbar): `Atendimentos` (total de ordens de serviço já realizadas na máquina).
   - Card 2 (Azul): `Última Manutenção` (data formatada da última OS).
   - Card 3 (Ciano): `Última OS` (número da última OS registrada, ex: *OS-2026-0043*).
   - Card 4 (Esmeralda): `Total Acumulado` (somatório em R$ de todas as OS concluídas para a máquina).
4. **Linha do Tempo de Atendimentos (Histórico)**:
   - Linha vertical cronológica com marcadores circulares.
   - Para cada Ordem de Serviço:
     - Topo: Número da OS, badge de status, nome do técnico responsável, datas de entrada e saída, e botão `Ver OS`.
     - Corpo técnico: Três caixas (`bg-slate-950 border-slate-800` com altura mínima de 4rem) para *Problema Relatado*, *Diagnóstico Técnico* e *Solução Aplicada*.
     - Testes: Faixa em verde para *Testes Validados*.
     - Peças: Bloco expansível sob demanda para listar peças aplicadas com consumo de `/api/ordens-servico/{id}/itens`.
     - Rodapé: Resumo financeiro (Mão de Obra, Peças, Desconto e Total da OS).
   - `Empty State de Histórico`: Ícone `RotateCcw`, texto orientativo e botão `+ Registrar Primeira Entrada`.

---

## 2. Problemas Encontrados na Auditoria

### 2.1 Ausência Total do CTA Principal `+ NOVO EQUIPAMENTO` em `/maquinas`
- **Gravidade**: ALTA (Fricção de Fluxo / Usabilidade)
- **Evidência no Código**: Em `frontend/src/app/maquinas/page.tsx` (linhas 112–132), o cabeçalho exibe apenas o título, subtítulo e o contador total de equipamentos. Não há nenhum botão ou link para cadastrar um novo equipamento.
- **Impacto Operacional**: Quando o operador recebe uma nova máquina de solda ou gerador na oficina e acessa a tela de Equipamentos, ele é incapaz de cadastrar o equipamento. O operador é forçado a:
  1. Abandonar a tela `/maquinas`;
  2. Navegar até a tela `/clientes`;
  3. Localizar o cliente proprietário;
  4. Abrir a página do cliente (`/clientes/[id]`);
  5. Rolar a tela até a seção de equipamentos vinculados;
  6. Clicar em `+ Novo Equipamento`.
- **Causa Raiz Arquitetural**: O componente `MaquinaModal.tsx` exige obrigatoriamente as propriedades `clienteId: number` e `clienteNome: string` (linhas 19–26), impedindo sua invocação a partir de uma listagem global onde o cliente ainda não foi selecionado.

### 2.2 Bug de Contrato no Filtro de Tipo (`OUTRO` vs `OUTRO_EQUIPAMENTO`)
- **Gravidade**: CRÍTICA (Falha Silenciosa de API / Contrato Quebrado)
- **Evidência no Código**:
  - Em `backend/src/main/java/com/oficinagestao/entity/TipoEquipamento.java`:
    ```java
    public enum TipoEquipamento {
        MAQUINA_SOLDA,
        GERADOR_ENERGIA,
        OUTRO_EQUIPAMENTO; // <-- Valor correto do enum
    }
    ```
  - Em `frontend/src/lib/types.ts` (linha 5):
    ```typescript
    export type TipoEquipamento = 'MAQUINA_SOLDA' | 'GERADOR_ENERGIA' | 'OUTRO_EQUIPAMENTO';
    ```
  - Em `frontend/src/app/maquinas/page.tsx` (linha 165):
    ```tsx
    <option value="OUTRO">Outro Equipamento</option> {/* <-- BUG: "OUTRO" em vez de "OUTRO_EQUIPAMENTO" */}
    ```
- **Impacto Operacional**: Quando a usuária seleciona o filtro *"Outro Equipamento"*, a requisição é disparada com `?tipoEquipamento=OUTRO`. O Spring Boot falha na conversão do enum com `MethodArgumentTypeMismatchException` (HTTP 400 Bad Request). Como o bloco `catch` de `carregarMaquinas()` engole o erro, a tela apenas esvazia a lista e mostra *"Nenhum equipamento localizado"*, impossibilitando a visualização de equipamentos dessa categoria.

### 2.3 Ausência da Ação Operacional `+ OS` na Tabela de Equipamentos
- **Gravidade**: ALTA (Produtividade de Balcão)
- **Evidência no Código**: Em `frontend/src/app/maquinas/page.tsx` (linhas 252–260), a única ação por linha é o botão `Histórico` (`/maquinas/${m.id}`).
- **Impacto Operacional**: No fluxo de atendimento de oficina, o equipamento físico dá entrada no balcão com sua plaqueta de identificação ou número de série. A atendente digita o serial ou marca/modelo na busca de `/maquinas`, localiza o equipamento e quer **imediatamente abrir uma nova OS**. Atualmente, ela é obrigada a entrar na página de detalhes da máquina para depois clicar no botão de abertura de OS, gerando cliques e carregamentos desnecessários.

### 2.4 Limitações e Fragilidade na Busca Global de Equipamentos
- **Gravidade**: MÉDIA-ALTA (Localização de Dados)
- **Evidência no Código**:
  - Em `backend/src/main/java/com/oficinagestao/repository/MaquinaRepository.java` (método `pesquisarGlobal`):
    ```sql
    LOWER(m.marca) LIKE LOWER(CONCAT('%', CAST(:termo AS string), '%')) OR
    LOWER(m.modelo) LIKE LOWER(CONCAT('%', CAST(:termo AS string), '%')) OR
    LOWER(COALESCE(m.numeroSerie, '')) LIKE LOWER(CONCAT('%', CAST(:termo AS string), '%')) OR
    LOWER(c.nomeRazaoSocial) LIKE LOWER(CONCAT('%', CAST(:termo AS string), '%'))
    ```
  - Falhas identificadas:
    1. **Nome Fantasia não contemplado**: Se o cliente proprietário for uma PJ cadastrada como Razão Social *"Eletrotécnica Mineira Ltda"* e Nome Fantasia *"Super Soldas"*, pesquisar por *"Super Soldas"* retorna 0 resultados.
    2. **Telefone e Celular do cliente ausentes**: Em oficinas, muitos clientes deixam o equipamento e o atendente anota apenas o telefone na etiqueta. Pesquisar pelo telefone do cliente não localiza o equipamento.
    3. **CPF / CNPJ do cliente ausentes**: Digitar o documento do cliente não localiza suas máquinas na busca de equipamentos.
    4. **Sem botão de limpeza rápida `[✕]`**: A atendente precisa apagar manualmente caractere por caractere.

### 2.5 Ausência de Edição e Alteração de Status em `/maquinas/[id]`
- **Gravidade**: MÉDIA (Completude Funcional)
- **Evidência no Código**: A página `/maquinas/[id]` é estritamente de visualização. Não há botão para invocar o `MaquinaModal` em modo de edição, nem botão para alterar o status ativo/inativo da máquina. Se a oficina precisar atualizar a voltagem (ex: 220V para 380V), corrigir o número de série ou inativar uma máquina baixada/descartada, o operador precisa navegar até a página do cliente.

### 2.6 Botão de Nova OS Habilitado para Equipamentos Inativos
- **Gravidade**: ALTA (Regra de Negócio Violada na UI)
- **Evidência no Código**:
  - Regra de Negócio no Backend (`OrdemServicoService.java`, linhas 80–82):
    ```java
    if (!Boolean.TRUE.equals(maquina.getAtivo())) {
        throw new BusinessException("Não é possível abrir Ordem de Serviço para um equipamento inativo.");
    }
    ```
  - Frontend (`frontend/src/app/maquinas/[id]/page.tsx`, linhas 241–247):
    O botão `+ Abrir Nova OS para esta Máquina` é renderizado incondicionalmente, mesmo quando `maquina.ativo === false`.
- **Impacto Operacional**: A atendente clica no botão, navega para a tela de nova OS, preenche todos os campos técnicos, e ao submeter a OS recebe um erro de validação do servidor. A UI deve desabilitar preventivamente o botão e informar que equipamentos inativos não podem receber novas ordens de serviço.

### 2.7 Requisições Sequenciais em Cascata (Waterfall) em `/maquinas/[id]`
- **Gravidade**: MÉDIA (Performance)
- **Evidência no Código**: Em `frontend/src/app/maquinas/[id]/page.tsx` (linhas 89–111):
  ```typescript
  const resMaq = await apiFetch(`/api/maquinas/${maquinaId}`);      // Requisição 1
  const resResumo = await apiFetch(`/api/maquinas/${maquinaId}/resumo`);  // Requisição 2 (aguarda 1)
  const resOs = await apiFetch(`/api/maquinas/${maquinaId}/historico?size=50`); // Requisição 3 (aguarda 2)
  ```
- **Impacto**: As três requisições poderiam ser disparadas simultaneamente via `Promise.all`, reduzindo o tempo total de carregamento da página pela metade.

### 2.8 Tratamento de Erros Silencioso na Listagem
- **Gravidade**: MÉDIA (Resiliência e Feedback)
- **Evidência no Código**: Em `frontend/src/app/maquinas/page.tsx` (linhas 92–94):
  ```typescript
  } catch {
    // Ignora erro
  }
  ```
  Se houver falha de rede, expiração de sessão ou erro 500 no servidor, a tela simplesmente para de carregar e não emite qualquer alerta para a usuária.

---

## 3. Busca

### 3.1 Comportamento Auditado da Busca Atual
A busca de equipamentos atua diretamente sobre o parâmetro `termo` do endpoint `GET /api/maquinas?termo=...`.

| Critério de Teste | Comportamento Atual | Status | Observação |
| :--- | :--- | :--- | :--- |
| **Marca** (ex: "ESAB", "Toyama") | Funciona via `LOWER(m.marca)` | OK | Case-insensitive |
| **Modelo** (ex: "LHN 280", "TG8000") | Funciona via `LOWER(m.modelo)` | OK | Parcial suportado |
| **Nº de Série exato** (ex: "SN-12345") | Funciona via `LOWER(m.numeroSerie)` | OK | Encontra registro |
| **Nº de Série sem hífen** (digitado "12345") | Funciona se for substring | OK | Substring atendida |
| **Nº de Série com espaço** ("SN 12345") | **FALHA** contra "SN-12345" | Alerta | Hífen vs espaço não normalizado |
| **Cliente por Razão Social** ("Empresa Silva") | Funciona via `LOWER(c.nomeRazaoSocial)` | OK | Encontra |
| **Cliente por Nome Fantasia** ("Silva Soldas") | **FALHA** (retorna 0 resultados) | BUG | Coluna `c.nomeFantasia` ignorada |
| **Cliente por Telefone/Celular** ("99999-0000") | **FALHA** (retorna 0 resultados) | Limitação | Telefones do cliente ignorados |
| **Cliente por CPF/CNPJ** ("00014014000") | **FALHA** (retorna 0 resultados) | Limitação | Documento do cliente ignorado |
| **Espaços no início/fim** (" ESAB ") | Funciona | OK | Sanitizado via `.trim()` no frontend e backend |

### 3.2 Proposta de Busca Operacional Aprimorada
1. **Placeholder Preciso e Direto**:
   `"Buscar por marca, modelo, nº de série, cliente (nome ou fantasia)..."`
2. **Botão de Limpeza Rápida `[✕]`**:
   Posicionado à direita do campo de busca para limpar o termo e resetar a paginação em 1 clique.
3. **Debounce Apropriado**:
   Ajuste para 350ms para evitar requisições prematuras durante digitação contínua.
4. **Resolução de Tolerância no Backend (Sem Quebra de Schema)**:
   Incluir no `pesquisarGlobal` a correspondência com `c.nomeFantasia`, permitindo que oficinas que conhecem clientes corporativos por seus nomes fantasia encontrem os equipamentos imediatamente.

---

## 4. Filtros

### 4.1 Mapeamento dos Filtros Existentes
Atualmente, `/maquinas` apresenta apenas dois selects tradicionais para filtro:
1. `Tipo de Equipamento` (`MAQUINA_SOLDA`, `GERADOR_ENERGIA`, `OUTRO`)
2. `Status` (`Todos`, `Ativos`, `Inativos`)

### 4.2 Proposta: Barra de Filtros Rápidos (Pills com 1 Clique)
Seguindo o padrão de alta produtividade já homologado nas telas de Ordens de Serviço (UX-003) e Clientes (UX-004), propõe-se substituir os selects pesados por **Pills Horizontais Operacionais**:

```
[Todos]  [⚡ Solda]  [🔋 Gerador]  [🔧 Outro]  |  [✓ Ativos]  [✕ Inativos]
```

#### Vantagens Operacionais:
- **Zero dropdowns**: A seleção é feita com 1 único clique direto na tela.
- **Indicação Visual Instantânea**: A pill ativa recebe destaque contrastante em âmbar (`bg-amber-500 text-slate-950 font-bold`).
- **Correção Imediata do Contrato**: O clique em `Outro` enviará o valor legítimo do enum: `OUTRO_EQUIPAMENTO`.
- **Painel Retrátil `[Mais filtros ▼]`**:
  Permite manter a tela limpa e disponibilizar filtros avançados secundários (ex: filtro combinado por ano de fabricação ou marca) apenas quando requisitado.

---

## 5. Tabela

### 5.1 Comparativo de Colunas: Atual vs Proposta

| Coluna | Estrutura Atual | Estrutura Proposta | Racional de UX |
| :--- | :--- | :--- | :--- |
| **Equipamento** | Marca e Modelo com Potência/Tensão abaixo | **Equipamento**: Marca + Modelo em negrito com potência/tensão em badge sutil | Identificação técnica imediata |
| **Tipo** | Coluna dedicada com badge largo | **Tipo**: Badge compacto com ícone temático (⚡ Solda, 🔋 Gerador, 🔧 Outro) | Economia de espaço horizontal |
| **Nº de Série** | Coluna monoespaçada isolada | **Nº de Série**: Fonte mono destacada com cópia rápida | Dado vital de rastreabilidade |
| **Cliente** | Nome com link e ícone User | **Cliente**: Nome clicável + documento/contato em subtexto discreto | Identifica o dono sem trocar de tela |
| **Status** | Badge Ativo / Inativo | **Status**: Badge compacto verde ou vermelho | Clareza de disponibilidade |
| **Ações** | Apenas botão `Histórico` | **Ações**: `[Ver Detalhes]` e atalho prioritário `[+ OS]` | Inicia atendimento em 1 clique |

### 5.2 Otimização de Densidade e Altura (1366x768 @ 125%)
- A tabela atual utiliza `py-3.5 px-4`, acomodando apenas 4 a 5 equipamentos na primeira dobra em telas típicas de oficina (1366x768 com zoom de 125%).
- A proposta reduz o padding vertical para `py-2.5 px-3.5`, permitindo visualizar **7 a 8 equipamentos** simultaneamente sem rolagem da página.

---

## 6. Cadastro (`+ NOVO EQUIPAMENTO`)

### 6.1 Como Viabilizar o Cadastro Global em `/maquinas`
Como o banco de dados exige estritamente a chave estrangeira `cliente_id NOT NULL` na tabela `maquinas`, um equipamento não pode existir sem um cliente associado.

#### Solução Proposta para o `MaquinaModal`:
Adaptar o `MaquinaModal` para suportar dois modos operacionais transparentes:
1. **Modo Contextual (já existente em `/clientes/[id]` e `/ordens-servico/nova`)**:
   - `clienteId` e `clienteNome` já são fornecidos.
   - O campo do cliente permanece travado em exibição somente-leitura.
2. **Modo Global (novo para `/maquinas`)**:
   - Se `clienteId` não for fornecido, o modal exibe na primeira seção um seletor dinâmico de cliente:
     `[ Buscar cliente por Nome, CPF/CNPJ ou Telefone... ]`
   - O operador digita 2 letras, seleciona o cliente na lista suspensa rápida e prossegue preenchendo os dados da máquina.
   - O botão principal `+ NOVO EQUIPAMENTO` em `/maquinas` abre o modal diretamente com 1 clique.

### 6.2 Organização Lógica dos Campos no Formulário

```
+-------------------------------------------------------------------+
| NOVO EQUIPAMENTO                                              [✕] |
+-------------------------------------------------------------------+
| 1. VÍNCULO DO CLIENTE                                             |
| Cliente Proprietário: [ Buscar cliente por Nome ou CPF/CNPJ... ]  |
+-------------------------------------------------------------------+
| 2. IDENTIFICAÇÃO DO EQUIPAMENTO                                   |
| Tipo: [⚡ Máquina de Solda ▼]                                     |
| Marca (*): [ Ex: ESAB ]         Modelo (*): [ Ex: LHN 280i ]      |
| Nº de Série: [ Ex: SN-001234 ]   Ano Fabr.:  [ Ex: 2023 ]          |
+-------------------------------------------------------------------+
| 3. ESPECIFICAÇÕES TÉCNICAS E MEDIÇÃO                              |
| Potência: [ Ex: 250A ]           Tensão:     [ Ex: 220V/380V ]     |
| Horímetro Inicial (h): [ Ex: 120.5 ]                              |
+-------------------------------------------------------------------+
| 4. OBSERVAÇÕES TÉCNICAS                                           |
| [ Observações adicionais, histórico prévio, acessórios... ]       |
+-------------------------------------------------------------------+
| [ Cancelar ]                             [ Cadastrar Equipamento ]|
+-------------------------------------------------------------------+
```

---

## 7. Detalhe (`/maquinas/[id]`)

### 7.1 Reorganização da Página de Detalhe
A página `/maquinas/[id]` deve cumprir três papéis operacionais primordiais:
1. **Identificar**: Quem é o cliente, qual é a máquina e quais são as especificações elétricas e mecânicas.
2. **Consultar Histórico**: Quais problemas o equipamento já teve, quais peças foram trocadas e quando foi a última manutenção.
3. **Agir Operacionalmente**: Iniciar uma nova OS, editar dados técnicos desatualizados ou alterar o status do equipamento.

### 7.2 Ações Primárias no Cabeçalho de Detalhes
No cabeçalho de `/maquinas/[id]`, disponibilizar três botões de ação:
1. `+ Nova OS para este Equipamento`:
   - Se `ativo === true`: Redireciona para `/ordens-servico/nova?clienteId=${maquina.clienteId}&maquinaId=${maquina.id}`.
   - Se `ativo === false`: Botão **desabilitado** com estilo fosco e tooltip: *"Equipamento inativo. Reative o equipamento para abrir nova OS"*.
2. `Editar Equipamento`:
   - Abre o `MaquinaModal` populado com os dados atuais da máquina (`PUT /api/maquinas/${id}`).
3. `Inativar / Ativar Equipamento`:
   - Botão secundário de status que abre modal de confirmação (`PATCH /api/maquinas/${id}/status`).

---

## 8. Histórico

### 8.1 Validação e Integridade do Bug Resolvido (`ordens.map is not a function`)
- **Causa Histórica**: O endpoint `GET /api/maquinas/{id}/historico` retorna um objeto paginado `PageResponse<OrdemServicoResponseDTO>`, cuja estrutura JSON contém:
  ```json
  {
    "content": [ ... ],
    "page": 0,
    "size": 20,
    "totalElements": 1,
    "totalPages": 1
  }
  ```
- **Auditoria de Integridade**:
  O código atual em `frontend/src/app/maquinas/[id]/page.tsx` (linhas 107–111) consome a resposta de forma defensiva:
  ```typescript
  const dataOs: PageResponse<OrdemServico> = await resOs.json();
  setOrdens(dataOs.content ?? []);
  ```
  O teste unitário `frontend/src/lib/maquinasHistoricoContrato.test.ts` valida exaustivamente que:
  - `dataOs.content ?? []` sempre resulta em um `Array` legítimo;
  - Array vazio não quebra o renderizador;
  - `TypeError: map is not a function` foi definitivamente debelado.

### 8.2 Proposta de Alternador de Visualização: Tabela Compacta vs Linha do Tempo
Atualmente, a página exibe apenas a Linha do Tempo com cards volumosos. Propõe-se um seletor visual:

```
[ ≡ Tabela Operacional ]   [ ☍ Linha do Tempo ]
```

1. **Visão Tabela Compacta (Padrão Operacional)**:
   - Apresenta as ordens de serviço em linhas densas:
     - `OS`: Número da OS em fonte mono com link direto (`/ordens-servico/${os.id}`).
     - `Data Entrada`: DD/MM/AAAA.
     - `Status`: Badge compacto (Aberta, Em Manutenção, Pronta, Concluída, Cancelada).
     - `Problema Relatado`: Texto truncado legível.
     - `Solução Aplicada`: Resumo do reparo efetuado.
     - `Peças (R$)` / `Valor Total (R$)`: Totais financeiros da intervenção.
     - `Ação`: Botão de acesso rápido `[Ver OS]`.
2. **Visão Linha do Tempo (Detalhada)**:
   - Mantém a experiência visual rica existente para auditorias detalhadas e inspeção de peças trocadas.

### 8.3 Tratamento de Equipamento Sem Histórico (`total OS = 0`)
Quando `ordens.length === 0`:
- Exibir painel com mensagem positiva e clara:
  *"Este equipamento ainda não possui histórico de Ordens de Serviço na oficina."*
- Botão acionável em destaque: `+ Abrir Primeira Ordem de Serviço`.

---

## 9. Relação com Cliente

### 9.1 Equipamento como Ativo Vinculado
Na oficina mecânica/elétrica, o equipamento não opera de forma autônoma: ele sempre pertence a um cliente cadastrado (Pessoa Física ou Pessoa Jurídica).
- A tabela de `/maquinas` deve tornar a relação `EQUIPAMENTO → CLIENTE` imediatamente legível.
- O nome do cliente deve ser clicável, permitindo navegação direta para `/clientes/${m.clienteId}`.
- Adicionar no subtexto da coluna de cliente informações secundárias de contato (ex: telefone celular ou nome fantasia da empresa), reduzindo a necessidade de alternar de tela apenas para obter o contato do proprietário.

### 9.2 Tratamento de Números de Série Idênticos
- O domínio do sistema permite que equipamentos diferentes possuam o mesmo número de série quando pertencentes a clientes distintos (ou quando equipamentos industriais mais simples não possuem número de série exclusivo de fábrica).
- **Garantia Auditada**: A interface não utiliza `numeroSerie` como chave de identificação (`key` do React sempre utiliza `m.id`).
- Na busca, ao localizar dois registros com o mesmo número de série, a exibição clara do cliente proprietário e da marca impede qualquer ambiguidade operacional por parte do atendente.

---

## 10. Nova OS (Fluxo de 1 Clique)

### 10.1 Integração com o Fluxo UX-001
O fluxo de abertura de OS já possui capacidade nativa de receber parâmetros via URL query string em `frontend/src/app/ordens-servico/nova/page.tsx`:
- `?clienteId=X` -> Pré-carrega os dados do cliente;
- `?maquinaId=Y` -> Pré-seleciona automaticamente o equipamento no formulário.

### 10.2 Atalho Operacional em `/maquinas`
Ao incluir o botão `+ OS` na coluna de ações da tabela de `/maquinas`:
1. A atendente localiza o equipamento;
2. Clica em `+ OS`;
3. É direcionada para `/ordens-servico/nova?clienteId=${m.clienteId}&maquinaId=${m.id}`;
4. A tela de Nova OS abre com **Cliente e Equipamento 100% selecionados e validados**;
5. A atendente apenas digita o problema relatado pelo cliente e confirma a abertura da OS.

**Resultado**: Redução de 4 etapas para apenas 1 clique a partir da listagem de equipamentos.

---

## 11. Status Ativo/Inativo

### 11.1 Regras de Negócio e Orientação na UI
1. **Diferenciação Visual na Listagem**:
   - Equipamento Ativo: Badge esmeralda suave (`bg-emerald-500/10 text-emerald-400 border-emerald-500/30`).
   - Equipamento Inativo: Badge vermelho suave (`bg-red-500/10 text-red-400 border-red-500/30`).
2. **Bloqueio de Nova OS para Equipamento Inativo**:
   - Na tabela de `/maquinas`: O botão `+ OS` deve ficar desabilitado (`opacity-40 cursor-not-allowed`) com mensagem indicativa ao passar o mouse.
   - Na página `/maquinas/[id]`: O botão Hero `+ Abrir Nova OS para esta Máquina` deve ser desabilitado e acompanhado de um alerta amigável:
     *"Equipamento inativo no sistema. Não é permitido emitir ordens de serviço para máquinas desativadas. Reative o equipamento para continuar."*
3. **Ação de Ativação/Reativação Segura**:
   - Disponibilizar botão `Reativar Equipamento` diretamente no detalhe (`/maquinas/[id]`), consumindo o endpoint já existente `PATCH /api/maquinas/{id}/status`.

---

## 12. Paginação

### 12.1 Auditoria do Mecanismo Atual
- `pageSize` fixo em 10 itens.
- Chamada da API: `GET /api/maquinas?page=0&size=10&sort=marca,asc`.
- A paginação desaparece completamente quando `totalPages <= 1`.

### 12.2 Proposta de Melhoria
1. **Manter Barra de Paginação Sempre Presente**:
   - Mesmo para 1 página (ex: 6 registros encontrados), exibir o rodapé com:
     `"Exibindo 1 a 6 de 6 equipamentos encontrados"`.
   - Evita sensação de corte abrupto na borda inferior da tabela.
2. **Desabilitação Clara de Botões**:
   - Botão `Anterior` desabilitado na primeira página (`disabled:opacity-40`).
   - Botão `Próxima` desabilitado na última página (`disabled:opacity-40`).
3. **Preservação de Filtros na Mudança de Página**:
   - Ao trocar de página, manter intactos os parâmetros de busca textual e pills ativas.
   - Ao alterar qualquer filtro ou busca, resetar a página para `0`.

---

## 13. Performance

### 13.1 Auditoria de Requisições de Rede

| Tela / Rota | Requisições Atuais | Comportamento | Proposta de Otimização |
| :--- | :--- | :--- | :--- |
| `/maquinas` | `GET /api/auth/me`<br>`GET /api/maquinas?...` | Sequencial simples com debounce de 200ms | Aumentar debounce para 350ms; manter chamada única com `JOIN FETCH` (sem N+1) |
| `/maquinas/[id]` | `GET /api/auth/me`<br>`GET /api/maquinas/{id}`<br>`GET /api/maquinas/{id}/resumo`<br>`GET /api/maquinas/{id}/historico` | **Cascata Sequencial (3 awaits seguidos)** | **Executar em paralelo com `Promise.all`**, cortando latência inicial |
| Itens de OS (Histórico) | `GET /api/ordens-servico/{id}/itens` | Sob demanda ao expandir card de peças | Manter lazy loading sob demanda (ótimo padrão) |

### 13.2 Avaliação de N+1 no Backend
- A query `pesquisarGlobal` em `MaquinaRepository.java` já utiliza `SELECT m FROM Maquina m JOIN FETCH m.cliente c`.
- Portanto, o Spring Data JPA **não executa N+1** para recuperar os nomes dos clientes. Essa excelência arquitetural deve ser preservada.

---

## 14. Contratos de API (Frontend ↔ Backend)

### 14.1 Mapeamento de Endpoints e DTOs

```
GET /api/maquinas
├── Query: termo, tipoEquipamento, ativo, page, size, sort
├── Backend: PageResponse<MaquinaResponseDTO>
└── Frontend: PageResponse<Maquina>

POST /api/maquinas
├── Body: MaquinaCreateDTO (clienteId, tipoEquipamento, marca, modelo, anoFabricacao, numeroSerie, horimetro, potencia, tensao, observacoes)
├── Backend: MaquinaResponseDTO
└── Frontend: Maquina

GET /api/maquinas/{id}
├── Backend: MaquinaResponseDTO
└── Frontend: Maquina

PUT /api/maquinas/{id}
├── Body: MaquinaUpdateDTO (tipoEquipamento, marca, modelo, anoFabricacao, numeroSerie, horimetro, potencia, tensao, observacoes)
├── Backend: MaquinaResponseDTO
└── Frontend: Maquina

PATCH /api/maquinas/{id}/status
├── Body: MaquinaStatusDTO (ativo: boolean)
├── Backend: MaquinaResponseDTO
└── Frontend: Maquina

GET /api/maquinas/{id}/resumo
├── Backend: MaquinaResumoDTO (totalAtendimentos, ultimaManutencaoData, ultimaOsId, ultimaOsNumero, ultimaOsProblema, ultimaOsStatus, valorAcumulado)
└── Frontend: MaquinaResumo

GET /api/maquinas/{id}/historico
├── Query: page, size, sort
├── Backend: PageResponse<OrdemServicoResponseDTO>
└── Frontend: PageResponse<OrdemServico>

GET /api/ordens-servico/{id}/itens
├── Backend: List<OrdemServicoItemResponseDTO>
└── Frontend: OrdemServicoItem[]
```

### 14.2 Correção Pontual de Contrato (Frontend)
- Substituir o valor do `<option value="OUTRO">` por `<option value="OUTRO_EQUIPAMENTO">` no frontend, alinhando rigorosamente com o enum `TipoEquipamento` do backend.

---

## 15. Segurança

### 15.1 Rotas Protegidas e Sessão
- Ambas as rotas `/maquinas` e `/maquinas/:path*` já estão cadastradas no matcher de segurança de `frontend/src/middleware.ts`.
- Usuários não autenticados são interceptados antes de qualquer renderização e redirecionados para `/login?redirect=/maquinas`.
- Requisições para `/api/maquinas/**` exigem cookie de autenticação HttpOnly validado pelo Spring Security.

### 15.2 Isolamento de Dados e Prevenção contra Manipulação de IDs
- O backend valida rigorosamente o vínculo entre equipamento e cliente:
  - Não é possível transferir um equipamento de cliente via `PUT /api/maquinas/{id}` (a propriedade `clienteId` é imutável na atualização).
  - Ao abrir uma OS via `POST /api/ordens-servico`, o backend valida expressamente se a máquina pertence ao cliente indicado:
    ```java
    if (!maquina.getCliente().getId().equals(cliente.getId())) {
        throw new BusinessException("O equipamento informado não pertence ao cliente indicado.");
    }
    ```
- Todas as operações de criação, alteração e troca de status registram trilha de auditoria via `AuditoriaService` com IP de origem e ID do usuário autenticado.

---

## 16. Responsividade

### 16.1 Resoluções Auditadas

| Resolução | Cenário de Uso | Comportamento Atual | Ajustes Propostos |
| :--- | :--- | :--- | :--- |
| **1366x768 @ 100%** | Monitor de bancada / notebook padrão | Bom espaçamento, cabem ~5 linhas na tabela | Reduzir padding para exibir 7-8 linhas na primeira dobra |
| **1366x768 @ 125%** | Notebook de 14" padrão com escala Windows ativa | Altura útil comprimida; histórico de `/maquinas/[id]` exige rolagem pesada | Reduzir altura mínima de caixas de texto; adotar modo tabela compacta de histórico |
| **1280x720** | Monitores antigos de balcão | Tabela aciona rolagem horizontal lateral | Proteger colunas essenciais; usar tipografia compacta `text-xs` |
| **1920x1080** | Monitores Full HD modernos | Excesso de espaço vazio lateral | Limitar largura máxima em `max-w-7xl` centralizado (já existente) |

---

## 17. Redução de Cliques

Mapeamento comparativo dos fluxos operacionais antes e depois da proposta:

| Operação Operacional | Fluxo Atual (Antes) | Fluxo Proposto (Depois) | Economia de Cliques |
| :--- | :--- | :--- | :--- |
| **Cadastrar novo equipamento** | Acessar `/clientes` → buscar cliente → abrir cliente → rolar página → clicar em `+ Novo Equipamento` → salvar (**6 cliques + 2 trocas de página**) | Clicar em `+ NOVO EQUIPAMENTO` em `/maquinas` → selecionar cliente no modal → preencher e salvar (**1 clique para abrir**) | **Redução de ~80%** |
| **Abrir OS para equipamento da lista** | Localizar na tabela → clicar em `Histórico` → aguardar tela carregar → clicar em `+ Abrir Nova OS` (**2 cliques + 1 navegação intermediária**) | Localizar na tabela → clicar no atalho `+ OS` na linha (**1 clique direto**) | **Redução de 50% e zero telas intermediárias** |
| **Pesquisar e limpar busca** | Clicar no input → digitar → selecionar tudo e dar backspace para limpar (**múltiplas teclas**) | Digitar com debounce automático de 350ms → clicar no botão `[✕]` para resetar (**1 clique**) | **Pesquisa instantânea e limpeza em 1 toque** |
| **Filtrar por Máquina de Solda ou Gerador** | Clicar no select de tipo → rolar lista → selecionar opção (**2 cliques em dropdown**) | Clicar diretamente na pill `[⚡ Solda]` ou `[🔋 Gerador]` (**1 clique direto**) | **Redução de 50%** |
| **Editar dados técnicos da máquina** | Navegar para `/clientes` → abrir cliente → achar máquina → clicar em editar (**4 cliques**) | Clicar em `Editar Equipamento` diretamente em `/maquinas/[id]` (**1 clique direto**) | **Redução de 75%** |

---

## 18. Wireframes Propostos

### 18.1 Wireframe: `/maquinas` (Listagem Operacional)

```
+---------------------------------------------------------------------------------------------------------+
| [Wrench] Equipamentos                                                          [ + NOVO EQUIPAMENTO ]  |
| Consulta técnica de máquinas de solda e geradores vinculados              Total: 42 equipamentos       |
+---------------------------------------------------------------------------------------------------------+
| [ Buscar marca, modelo, cliente ou nº de série...                [✕] ]                                 |
+---------------------------------------------------------------------------------------------------------+
| [ Todos (42) ]  [ ⚡ Soldas (28) ]  [ 🔋 Geradores (11) ]  [ 🔧 Outros (3) ]  |  [ ✓ Ativos ]  [ ✕ Inativos ] |
+---------------------------------------------------------------------------------------------------------+
| EQUIPAMENTO              | TIPO        | Nº DE SÉRIE  | CLIENTE PROPRIETÁRIO   | STATUS  | AÇÕES              |
|--------------------------+-------------+--------------+------------------------+---------+--------------------|
| ESAB LHN 280i Plus       | ⚡ Solda    | SN-ESAB-001  | Indústria Metalúrgica  | ATIVO   | [ Ver ]  [ + OS ]  |
| 250A • 220V/380V         | Inversora   |              | (31) 98888-1111        |         |                    |
|--------------------------+-------------+--------------+------------------------+---------+--------------------|
| Toyama TG8000            | 🔋 Gerador  | TG-2024-889  | Fazenda Boa Esperança  | ATIVO   | [ Ver ]  [ + OS ]  |
| 8kVA • Gasolina          | Estacionário|              | (31) 97777-2222        |         |                    |
|--------------------------+-------------+--------------+------------------------+---------+--------------------|
| Bambozzi TRR 2600        | ⚡ Solda    | SN-BAMB-042  | José Carlos Serralheria| INATIVO | [ Ver ]  [+OS Bloq]|
| 300A • Transformador     | Retificador |              | (31) 99999-3333        |         |                    |
+---------------------------------------------------------------------------------------------------------+
| Exibindo 1 a 10 de 42 equipamentos encontrados                               [ < Anterior ]  [ Próxima > ]|
+---------------------------------------------------------------------------------------------------------+
```

### 18.2 Wireframe: `/maquinas/[id]` (Detalhe Operacional e Histórico)

```
+---------------------------------------------------------------------------------------------------------+
| ← Todos os Equipamentos  |  Cliente: Indústria Metalúrgica Silva Ltda                                   |
+---------------------------------------------------------------------------------------------------------+
| [⚡] ESAB LHN 280i Plus                          [ Editar Equipamento ]  [ + ABRIR NOVA ORDEM DE SERVIÇO ] |
| Inversora de Solda • Nº Série: SN-ESAB-001 • [ ATIVO ]                                                 |
|                                                                                                         |
| FICHA TÉCNICA:                                                                                          |
| Tensão: 220V/380V     | Potência: 250A     | Último Horímetro: 142.5 h     | Ano Fabr.: 2022            |
+---------------------------------------------------------------------------------------------------------+
| [ 4 Atendimentos ]    | [ Última OS: 14/08/2026 ] | [ Última OS: OS-2026-0043 ] | [ Acumulado: R$ 1.850 ]|
+---------------------------------------------------------------------------------------------------------+
| HISTÓRICO DE MANUTENÇÃO                                             [ ≡ Tabela ]  [ ☍ Linha do Tempo ]  |
+---------------------------------------------------------------------------------------------------------+
| NÚMERO OS    | DATA       | STATUS     | PROBLEMA / REPARO REALIZADO           | PEÇAS     | VALOR TOTAL |
|--------------+------------+------------+----------------------------------------+-----------+-------------|
| OS-2026-0043 | 14/08/2026 | CONCLUÍDA  | Desarmando proteção térmica (IGBT ok)  | R$ 320,00 | R$ 680,00   |
| OS-2026-0012 | 10/03/2026 | CONCLUÍDA  | Substituição de tocha e cabo obra      | R$ 450,00 | R$ 620,00   |
| OS-2025-0089 | 15/11/2025 | CONCLUÍDA  | Revisão preventiva e limpeza geral     | R$   0,00 | R$ 250,00   |
+---------------------------------------------------------------------------------------------------------+
```

---

## 19. Arquivos que Seriam Alterados na Etapa de Implementação

Quando a implementação desta proposta for expressamente autorizada pelo usuário, os seguintes arquivos serão tocados:

1. **`frontend/src/app/maquinas/page.tsx`**:
   - Inclusão do botão Hero `+ NOVO EQUIPAMENTO` no cabeçalho;
   - Substituição dos selects tradicionais por Pills Rápidas (`Todos`, `Soldas`, `Geradores`, `Outros`, `Ativos`, `Inativos`);
   - Correção do valor do enum `OUTRO_EQUIPAMENTO`;
   - Inclusão do botão de limpeza de busca `[✕]`;
   - Inclusão da ação rápida `+ OS` na tabela direcionando para `/ordens-servico/nova?clienteId=X&maquinaId=Y`;
   - Tratamento visual de status inativo (desabilitando o botão `+ OS`);
   - Exibição consistente da barra de paginação e contagem de registros;
   - Integração do `MaquinaModal` na página.
2. **`frontend/src/app/maquinas/[id]/page.tsx`**:
   - Paralelização de requisições de rede com `Promise.all` (`/maquinas/{id}`, `/resumo`, `/historico`);
   - Adição dos botões `Editar Equipamento` e `Inativar/Reativar Equipamento` no cabeçalho;
   - Desabilitação segura do botão `+ Nova OS` quando `maquina.ativo === false`, com mensagem informativa;
   - Implementação do alternador visual entre Tabela Compacta de Histórico e Linha do Tempo;
   - Redução da altura vertical das caixas de diagnóstico/solução para conforto em telas de 1366x768 @ 125%.
3. **`frontend/src/components/MaquinaModal.tsx`**:
   - Suporte ao modo global (quando chamado sem `clienteId`), permitindo ao operador selecionar o cliente proprietário através de busca textual com autocomplete;
   - Preservação do modo contextual existente (quando aberto com `clienteId` já definido em `/clientes/[id]` e `/ordens-servico/nova`);
   - Agrupamento visual dos campos em 4 blocos organizados (*Vínculo*, *Identificação*, *Especificações/Medições*, *Observações*).
4. **`frontend/src/lib/maquinasOperacional.test.ts` (Novo arquivo de testes unitários)**:
   - Testes unitários para validação de contratos, pills de filtro rápido, formatação de URLs de pré-seleção (`?clienteId=X&maquinaId=Y`), bloqueio de ação em equipamentos inativos e tolerância a números de série.
5. **`backend/src/main/java/com/oficinagestao/repository/MaquinaRepository.java` (Opcional/Se aprovado)**:
   - Extensão da consulta `pesquisarGlobal` para contemplar `c.nomeFantasia`, aumentando a precisão das buscas sem qualquer alteração de schema ou migration.

---

## 20. Resumo Executivo da Auditoria e Próximos Passos

1. **Estado Atual**: A área de Equipamentos cumpre sua função de consulta e preserva a integridade do contrato de histórico (o bug `TypeError: ordens.map is not a function` permanece 100% prevenido).
2. **Gargalos Operacionais Identificados**:
   - Impossibilidade de cadastrar máquinas diretamente em `/maquinas`;
   - Impossibilidade de abrir OS em 1 clique a partir da lista de máquinas;
   - Bug de envio de `OUTRO` em vez de `OUTRO_EQUIPAMENTO` no filtro de tipo;
   - Ausência de edição ou inativação em `/maquinas/[id]`;
   - Permissão indevida na UI para tentar abrir OS em máquina inativa;
   - Waterfall de 3 chamadas sequenciais na página de detalhes.
3. **Status do Projeto**:
   - **NENHUM código foi modificado** nesta etapa.
   - **NENHUMA migration foi criada**.
   - **NENHUM commit foi realizado**.
   - **PROPOSTA PRONTA PARA AVALIAÇÃO E APROVAÇÃO DO USUÁRIO**.
