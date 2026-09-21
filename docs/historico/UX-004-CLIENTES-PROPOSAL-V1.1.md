# UX-004 — PROPOSTA DE SIMPLIFICAÇÃO DA PÁGINA DE CLIENTES
# OFICINA GESTÃO V1.1

> **Documento de Auditoria e Proposta Oficial de Redesenho Operacional**  
> **Status**: Proposta Pronta para Aprovação  
> **Data**: 17 de Setembro de 2026  
> **Módulo**: `/clientes` e `/clientes/[id]` (Frontend Next.js) e API de Clientes (Spring Boot)

---

## 1. Estrutura Atual

A tela de Clientes (`/clientes`) concentra as operações de busca, filtragem, consulta cadastral, abertura de modal de cadastro/edição e inativação de clientes.

### 1.1 Elementos Visuais Existentes em `/clientes`
1. **Cabeçalho de Página**:
   - Ícone de usuários (`Users`) na cor âmbar.
   - Tag superior: `"GESTÃO COMERCIAL & TÉCNICA"` (jargão técnico/corporativo).
   - Título: `"Clientes"`.
   - Subtítulo longo: *"Cadastro, consulta e histórico de clientes (Pessoa Física e Pessoa Jurídica) da oficina de soldas e geradores"*.
   - Botão de ação: `+ Novo Cliente` (fundo âmbar, ícone `Plus`).
2. **Barra de Busca e Filtros**:
   - Painel escuro (`bg-slate-900/80 border border-slate-800`) em grid de 12 colunas.
   - Input de busca textual (6 colunas) com placeholder extenso: *"Pesquisar por Nome, Razão Social, Fantasia, CPF, CNPJ, Telefone ou ID..."*.
   - Select de Tipo de Pessoa (2 colunas): *"Todos os Tipos"*, *"Pessoa Física (PF)"*, *"Pessoa Jurídica (PJ)"*.
   - Select de Status Ativo (2 colunas): *"Todos os Status"*, *"Apenas Ativos"*, *"Apenas Inativos"*.
   - Botão de submissão `"Filtrar"` (2 colunas): exige clique manual ou pressionamento de tecla `Enter`.
3. **Tabela de Clientes**:
   - 7 colunas:
     1. `Tipo`: Badge isolado indicando "PF" ou "PJ" (ocupa uma coluna inteira para duas letras).
     2. `Nome / Razão Social`: Nome com link para `/clientes/[id]` e Nome Fantasia abaixo.
     3. `CPF / CNPJ`: Documento formatado com máscara.
     4. `Contato`: Telefone/Celular e E-mail.
     5. `Cidade / UF`: Cidade e Estado do endereço principal.
     6. `Status`: Badge "Ativo" ou "Inativo".
     7. `Ações`: 3 botões de ícone soltos (`Visualizar [Eye]`, `Editar [Edit2]`, `Inativar/Ativar [Power]`).
4. **Rodapé e Paginação**:
   - Indicador: *"Total de X clientes encontrados"*.
   - Controles: Botão "Anterior", indicador `"Página 1 de Y"`, Botão "Próxima".
   - Limite por página: 10 registros por página.
5. **Modais Associados**:
   - `ClienteModal`: Cadastro e edição com suporte a endereço e equipamento (fluxo UX-001).
   - `ConfirmModal`: Confirmação para Inativar ou Reativar o cliente.

### 1.2 Estrutura da Página de Detalhes (`/clientes/[id]`)
- Cabeçalho com link de retorno e botões "Editar" e "Inativar/Reativar".
- Card de identificação principal do cliente.
- Grade de 5 cards de resumo (KPIs): Equipamentos, Total de OS, OS em Aberto, Última Visita, Total Acumulado.
- Grade com dados de Contato e Endereço.
- Bloco de Observações.
- Seção de Equipamentos Vinculados com cards individuais e ações por máquina.
- Seção de Histórico de Ordens de Serviço com tabela operacional.

---

## 2. Problemas Encontrados na Auditoria

### 2.1 Desperdício de Dados Já Fornecidos pela API
- O endpoint `GET /api/clientes` já calcula e retorna no DTO o campo `totalEquipamentos: number` para cada cliente da lista (`ClienteResponseDTO.totalEquipamentos`).
- **Problema**: A tabela atual **NÃO EXIBE** a quantidade de equipamentos. Para saber se o cliente possui máquinas cadastradas e quantas são, a atendente precisa abrir a página de detalhes.

### 2.2 Busca Ineficiente com Máscaras e Pontuação (Falha Comprovada)
- O banco PostgreSQL armazena CPF, CNPJ e Telefones normalizados apenas com números (ex: `00014014000` e `31999990000`).
- A consulta JPQL em `ClienteRepository.java` compara `c.cpfCnpj LIKE CONCAT('%', :termo, '%')`.
- **Comportamento auditado em teste real**:
  - Busca por `"00014014000"` (sem máscara): **1 cliente encontrado**.
  - Busca por `"000.140.140-00"` (com máscara): **0 clientes encontrados**.
  - Busca por `"(31) 99999-0000"`: **0 clientes encontrados**.
- **Impacto**: Quando a usuária copia e cola um CPF/CNPJ com pontos e traços, ou digita com formatação comum, a busca falha silenciosamente.

### 2.3 Excesso de Fricção na Busca
- Não há mecanismo de *debounce*: a atendente é obrigada a clicar no botão "Filtrar" ou teclar Enter.
- Não existe botão `[✕]` para limpar a pesquisa instantaneamente.
- Não existe chip de "Filtro Ativo" com contagem de resultados (ausência do padrão já estabelecido nas UX-002 e UX-003).

### 2.4 Layout Verticalmente Inchado na Primeira Dobra (1366x768 @ 125%)
- Textos institucionais e jargões ocupam altura útil (`"GESTÃO COMERCIAL & TÉCNICA"`, subtítulo extenso).
- Filtros permanentes em select dividem a barra principal em 4 colunas apertadas.
- A tabela com padding largo (`py-3.5`) exibe apenas 4–5 linhas na tela sem rolagem.

### 2.5 Ação Operacional Frequente Ausente na Tabela
- A rotina mais comum de uma oficina é: *o cliente chega no balcão -> a atendente pesquisa o cliente -> quer abrir uma nova OS para ele*.
- Hoje, a atendente precisa:
  1. Clicar em "Ver Detalhes"
  2. Aguardar o carregamento da página `/clientes/[id]` (5 requisições de rede)
  3. Rolar a página até a seção de Ordens de Serviço ou Equipamentos
  4. Clicar em "Nova Ordem de Serviço"
- Isso consome 3 a 4 cliques e 2 navegações completas de rota.

---

## 3. Fluxos Atuais

```
FLUXO 1: Consulta de Cliente
/clientes → Digitar nome → Clicar em Filtrar → Clicar no ícone de olho → /clientes/[id]

FLUXO 2: Nova OS para Cliente Existente
/clientes → Buscar cliente → Abrir /clientes/[id] → Rolar tela → Clicar em "Nova Ordem de Serviço" → /ordens-servico/nova?clienteId=X

FLUXO 3: Cadastro de Cliente Avulso
/clientes → Clicar em "+ Novo Cliente" → Preencher modal → Salvar → Recarregar lista

FLUXO 4: Inativação / Reativação
/clientes → Clicar no ícone de tomada (Power) → Confirmar modal → Recarregar lista
```

---

## 4. Elementos a Manter

1. **Rota Oficial**: Manter rigorosamente `/clientes` e `/clientes/[id]`.
2. **Botão Principal de Cadastro**: `+ NOVO CLIENTE` com abertura direta do `ClienteModal`.
3. **Formulário Completo de Cadastro e Edição**: Preservar validações Zod, suporte a PF/PJ, endereço e prevenção contra duplicidade.
4. **Página Rica de Detalhes (`/clientes/[id]`)**: Manter dados completos de endereço, equipamentos, histórico e resumo operacional.
5. **Ações Seguras de Ativação/Inativação**: Manter `ConfirmModal` para ações destrutivas.
6. **Paginação**: Preservar paginação do Spring Data JPA (`PageResponse<ClienteResponseDTO>`).

---

## 5. Elementos a Reduzir

1. **Jargões e Textos Corporativos**:
   - Remover a tag `"GESTÃO COMERCIAL & TÉCNICA"`.
   - Simplificar o subtítulo longo para uma frase direta e operacional.
2. **Coluna Isolada de Tipo**:
   - Eliminar a coluna dedicada exclusivamente para exibir `"PF"` ou `"PJ"`.
   - Transformar em tag compacta e discreta ao lado do documento ou nome do cliente.
3. **Coluna Isolada de Cidade/UF**:
   - Em oficinas locais, a esmagadora maioria dos clientes é da mesma região.
   - Retirar a coluna principal de Cidade/UF da listagem para liberar espaço horizontal, tornando-a informação secundária (subtexto do cliente ou detalhe).
4. **Espaçamentos Excessivos**:
   - Reduzir o padding vertical das linhas da tabela de `py-3.5` para `py-2.5`, permitindo exibir de 7 a 8 linhas na primeira dobra em 1366x768 @ 125%.

---

## 6. Elementos a Reorganizar

1. **Barra de Busca Operacional Dominante**:
   - Transformar a busca no elemento visual de maior destaque da tela.
   - Placeholder claro e conciso: *"Buscar por nome, CPF/CNPJ, telefone ou ID..."*.
   - Adicionar botão de limpeza rápida `[✕]`.
   - Busca rápida com debounce automático (400ms).
2. **Pills de Filtro Rápido com Contadores**:
   - Adicionar barra horizontal com pills compactas:
     - `[Todos (X)]`
     - `[Pessoa Física (Y)]`
     - `[Pessoa Jurídica (Z)]`
     - `[Ativos (W)]`
     - `[Inativos (K)]`
3. **Painel Retrátil `[Mais Filtros ▼]`**:
   - Ocultar filtros secundários (ordenação, status específico) em painel colapsável para manter a tela limpa por padrão.
4. **Chip de Filtro Ativo**:
   - Exibir badge destacado quando houver filtros aplicados:  
     `[Filtro Ativo: Pessoa Jurídica (4 encontrados) ✕ Limpar]`
5. **Coluna Operacional de Equipamentos**:
   - Exibir diretamente na tabela o badge: `X equip.` com link para consultar os equipamentos do cliente.
6. **Atalho Direto `+ OS` na Linha do Cliente**:
   - Permitir que a atendente abra uma OS para aquele cliente com apenas 1 clique a partir da listagem.

---

## 7. Pesquisa (Auditoria e Especificação)

### 7.1 Campos Suportados
A pesquisa atende aos seguintes atributos:
- Nome ou Razão Social
- Nome Fantasia
- CPF ou CNPJ
- Telefone fixo ou Celular/WhatsApp
- E-mail
- ID numérico do cliente

### 7.2 Tratamento de Pontuação e Máscaras
Para resolver a falha comprovada na auditoria:
- O frontend normalizará o termo digitado: se o usuário digitar dígitos intercalados com pontos, traços, barras ou parênteses, a busca enviará o termo limpo ou pesquisará tanto pelo termo original quanto pela versão apenas de dígitos.
- Aceitará termos com maiúsculas, minúsculas, acentos e buscas parciais (ex: `"silva"`, `"SILVA"`, `"aço"`, `"aco"`).

### 7.3 Interação do Usuário
- Campo dominante com ícone de lupa.
- Debounce de 400ms: busca automática sem necessidade de teclar Enter.
- Botão `[✕]` para limpar o texto e restaurar a lista completa em 1 clique.

---

## 8. Cadastro (`ClienteModal`)

O formulário já atende aos requisitos essenciais e deve ser mantido organizado em 4 seções lógicas:
1. **Identificação**: Seletor visual PF x PJ, Nome Completo / Razão Social, Nome Fantasia (PJ), CPF/CNPJ, RG/Inscrição Estadual.
2. **Contatos**: Telefone fixo, Celular/WhatsApp, E-mail.
3. **Endereço**: CEP, Logradouro, Número, Complemento, Bairro, Cidade, Estado (UF).
4. **Observações**: Campo livre para anotações técnicas e comerciais.

### 8.1 Campos Obrigatórios x Opcionais
- **Obrigatórios**:
  - Tipo de Pessoa (`FISICA` ou `JURIDICA`)
  - Nome Completo / Razão Social (mínimo 2 caracteres)
  - Caso o logradouro seja informado: Número, Bairro, Cidade e UF tornam-se obrigatórios.
- **Opcionais**:
  - CPF/CNPJ (opcional para agilizar cadastro de balcão, mas validado se informado)
  - Telefone / Celular
  - E-mail
  - Endereço completo (pode ser cadastrado posteriormente)
  - Observações

---

## 9. Comportamento Pessoa Física (PF) x Pessoa Jurídica (PJ)

Ao alternar entre PF e PJ:
- **Pessoa Física**:
  - Campo principal: *"Nome Completo *"*.
  - Documento: *"CPF"* (máscara `000.000.000-00`, validação de 11 dígitos no backend).
  - Documento secundário: *"RG"*.
  - Oculta: *"Nome Fantasia"*.
- **Pessoa Jurídica**:
  - Campo principal: *"Razão Social *"*.
  - Documento: *"CNPJ"* (máscara `00.000.000/0000-00`, validação de 14 dígitos no backend).
  - Documento secundário: *"Inscrição Estadual"*.
  - Exibe: *"Nome Fantasia"*.
- **Integridade de Dados**: A troca de tipo preserva os dados comuns já digitados (nome, contatos e endereço), sem perda acidental.

---

## 10. Prevenção de Duplicidade

### 10.1 Regras de Negócio Existentes no Backend
O `ClienteService.java` já valida conflitos (HTTP 409):
- Nome / Razão Social idêntico (case-insensitive)
- CPF ou CNPJ já cadastrado
- Telefone ou Celular já cadastrado em outro cliente

### 10.2 Melhoria Proposta no Tratamento de Conflito
Quando o backend retornar conflito de duplicidade (ex: `"Já existe um cliente cadastrado com este CPF/CNPJ"`):
- O modal exibirá mensagem clara de aviso:  
  `"Este cliente já possui cadastro na oficina."`
- E apresentará o botão inteligente:  
  `[Ver / Pesquisar Cliente Cadastrado]`
- Ao clicar, o modal se fecha e a barra de busca de `/clientes` é preenchida automaticamente com o CPF ou telefone que gerou o conflito, localizando o cliente existente em 1 clique.

---

## 11. Tabela e Listagem Proposta

### 11.1 Tabela Compacta Prioritária (6 Colunas)

| Coluna | Descrição / Conteúdo | Valor Operacional |
|---|---|---|
| **Cliente** | Nome ou Razão Social em negrito (link para detalhes) + Nome Fantasia em subtexto + badge discreto `PF` ou `PJ` | Identificação imediata do cliente |
| **Documento** | CPF ou CNPJ formatado em fonte mono legível | Confirmação fiscal e cadastral |
| **Contato** | Telefone / WhatsApp com link direto `tel:` / `wa.me` + E-mail em subtexto | Comunicação rápida com 1 toque/clique |
| **Equipamentos** | Badge clicável `X máq.` (dados reais de `totalEquipamentos`) | Saber instantaneamente o porte do cliente na oficina |
| **Status** | Badge compacto "Ativo" (verde) ou "Inativo" (cinza) | Visibilidade operacional |
| **Ações** | Botão primário `Ver →` + Botão atalho `+ OS` + Botão secundário de edição | Agilidade no atendimento de balcão |

---

## 12. Ações por Cliente

A experiência proposta divide as ações em:
1. **Ação Primária**: Link no nome ou botão `Ver →` que abre `/clientes/[id]`.
2. **Ação Operacional Direta**: Botão compacto `+ OS` que leva direto para `/ordens-servico/nova?clienteId={id}`, poupando navegações intermediárias.
3. **Ações de Gestão**:
   - `Editar` (abre modal de edição com os dados pré-preenchidos).
   - `Inativar / Ativar` (aciona modal de confirmação com segurança).

---

## 13. Detalhes do Cliente (`/clientes/[id]`)

A página de detalhes continuará existindo como hub completo de gestão do cliente:
- Cabeçalho objetivo com dados cadastrais e botão de edição.
- 5 Indicadores operacionais consolidados (Equipamentos, Total de OS, OS Abertas, Última Visita, Valor Acumulado).
- Grade de Contatos e Endereço.
- Seção de Equipamentos com ações diretas por máquina.
- Seção de Histórico de Ordens de Serviço do cliente com valores e status.

---

## 14. Relação Cliente → Equipamento

- A listagem geral exibirá a contagem real de equipamentos (`totalEquipamentos`) em cada linha.
- Na página `/clientes/[id]`, a atendente visualiza todos os equipamentos daquele cliente com opções de:
  - Cadastrar novo equipamento vinculado (`MaquinaModal`)
  - Abrir OS para um equipamento específico (`/ordens-servico/nova?clienteId=X&maquinaId=Y`)
  - Consultar histórico individual do equipamento (`/maquinas/[id]`)

---

## 15. Relação Cliente → Ordens de Serviço

- Na listagem geral: Novo botão de atalho `+ OS` pré-vincula o cliente na criação de ordem de serviço.
- Na página de detalhes: Tabela com todas as Ordens de Serviço já abertas para o cliente, exibindo número, máquina, data, status e valor faturado.
- Facilidade de resposta para a pergunta clássica: *"Quais serviços esse cliente já realizou na oficina?"*.

---

## 16. Histórico do Cliente

- Ordenação cronológica decrescente (visitas e OS mais recentes primeiro).
- Indicador de "Última Visita" baseado na data de entrada da última OS.
- Indicador de "Total Acumulado" somando exclusivamente OS com status `CONCLUIDA`.

---

## 17. Estados da Página

1. **Loading**:
   - Linhas com spinner ou esqueleto discreto sem bloquear o layout geral.
2. **Vazio (Sem cadastros)**:
   - *"Nenhum cliente cadastrado ainda."* com botão `[+ Cadastrar Primeiro Cliente]`.
3. **Vazio (Filtros sem resultados)**:
   - *"Nenhum cliente encontrado para os filtros informados."* com botão `[Limpar Filtros e Busca]`.
4. **Erro de Conexão / Servidor**:
   - Mensagem amigável com opção `[Tentar Novamente]`.
   - Garantia absoluta de **ZERO** `TypeError: Cannot read properties of undefined (reading 'map')`.

---

## 18. Paginação

- Tamanho padrão da página: **15 clientes por página** (alinhado ao padrão da UX-003).
- Texto explicativo claro:  
  `Mostrando 1 a 15 de 42 clientes`
- Navegação: Botões "Anterior" e "Próxima" com indicador `Página 1 de 3`.
- Funcionamento testado para 0, 1, 15, 16, 20, 21, 40, 41 e 100+ registros.

---

## 19. URL e Navegação

- Preservação do estado nos query parameters da URL:
  - `/clientes?termo=Silva`
  - `/clientes?tipoPessoa=JURIDICA`
  - `/clientes?ativo=true`
  - `/clientes?page=1`
- Permite favoritar, compartilhar ou recarregar (F5) mantendo exatamente o filtro ativo.
- Tratamento amigável para ID inexistente em `/clientes/[id]` (card informativo de cliente não localizado com link para voltar).

---

## 20. Integração com Fluxo UX-001 (Nova OS)

- O fluxo implementado na UX-001 (`/ordens-servico/nova` -> cadastro inline de cliente e máquina) continuará 100% preservado.
- O `ClienteModal` utilizado na página `/clientes` é o mesmo componente compartilhado, garantindo que qualquer alteração de regras de validação permaneça uniforme em toda a aplicação.

---

## 21. Performance e Otimização de Chamadas HTTP

### 21.1 Medição Atual Auditada (Antes)
- **Abertura de `/clientes`**:
  - Chamada 1: `GET /api/auth/me` (sessão)
  - Chamada 2: `GET /api/clientes?page=0&size=10...` (dados paginados)
  - Total: **2 chamadas HTTP** (eficiente).
- **Abertura de `/clientes/[id]`**:
  - Chamada 1: `GET /api/auth/me`
  - Chamada 2: `GET /api/clientes/{id}`
  - Chamada 3: `GET /api/clientes/{id}/maquinas?size=50`
  - Chamada 4: `GET /api/clientes/{id}/ordens-servico?size=50`
  - Chamada 5: `GET /api/clientes/{id}/resumo`
  - Total: **5 chamadas HTTP em cascata**.

### 21.2 Meta da Proposta (Depois)
- Listagem `/clientes`: Manter estritamente **2 chamadas HTTP** (`/api/auth/me` + `/api/clientes`).
- Detalhes `/clientes/[id]`: Executar requisições de equipamentos, OS e resumo em paralelo com `Promise.allSettled`, eliminando espera sequencial.

---

## 22. Segurança e Controle de Acesso

- Autenticação obrigatória gerenciada por JWT em cookie HttpOnly e Bearer token.
- Rotas protegidas no middleware Next.js (`/clientes`, `/clientes/*`).
- Consultas parametrizadas no Spring Data JPA contra injeção SQL.
- Validação estrita de tipos e sanitização de entradas no backend (`ClienteCreateDTO`, `ClienteUpdateDTO`).

---

## 23. Responsividade e Densidade Visual

- Otimizado para **1366x768 @ 125%**:
  - O cabeçalho compacto + barra de busca ocupam menos de 140px de altura.
  - A tabela compacta permite visualizar de **7 a 8 clientes** na primeira dobra.
- Telas suportadas:
  - 1366x768 (100% e 125%)
  - 1280x720 (notebooks compactos)
  - 1440x900
  - 1920x1080 (Full HD)
  - Mobile (< 640px): Ações e busca adaptadas verticalmente com scroll horizontal seguro na tabela.

---

## 24. Redução de Cliques e Esforço Operacional

| Operação | Fluxo Anterior | Fluxo Proposto | Economia de Esforço |
|---|---|---|---|
| **Pesquisar cliente** | Digitar + Clicar "Filtrar" (2 ações) | Digitar (busca automática debounced) | **-50% de ações** |
| **Limpar busca** | Selecionar texto + Apagar + Clicar "Filtrar" (3 ações) | 1 clique no botão `[✕]` | **-66% de ações** |
| **Cadastrar novo cliente** | 1 clique no botão de cadastro | 1 clique no botão destacado `+ NOVO CLIENTE` | Mantido 1 clique com maior visibilidade |
| **Abrir OS para cliente da lista** | Clicar "Ver" -> Esperar carregar -> Rolar página -> Clicar "Nova OS" (4 passos) | 1 clique no atalho `+ OS` na própria linha da tabela | **-75% de cliques e sem troca de página** |
| **Consultar quantidade de equipamentos** | Abrir detalhes do cliente (1 clique + carregamento) | Visível diretamente na coluna "Equipamentos" | **Instantâneo (0 cliques)** |

---

## 25. Wireframes Textuais

### 25.1 Wireframe Proposto para `/clientes` (Desktop / Notebook 1366x768)

```text
+----------------------------------------------------------------------------------------------------+
|  [OFICINA GESTÃO]   Dashboard  Clientes(ativo)  Equipamentos  Ordens de Serviço  Estoque  Relatórios|
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|  CLIENTES                                                                 [ + NOVO CLIENTE ]       |
|  Gestão cadastral, contatos e equipamentos dos clientes da oficina                                 |
|                                                                                                    |
|  +----------------------------------------------------------------------------------------------+  |
|  | [🔍 Buscar por nome, CPF/CNPJ, telefone ou ID...                           ] [ ✕ ] [Mais Filtros ▼]|
|  +----------------------------------------------------------------------------------------------+  |
|                                                                                                    |
|  [Todas (11)]  [Pessoa Física (7)]  [Pessoa Jurídica (4)]  [Ativos (10)]  [Inativos (1)]           |
|                                                                                                    |
|  [Filtro Ativo: Pessoa Jurídica (4 encontrados) ✕ Limpar]                                          |
|                                                                                                    |
|  +----------------------------------------------------------------------------------------------+  |
|  | CLIENTE                   | DOCUMENTO       | CONTATO             | EQUIP.  | STATUS | AÇÕES   |  |
|  |---------------------------|-----------------|---------------------|---------|--------|---------|  |
|  | Construtora Vale S/A [PJ] | 12.345.678/0001 | (31) 98888-7777     | 3 máq.  | Ativo  | Ver →   |  |
|  | Vale Construções          |                 | contato@vale.com    |         |        | [+ OS]  |  |
|  |---------------------------|-----------------|---------------------|---------|--------|---------|  |
|  | João da Silva [PF]        | 123.456.789-00  | (31) 99999-1111     | 1 máq.  | Ativo  | Ver →   |  |
|  |                           |                 | joao@email.com      |         |        | [+ OS]  |  |
|  |---------------------------|-----------------|---------------------|---------|--------|---------|  |
|  | Metalúrgica Aço Forte [PJ]| 98.765.432/0001 | (31) 3333-2222     | 5 máq.  | Ativo  | Ver →   |  |
|  | Aço Forte Soldas          |                 | sac@acoforte.com    |         |        | [+ OS]  |  |
|  +----------------------------------------------------------------------------------------------+  |
|  Mostrando 1 a 15 de 11 clientes                                         < Anterior [1] Próxima >  |
+----------------------------------------------------------------------------------------------------+
```

### 25.2 Wireframe do Painel Retrátil `[Mais Filtros ▼]` (Aberto)

```text
+----------------------------------------------------------------------------------------------------+
|  [Mais Filtros ▲ Ocultar]                                                                          |
|  +----------------------------------------------------------------------------------------------+  |
|  | Tipo de Pessoa:               | Status Cadastral:         | Ordenação:                       |  |
|  | [ Todos os Tipos          ▼ ] | [ Todos os Status     ▼ ] | [ Nome / Razão Social (A-Z)  ▼ ] |  |
|  +----------------------------------------------------------------------------------------------+  |
+----------------------------------------------------------------------------------------------------+
```

---

## 26. Arquivos que Seriam Alterados na Fase de Implementação

Quando a proposta for aprovada pelo usuário, a implementação envolverá:

1. **Frontend**:
   - `frontend/src/app/clientes/page.tsx`: Reestruturação completa com cabeçalho compacto, busca debounced, pills de status, chip de filtro ativo, tabela compacta de 6 colunas e atalhos operacionais.
   - `frontend/src/lib/clientesOperacional.test.ts`: Criação de suíte de testes unitários dedicada aos fluxos de clientes (pesquisa, filtros, contadores, atalhos).
2. **Backend (se estritamente necessário para normalização de máscara)**:
   - Pequeno ajuste em `ClienteService.java` para que a busca por termo também compare o valor sem pontuação (`apenasDigitos`), garantindo que a busca por CPF/telefone com máscara encontre o registro sem alterar banco ou migrations.
3. **Sem Migrations**:
   - **Zero** migrations do Flyway (V1–V9 permanecem intactas).
   - Nenhuma alteração de schema ou tabela.

---

## 27. Conformidade com as Regras do Projeto

- [x] **Não iniciar V1.2**: Mantido estritamente no escopo da V1.1.
- [x] **Não remover `/clientes`**: Página preservada e melhorada.
- [x] **Não alterar banco de dados**: Zero migrations, zero DDL.
- [x] **Não alterar regras de negócio**: Fluxos de duplicidade e validações intactos.
- [x] **Não modificar código nesta etapa**: Documentação e auditoria exclusivas.
- [x] **Não criar commit nesta etapa**: Aguardando aprovação explícita do usuário.

---

## 28. Status Final

**STATUS: PROPOSTA PRONTA PARA APROVAÇÃO**
