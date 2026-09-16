# Padrões e Especificação de API — Oficina Gestão

Documentação de contratos REST e especificações de endpoints para a plataforma **Oficina Gestão** (oficina técnica especializada em conserto, manutenção e reparo de máquinas de solda e geradores de energia).

## 1. Padrões REST

- **Formato**: JSON (`application/json; charset=UTF-8`)
- **Prefixação**: Todos os endpoints públicos e operacionais utilizam o prefixo `/api`
- **Códigos de Resposta**:
  - `200 OK`: Sucesso com retorno de payload
  - `201 Created`: Recurso criado com sucesso
  - `204 No Content`: Ação executada sem conteúdo retornado
  - `400 Bad Request`: Erro de validação ou parâmetros inválidos
  - `401 Unauthorized`: Autenticação ausente ou inválida
  - `403 Forbidden`: Sem permissão para o recurso solicitado
  - `404 Not Found`: Recurso não localizado
  - `500 Internal Server Error`: Falha interna do servidor

---

## 2. Endpoints da Fase 0 (Fundação)

### `GET /api/health`

Verifica a disponibilidade do serviço backend.

- **Método**: `GET`
- **URL**: `/api/health`
- **Autenticação**: Não requerida
- **Resposta Sucesso (200 OK)**:
  ```json
  {
    "status": "UP"
  }
  ```

---

## 3. Endpoints da Fase 2 e 2.1 (Autenticação da Proprietária e Hardening)

### `POST /api/auth/login`

Autentica a proprietária via e-mail e senha. Define cookies `HttpOnly` seguros para access token e refresh token. **Não expõe tokens JWT no corpo da resposta**. Registra auditoria com ação `LOGIN`.

- **Método**: `POST`
- **URL**: `/api/auth/login`
- **Autenticação**: Não requerida
- **Headers**: `Content-Type: application/json`
- **Corpo da Requisição**:
  ```json
  {
    "email": "admin@oficina.com",
    "senha": "sua_senha_segura"
  }
  ```
- **Resposta Sucesso (200 OK)**:
  - **Set-Cookie (Access)**: `access_token=<JWT>; Path=/; Max-Age=900; HttpOnly; SameSite=Lax`
  - **Set-Cookie (Refresh)**: `refresh_token=<UUID>; Path=/api/auth; Max-Age=604800; HttpOnly; SameSite=Strict`
  - **Body**:
    ```json
    {
      "user": {
        "id": 1,
        "nome": "Proprietária",
        "email": "admin@oficina.com",
        "roles": ["ROLE_ADMIN"]
      }
    }
    ```
- **Respostas de Erro**:
  - `400 Bad Request`: E-mail ou senha em branco/inválido.
  - `401 Unauthorized`: "Credenciais inválidas." (Protegido contra enumeração de usuários).

---

### `POST /api/auth/refresh`

Renova silenciosamente a sessão ativa utilizando o cookie `refresh_token`. Aplica rotação de token: invalida o refresh token utilizado e emite um novo par de tokens.

- **Método**: `POST`
- **URL**: `/api/auth/refresh`
- **Autenticação**: Não requerida via Authorization Header (controlada estritamente via Cookie `refresh_token`)
- **Headers**: Nenhum header adicional obrigatório (navegador anexa cookies automaticamente)
- **Resposta Sucesso (200 OK)**:
  - **Set-Cookie (Novo Access)**: `access_token=<Novo JWT>; Path=/; Max-Age=900; HttpOnly; SameSite=Lax`
  - **Set-Cookie (Novo Refresh)**: `refresh_token=<Novo UUID>; Path=/api/auth; Max-Age=604800; HttpOnly; SameSite=Strict`
  - **Body**:
    ```json
    {
      "user": {
        "id": 1,
        "nome": "Proprietária",
        "email": "admin@oficina.com",
        "roles": ["ROLE_ADMIN"]
      }
    }
    ```
- **Respostas de Erro**:
  - `401 Unauthorized`: Refresh token ausente, expirado ou revogado.

---

### `GET /api/auth/me`

Retorna os dados cadastrais e permissões do usuário logado na sessão atual.

- **Método**: `GET`
- **URL**: `/api/auth/me`
- **Autenticação**: Requerida (via Cookie `access_token` ou Header `Authorization: Bearer <token>`)
- **Resposta Sucesso (200 OK)**:
  ```json
  {
    "id": 1,
    "nome": "Proprietária",
    "email": "admin@oficina.com",
    "roles": ["ROLE_ADMIN"]
  }
  ```
- **Respostas de Erro**:
  - `401 Unauthorized`: Sessão inválida ou expirada.

---

### `POST /api/auth/logout`

Encerra a sessão, revoga o refresh token correspondente no banco de dados, expira ambos os cookies (`access_token` e `refresh_token`) e registra a auditoria com ação `LOGOUT`.

- **Método**: `POST`
- **URL**: `/api/auth/logout`
- **Autenticação**: Opcional (pública para limpeza de cookies; autenticada para auditoria vinculada)
- **Resposta Sucesso (200 OK)**:
  - **Set-Cookie**: `access_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`
  - **Set-Cookie**: `refresh_token=; Path=/api/auth; Max-Age=0; HttpOnly; SameSite=Strict`
  - **Body**: Vazio (200 OK)

---

## 4. Endpoints de Diagnóstico e Sistema (Fase 3)

### `GET /api/system/status`

Retorna informações operacionais do sistema backend, status do banco de dados e ambiente em execução.

- **Método**: `GET`
- **URL**: `/api/system/status`
- **Autenticação**: Requerida (perfil `ROLE_ADMIN`)
- **Resposta Sucesso (200 OK)**:
  ```json
  {
    "status": "UP",
    "timestamp": "2026-09-15T01:00:00Z",
    "database": "CONNECTED",
    "environment": "dev",
    "version": "1.0.0"
  }
  ```
- **Respostas de Erro**:
  - `401 Unauthorized`: Usuário não autenticado.
  - `403 Forbidden`: Usuário sem a autoridade `ROLE_ADMIN`.

---

## 5. Endpoints da Fase 4A (Módulo de Clientes)

Todos os endpoints abaixo exigem autenticação ativa com o perfil `ROLE_ADMIN`.

### `POST /api/clientes`
Cadastra um novo cliente (Pessoa Física ou Pessoa Jurídica) e seu endereço.

- **Método**: `POST`
- **URL**: `/api/clientes`
- **Resposta Sucesso (201 Created)**: Retorna `ClienteResponseDTO`
- **Respostas de Erro**:
  - `400 Bad Request`: Dados obrigatórios ausentes ou e-mail inválido.
  - `401 Unauthorized`: Sessão ausente.
  - `409 Conflict`: CPF, CNPJ, telefone, celular ou razão social já existente.

### `GET /api/clientes`
Pesquisa paginada de clientes com filtros opcionais.

- **Método**: `GET`
- **URL**: `/api/clientes?termo={termo}&tipoPessoa={FISICA|JURIDICA}&ativo={true|false}&page=0&size=10`
- **Resposta Sucesso (200 OK)**: `PageResponse<ClienteResponseDTO>`

### `GET /api/clientes/{id}`
Consulta detalhada de um cliente específico por ID.

- **Método**: `GET`
- **URL**: `/api/clientes/{id}`
- **Resposta Sucesso (200 OK)**: `ClienteResponseDTO`
- **Respostas de Erro**:
  - `404 Not Found`: Cliente não localizado.

### `PUT /api/clientes/{id}`
Atualização cadastral e de endereço do cliente.

- **Método**: `PUT`
- **URL**: `/api/clientes/{id}`
- **Resposta Sucesso (200 OK)**: `ClienteResponseDTO` atualizado.
- **Respostas de Erro**:
  - `404 Not Found`: Cliente não localizado.
  - `409 Conflict`: Conflito de duplicidade com outro cliente existente.

### `PATCH /api/clientes/{id}/status`
Ativação ou inativação rápida do cliente.

- **Método**: `PATCH`
- **URL**: `/api/clientes/{id}/status`
- **Payload**: `{ "ativo": false }`
- **Resposta Sucesso (200 OK)**: `ClienteResponseDTO` com status atualizado.

---

## 6. Contrato Padrão de Erro (`ApiErrorResponse`)

Todas as respostas de erro da API (4xx e 5xx) seguem estritamente a seguinte estrutura JSON:

```json
{
  "timestamp": "2026-09-15T01:00:00.000Z",
  "status": 400,
  "error": "Bad Request",
  "message": "Erro de validação nos campos informados.",
  "path": "/api/exemplo",
  "details": {
    "campo": "mensagem específica de validação"
  }
}
```

- **Campos**:
  - `timestamp`: Data/hora ISO-8601 da ocorrência do erro.
  - `status`: Código HTTP semântico (400, 401, 403, 404, 409, 500).
  - `error`: Nome resumido do erro HTTP.
  - `message`: Descrição amigável e segura da causa.
  - `path`: URI requisitada.
  - `details`: Mapa opcional com detalhes de validação por campo (omitido quando vazio).
- **Segurança de Dados**: O contrato garante que **nenhuma** stack trace, comando SQL, nome interno de constraint ou segredo seja divulgado ao cliente.

---

## 7. Contrato Padrão de Paginação (`PageResponse<T>`)

Para listagens paginadas nos módulos de negócio, a resposta padronizada encapsula os dados e metadados de paginação:

```json
{
  "content": [
    { "id": 1, "nome": "Exemplo" }
  ],
  "pageNumber": 0,
  "pageSize": 20,
  "totalElements": 1,
  "totalPages": 1,
  "first": true,
  "last": true
}
```

---

## 8. Documentação OpenAPI 3 / Swagger UI

A documentação interativa e a especificação JSON estão disponíveis nos seguintes endpoints públicos:

- **Swagger UI (Interface Web)**: `http://localhost:8080/swagger-ui/index.html` (ou `/swagger-ui.html`)
- **OpenAPI JSON Spec**: `http://localhost:8080/v3/api-docs`
- **Esquemas de Autenticação Suportados**:
  - `cookieAuth`: Cookie `access_token` (padrão do navegador).
  - `bearerAuth`: Header `Authorization: Bearer <token>` (para testes via Swagger UI ou integrações).

---

## 9. Padrões de Ordem de Serviço e Ciclo Técnico (Máquinas de Solda e Geradores)

### 9.1. Ciclo de Vida e Transições de Status
Os status permitidos no fluxo técnico real da oficina são:
- `ABERTA`: Entrada do equipamento na oficina.
- `EM_DIAGNOSTICO`: Avaliação técnica em bancada.
- `AGUARDANDO_APROVACAO`: Orçamento gerado com peças e mão de obra, aguardando aval do cliente.
- `EM_MANUTENCAO`: Orçamento aprovado, técnico realizando conserto ou substituição de peças.
- `AGUARDANDO_PECA`: Manutenção pausada por falta de insumo em estoque.
- `PRONTA`: Manutenção finalizada e validada na etapa de **Testes Técnicos em Bancada**.
- `CONCLUIDA`: Equipamento retirado pelo cliente, faturado e garantia iniciada.
- `CANCELADA`: Orçamento recusado ou inviabilidade técnica constatada.

### 9.2. Registro de Testes Técnicos
O campo `testes_realizados` na Ordem de Serviço armazena o histórico técnico mandatório antes da liberação para `PRONTA`:
- **Máquinas de Solda**: Teste de abertura de arco elétrico sob carga, estabilidade de corrente (A), ciclo de trabalho e verificação de aquecimento térmico.
- **Geradores de Energia**: Teste sob carga resistiva/indutiva, rotação (RPM/Hz), aferição de tensão nas fases (110V/220V/380V) e atuação do regulador automático de voltagem (AVR).

---

## 10. Endpoints da Fase 5 (Ordens de Serviço e Histórico Técnico)

Todos os endpoints abaixo exigem autenticação ativa (`ROLE_ADMIN` ou `ROLE_USER`).

### `POST /api/ordens-servico`
Abre uma nova Ordem de Serviço.
- **Regra de Domínio**: O equipamento (`maquinaId`) deve pertencer estritamente ao cliente informado (`clienteId`). Se pertencer a outro cliente, a API retorna `400 Bad Request` com código de erro de validação.
- **Geração de Número**: Caso `numeroOs` não seja fornecido, o backend gera automaticamente o formato sequencial anual `OS-YYYY-XXXX`.
- **Payload**:
  ```json
  {
    "clienteId": 1,
    "maquinaId": 2,
    "numeroOs": "OS-2026-0001",
    "dataEntrada": "2026-09-15T10:30:00Z",
    "problemaRelatado": "Máquina não abre arco elétrico na soldagem TIG",
    "horimetroAtual": "1450.5",
    "observacoes": "Acompanha tocha TIG e regulador de gás argônio"
  }
  ```
- **Resposta Sucesso (201 Created)**: `OrdemServicoResponseDTO` com status inicial `ABERTA`.

---

### `GET /api/ordens-servico`
Consulta paginada de Ordens de Serviço com filtros combinados.
- **Query Params**:
  - `termo`: Busca textual por número da OS, nome do cliente, documento (CPF/CNPJ), marca ou modelo do equipamento.
  - `status`: Filtro por enum `StatusOrdemServico` (`ABERTA`, `EM_DIAGNOSTICO`, etc.).
  - `dataInicio` / `dataFim`: Intervalo de data de entrada (ISO-8601).
  - `clienteId`: Filtro opcional por cliente.
  - `maquinaId`: Filtro opcional por equipamento.
  - `page` (default 0), `size` (default 20), `sort` (default `dataEntrada,desc`).
- **Resposta Sucesso (200 OK)**: `PageResponse<OrdemServicoResponseDTO>`.

---

### `GET /api/ordens-servico/{id}`
Recupera os detalhes completos de uma Ordem de Serviço pelo seu ID.
- **Resposta Sucesso (200 OK)**: `OrdemServicoResponseDTO`.
- **Resposta de Erro**: `404 Not Found` se a OS não existir.

---

### `PUT /api/ordens-servico/{id}`
Atualiza dados técnicos e financeiros da Ordem de Serviço.
- **Regra de Bloqueio**: Ordens com status `CONCLUIDA` ou `CANCELADA` estão travadas para edição (`400 Bad Request`).
- **Regra Financeira**: Os valores de serviços, peças e descontos não podem ser negativos (`valorTotal` recalculado automaticamente como `servicos + pecas - desconto >= 0`).
- **Payload**:
  ```json
  {
    "problemaRelatado": "Defeito atualizado",
    "diagnostico": "Placa inversora com IGBTs em curto circuito",
    "solucaoAplicada": "Substituição dos módulos IGBT e resistores de shunt",
    "testesRealizados": "Teste em bancada a 180A por 15 minutos com arco estável",
    "horimetroAtual": "1452.0",
    "valorMaoObra": 450.00,
    "valorPecas": 780.00,
    "valorDesconto": 30.00,
    "observacoes": "Equipamento limpo e revisado"
  }
  ```
- **Resposta Sucesso (200 OK)**: `OrdemServicoResponseDTO` atualizado.

---

### `PATCH /api/ordens-servico/{id}/status`
Avança ou altera o status operacional da Ordem de Serviço.
- **Regras de Negócio**:
  - Transição para `PRONTA` exige obrigatoriamente o preenchimento do campo `testesRealizados` (ou no payload do PATCH ou já registrado na OS).
  - Transição para `CONCLUIDA` preenche automaticamente `dataConclusao` com a data/hora atual.
  - Ordens em status terminal (`CONCLUIDA`, `CANCELADA`) não aceitam nova alteração de status.
- **Payload**:
  ```json
  {
    "status": "PRONTA",
    "testesRealizados": "Teste de carga resistiva a 100% de potência por 30min sem oscilação",
    "observacoes": "Aprovado em bancada técnica"
  }
  ```
- **Resposta Sucesso (200 OK)**: `OrdemServicoResponseDTO` com novo status.

---

### `GET /api/clientes/{clienteId}/ordens-servico`
Retorna o histórico de todas as Ordens de Serviço vinculadas ao cliente especificado.
- **Query Params**: `page`, `size`, `sort`.
- **Resposta Sucesso (200 OK)**: `PageResponse<OrdemServicoResponseDTO>`.

---

### `GET /api/maquinas/{maquinaId}/ordens-servico`
Retorna o histórico técnico completo e cronológico de um equipamento específico.
- **Propósito Central**: Responder: *"Quantas vezes essa máquina já veio para a oficina e o que foi feito nela ao longo do tempo?"*
- **Query Params**: `page`, `size`, `sort`.
- **Resposta Sucesso (200 OK)**: `PageResponse<OrdemServicoResponseDTO>`.

---

## 11. Módulo de Peças, Produtos, Estoque e Fornecedores (Fase 6)

### 11.1. Fornecedores

#### `POST /api/fornecedores`
Cadastra um fornecedor técnico de peças e insumos.
- **Validações**: `razaoSocial` obrigatória, `cnpj` único (quando informado).
- **Resposta Sucesso (201 Created)**: `FornecedorResponseDTO`.

#### `GET /api/fornecedores`
Lista paginada de fornecedores com filtro textual opcional (`termo`) e status `ativo`.

#### `GET /api/fornecedores/{id}`
Detalhes do fornecedor pelo ID.

#### `PUT /api/fornecedores/{id}`
Atualiza os dados cadastrais do fornecedor.

#### `PATCH /api/fornecedores/{id}/status`
Ativa ou inativa o fornecedor.

---

### 11.2. Categorias de Peças e Produtos

#### `POST /api/categorias`
Cadastra uma nova categoria técnica.
- **Payload**: `{ "nome": "Eletrônica", "descricao": "Placas e semicondutores", "ativo": true }`
- **Resposta Sucesso (201 Created)**: `CategoriaResponseDTO`.

#### `GET /api/categorias`
Lista paginada de categorias com ordenação por nome.

#### `GET /api/categorias/ativas`
Lista todas as categorias ativas em formato simples (`List<CategoriaResponseDTO>`) para preenchimento de dropdowns e filtros.

#### `GET /api/categorias/{id}`
Busca categoria por ID.

#### `PUT /api/categorias/{id}`
Atualiza dados da categoria.

#### `PATCH /api/categorias/{id}/status`
Ativa ou inativa a categoria.

---

### 11.3. Produtos e Peças de Reposição

#### `POST /api/produtos`
Cadastra uma nova peça ou produto técnico (IGBTs, diodos, capacitores, reguladores AVR, pontes retificadoras).
- **Regra**: `codigo` único obrigatório, `precoVenda >= 0`, `estoqueMinimo >= 0`.
- **Payload**:
  ```json
  {
    "codigo": "IGBT-60N100",
    "codigoBarras": "7891234567890",
    "nome": "Módulo IGBT 60N100 60A 1000V",
    "descricao": "Módulo de potência para inversores de solda TIG/MIG",
    "marca": "Toshiba",
    "tipo": "PECA",
    "unidadeMedida": "UN",
    "precoCusto": 45.00,
    "precoVenda": 85.00,
    "estoqueInicial": 10,
    "estoqueMinimo": 2,
    "localizacao": "Prateleira B3",
    "categoriaId": 1,
    "fornecedorId": 1
  }
  ```
- **Resposta Sucesso (201 Created)**: `ProdutoResponseDTO` com `categoriaNome` e `marca`.

#### `GET /api/produtos`
Lista produtos com paginação e filtros combinados:
- `termo`: Busca por código, nome, marca ou código de barras.
- `tipo`: `PRODUTO`, `PECA`, `SERVICO`, `CONSUMIVEL`.
- `categoriaId`: ID numérico da categoria.
- `fornecedorId`: ID numérico do fornecedor.
- `estoqueBaixo`: `true` filtra apenas itens em que `estoqueAtual <= estoqueMinimo`.
- `ativo`: `true` ou `false`.

#### `GET /api/produtos/{id}`
Retorna a ficha cadastral do produto.

#### `PUT /api/produtos/{id}`
Atualiza preços, descrições, estoque mínimo, categoria, marca e localização do produto.

#### `PATCH /api/produtos/{id}/status`
Ativa ou inativa o produto.

#### `GET /api/produtos/{id}/compatibilidades` (ou `/api/produtos/{id}/maquinas`)
Lista as máquinas e equipamentos compatíveis com a peça (`produto_maquina`).

#### `POST /api/produtos/{id}/compatibilidades` (ou `/api/produtos/{id}/maquinas`)
Vincula um equipamento compatível à peça técnica.
- **Payload**: `{ "maquinaId": 2, "observacaoCompatibilidade": "Aplicar pasta térmica de prata" }`

#### `DELETE /api/produtos/{id}/compatibilidades/{maquinaId}` (ou `/api/produtos/{id}/maquinas/{maquinaId}`)
Remove o vínculo de compatibilidade entre a peça e a máquina.

---

### 11.4. Gestão e Movimentações de Estoque

#### `GET /api/estoque/resumo`
Retorna indicadores consolidados de inventário:
- `totalProdutos`: Total de itens cadastrados e ativos.
- `itensSemEstoque`: Produtos com saldo zero.
- `itensEstoqueBaixo`: Produtos com saldo `<= estoqueMinimo`.
- `valorTotalEstoque`: Valorização física total calculada a preço de custo.

#### `POST /api/estoque/entrada`
Registra entrada manual de mercadorias / reposição por fornecedor com lock pessimista:
- **Payload**:
  ```json
  {
    "produtoId": 1,
    "quantidade": 10,
    "motivo": "Compra NF 1234 - Reposição"
  }
  ```
- **Resposta Sucesso (201 Created)**: `EstoqueMovimentacaoResponseDTO`.

#### `POST /api/estoque/saida`
Registra saída manual de peças (descarte, sucata ou perda técnica):
- **Payload**:
  ```json
  {
    "produtoId": 1,
    "quantidade": 2,
    "motivo": "Descarte de componente danificado em transporte"
  }
  ```
- **Resposta Sucesso (201 Created)**: `EstoqueMovimentacaoResponseDTO`.

#### `POST /api/estoque/ajuste`
Registra balanço/ajuste de inventário (`AJUSTE_POSITIVO` ou `AJUSTE_NEGATIVO`):
- **Payload**:
  ```json
  {
    "produtoId": 1,
    "tipoMovimentacao": "AJUSTE_POSITIVO",
    "quantidade": 3,
    "motivo": "Ajuste de inventário físico mensal"
  }
  ```
- **Resposta Sucesso (201 Created)**: `EstoqueMovimentacaoResponseDTO`.

#### `POST /api/estoque/movimentar`
Endpoint genérico de movimentação manual (`MovimentacaoManualDTO`).

#### `GET /api/estoque/movimentacoes`
Auditoria completa de histórico de movimentações paginadas:
- **Query Params**: `produtoId`, `tipo`, `dataInicio`, `dataFim`, `numeroOs`, `page`, `size`.

---

### 11.4. Peças e Itens de Ordem de Serviço (Baixa Atômica)

#### `GET /api/ordens-servico/{id}/itens`
Lista todas as peças vinculadas à Ordem de Serviço.
- **Resposta Sucesso (200 OK)**: Lista de `OrdemServicoItemResponseDTO` com código, nome, quantidade, preço unitário congelado na data do atendimento, desconto e subtotal.

#### `POST /api/ordens-servico/{id}/itens`
Adiciona uma peça à Ordem de Serviço em transação atômica e concorrência segura:
1. Bloqueia o produto via Pessimistic Lock (`findByIdWithLock`).
2. Valida saldo disponível (`estoqueAtual >= quantidade`).
3. Deduz fisicamente a quantidade do estoque (`estoque_atual -= quantidade`).
4. Congela o preço unitário histórico do produto naquele exato momento.
5. Cria o registro em `ordem_servico_itens`.
6. Registra movimentação de estoque tipo `SAIDA` vinculada à OS.
7. Recalcula `valorPecas` e `valorTotal` da Ordem de Serviço.
- **Payload**:
  ```json
  {
    "produtoId": 1,
    "quantidade": 2,
    "valorDesconto": 0.00,
    "observacoes": "Substituição preventiva do canal A"
  }
  ```
- **Resposta Sucesso (201 Created)**: `OrdemServicoItemResponseDTO`.

#### `DELETE /api/ordens-servico/{id}/itens/{itemId}`
Remove uma peça da Ordem de Serviço com estorno automático:
1. Bloqueia o produto via Pessimistic Lock.
2. Devolve a quantidade física ao saldo do produto (`estoque_atual += quantidade`).
3. Registra movimentação de estoque tipo `DEVOLUCAO` vinculada à OS.
4. Remove a linha de `ordem_servico_itens`.
5. Recalcula `valorPecas` e `valorTotal` da Ordem de Serviço.
- **Resposta Sucesso (204 No Content)**.

---

## 12. Endpoints da Fase 7 (Histórico Técnico e Busca Rápida)

### 12.1. Busca Rápida Global

#### `GET /api/busca/rapida`
Executa busca global transversal e agregada em frações de segundo para balcão de atendimento:
- **Query Params**: `termo` (obrigatório, mínimo 1 caractere).
- **Escopo Pesquisado**:
  - Clientes (nome, razão social, nome fantasia, CPF/CNPJ, telefone);
  - Equipamentos (marca, modelo, número de série, nome do cliente vinculado);
  - Ordens de Serviço (número da OS, cliente, equipamento, problema relatado);
  - Peças / Produtos (código, nome, código de barras/SKU, marca).
- **Limite**: Máximo 5 registros por categoria (total até 20 itens).
- **Resposta Sucesso (200 OK)**: `BuscaRapidaDTO` contendo arrays tipados com `{ id, titulo, subtitulo, tag, url }`.

### 12.2. Resumo e Histórico de Equipamentos

#### `GET /api/maquinas/{id}/resumo`
Retorna os 4 indicadores de desempenho e histórico da máquina:
- **Resposta Sucesso (200 OK)**: `MaquinaResumoDTO`:
  - `totalAtendimentos`: Quantidade total de OS registradas para a máquina;
  - `ultimaManutencaoData`: Data e hora da última entrada;
  - `ultimaOsNumero`: Número da última OS atendida;
  - `ultimaOsProblema`: Defeito relatado no último atendimento;
  - `ultimaOsStatus`: Status da última OS;
  - `valorAcumulado`: Soma estrita de `valorTotal` apenas de Ordens com status `CONCLUIDA`.

#### `GET /api/maquinas/{id}/historico`
Retorna a lista completa cronológica de Ordens de Serviço da máquina, da mais recente para a mais antiga (`ORDER BY dataEntrada DESC`):
- **Resposta Sucesso (200 OK)**: Lista de `OrdemServicoResponseDTO` isolada exclusivamente para a máquina solicitada.

### 12.3. Resumo e Histórico do Cliente

#### `GET /api/clientes/{id}/resumo`
Retorna o resumo operacional do cliente:
- **Resposta Sucesso (200 OK)**: `ClienteResumoDTO`:
  - `quantidadeEquipamentos`: Total de equipamentos cadastrados pertencentes ao cliente;
  - `quantidadeTotalOs`: Total de OS de todos os equipamentos do cliente;
  - `quantidadeOsAbertas`: Total de OS em andamento (status != `CONCLUIDA` e != `CANCELADA`);
  - `ultimaVisitaData`: Data da OS mais recente do cliente;
  - `ultimaOsNumero`: Número da OS mais recente;
  - `valorAcumulado`: Soma estrita de `valorTotal` de OS concluídas do cliente.

#### `GET /api/clientes/{id}/historico`
Retorna todas as Ordens de Serviço de todos os equipamentos do cliente ordenadas por data decrescente:
- **Resposta Sucesso (200 OK)**: Lista de `OrdemServicoResponseDTO` isolada exclusivamente para o cliente solicitado.

---

## 13. Endpoints da Fase 8 (Impressão, PDF de OS e Relatórios)

### 13.1. Geração de PDF Oficial da Ordem de Serviço

#### `GET /api/ordens-servico/{id}/pdf`
Gera o documento vetorial A4 para impressão e entrega ao cliente:
- **Content-Type**: `application/pdf`
- **Headers**: `Content-Disposition: inline; filename=OS-{numeroOs}.pdf`
- **Conteúdo**:
  - Cabeçalho institucional da oficina especializada (Soldas & Geradores);
  - Identificação completa da OS (Número, Data de Entrada, Data de Conclusão, Horímetro);
  - Dados do Cliente (Nome, CPF/CNPJ formatado, Telefone formatado);
  - Dados do Equipamento (Tipo, Marca, Modelo, Número de Série);
  - Informações Técnicas (Problema Relatado, Diagnóstico Técnico, Solução Aplicada, Testes de Bancada);
  - Tabela de Peças e Componentes com 6 colunas (Item, Código, Descrição, Qtd, Preço Histórico Congelado, Subtotal);
  - Totalizadores Financeiros (Mão de Obra, Peças, Desconto, Valor Total Líquido);
  - Badge visual de Status (destaque em vermelho para Ordens Canceladas sem apagar histórico);
  - Termos de garantia (90 dias legais) e campos de assinatura formal (Cliente e Responsável Técnico).

---

### 13.2. Módulo de Relatórios Operacionais e Gerenciais

#### `GET /api/relatorios/ordens-servico`
Relatório analítico e sintético de ordens de serviço por período:
- **Query Params**:
  - `dataInicio` (OffsetDateTime, opcional): Início do período.
  - `dataFim` (OffsetDateTime, opcional): Fim do período.
  - `status` (StatusOrdemServico, opcional): Filtrar por status específico.
  - `page`, `size`: Paginação padrão.
- **Resposta Sucesso (200 OK)**: `RelatorioOsResponseDTO`:
  - `resumo`: `{ totalOs, concluidas, abertas, canceladas, valorTotalConcluidas }` (faturamento soma estritamente `CONCLUIDA`);
  - `itens`: `Page<OrdemServicoResponseDTO>` paginado.

#### `GET /api/relatorios/estoque`
Relatório de situação e controle de reposição do inventário:
- **Query Params**:
  - `categoriaId` (Long, opcional): Filtrar por categoria.
  - `fornecedorId` (Long, opcional): Filtrar por fornecedor.
  - `estoqueBaixo` (Boolean, opcional): Apenas produtos com saldo atual <= estoque mínimo.
  - `zerado` (Boolean, opcional): Apenas produtos com saldo atual <= 0.
  - `page`, `size`: Paginação padrão.
- **Resposta Sucesso (200 OK)**: `Page<RelatorioEstoqueItemDTO>` com status de estoque calculado (`NORMAL`, `BAIXO`, `ZERADO`).

#### `GET /api/relatorios/movimentacoes`
Histórico detalhado e auditoria de movimentações de estoque:
- **Query Params**:
  - `dataInicio` (OffsetDateTime, opcional);
  - `dataFim` (OffsetDateTime, opcional);
  - `produtoId` (Long, opcional);
  - `tipo` (TipoMovimentacaoEstoque, opcional);
  - `numeroOs` (String, opcional);
  - `page`, `size`: Paginação padrão.
- **Resposta Sucesso (200 OK)**: `Page<EstoqueMovimentacaoResponseDTO>`.

#### `GET /api/relatorios/pecas-mais-utilizadas`
Ranking decrescente de peças e componentes mais aplicados em ordens de serviço:
- **Query Params**: `page`, `size` (padrão size=20).
- **Resposta Sucesso (200 OK)**: `Page<PecaMaisUtilizadaDTO>` contendo `{ produtoId, codigo, nome, marca, quantidadeTotalUtilizada, quantidadeOs }`.

#### `GET /api/relatorios/clientes`
Relatório consolidado de carteira de clientes com histórico e faturamento acumulado:
- **Query Params**: `page`, `size` (padrão size=20).
- **Resposta Sucesso (200 OK)**: `Page<RelatorioClienteItemDTO>` contendo `{ clienteId, nomeRazaoSocial, cpfCnpj, telefone, quantidadeEquipamentos, quantidadeOs, ultimaVisita, valorAcumulado }` (faturamento estritamente de ordens `CONCLUIDA`).

#### `GET /api/relatorios/equipamentos`
Relatório consolidado de equipamentos atendidos na oficina:
- **Query Params**: `page`, `size` (padrão size=20).
- **Resposta Sucesso (200 OK)**: `Page<RelatorioMaquinaItemDTO>` contendo `{ maquinaId, clienteNome, tipo, marca, modelo, numeroSerie, quantidadeOs, ultimaManutencao, valorAcumulado }`.

---

## 14. Atualizações e Contratos da Versão 1.1

A Versão 1.1 introduz melhorias operacionais mantendo compatibilidade total com os contratos da V1.0 e 0 migrations de banco de dados.

### 14.1. Normalização e Validação do Horímetro (BUG-002)
- **Endpoints impactados**:
  - `POST /api/ordens-servico` e `PUT /api/ordens-servico/{id}`
  - `POST /api/maquinas` e `PUT /api/maquinas/{id}`
- **Regras de Processamento de Horímetro**:
  - O campo continua tipado como `BigDecimal` no DTO e persistência.
  - No frontend e backend, strings de entrada com espaços (`120 , 5`), formatos com vírgula (`120,5`), ponto (`120.5`) ou espaços periféricos (` 120.5 `) são sanitizados: espaços removidos, vírgula convertida para ponto.
  - Validação estrita de formato numérico regex `^-?\\d+(\\.\\d+)?$`. Valores não numéricos (`abc`, `..`, `12,3,4`) são rejeitados com `400 Bad Request` ("O horímetro informado é inválido.").
  - Validação de valor negativo: valores `< 0` são rejeitados com `400 Bad Request` ("O horímetro não pode ser negativo.").

### 14.2. Consulta de Ordens de Serviço "Prontas para Retirada" (FEATURE-003)
- **Endpoint**: `GET /api/ordens-servico`
- **Query Param**: `status=PRONTA`
- **Comportamento**: Retorna exclusivamente ordens com o status `PRONTA`, viabilizando o atalho rápido do dashboard e a aba de visualização dedicada no balcão da oficina.

### 14.3. Validação Estrita de Testes de Bancada para Transição `PRONTA` (FEATURE-002)
- **Endpoint**: `PATCH /api/ordens-servico/{id}/status`
- **Regra de Negócio**: Quando `novoStatus = PRONTA`, o corpo deve conter `testesRealizados` preenchido. Caso esteja vazio ou em branco, a API rejeita com `400 Bad Request` ("Para marcar a ordem de serviço como PRONTA, é obrigatório registrar os testes realizados em bancada."). O frontend oferece presets rápidos para Solda e Gerador, exigindo revisão manual do operador.

### 14.4. Integração de Comunicação com Cliente via Link WhatsApp (FEATURE-001)
- **Arquitetura**: Execução 100% no frontend (`wa.me`), sem consumo de APIs externas pagas e sem persistência em banco.
- **Formato da URL**: `https://wa.me/55[DDD][NUMERO]?text=[MENSAGEM_CODIFICADA]`
- **Regras**: Normalização para DDI 55 com validação de dígitos telefônicos e sanitização contra injeção de caracteres maliciosos.

### 14.5. Exportação de Relatórios em Formato CSV (FEATURE-004)
- **Arquitetura**: Client-side stream/blob export a partir dos dados já consumidos dos endpoints de relatórios (`/api/relatorios/*`).
- **Especificação**: Delimitador `;`, RFC 4180 (aspas duplicadas `""`), quebra `\r\n`, UTF-8 com BOM (`\uFEFF`) para compatibilidade perfeita com Microsoft Excel e Bloco de Notas, respeitando rigorosamente os filtros aplicados pelo usuário em tela.






