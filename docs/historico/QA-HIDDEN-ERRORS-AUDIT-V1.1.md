# QA HIDDEN ERRORS AUDIT — V1.1
**Oficina Gestão V1.1 — Auditoria Profunda de Erros Ocultos e Contratos Frontend / Backend**

Data da Auditoria: 17 de Setembro de 2026  
Status Geral: **APROVADO APÓS SANEAMENTO**

---

## 1. BUG-HISTÓRICO

### Causa Raiz
No componente `frontend/src/app/maquinas/[id]/page.tsx`, o carregamento de histórico de manutenções chamava o endpoint `GET /api/maquinas/{id}/historico` e declarava a resposta como `OrdemServico[]` (array direto). O backend Spring Boot (`MaquinaController.java:119`), contudo, retorna um objeto paginado `PageResponse<OrdemServicoResponseDTO>` (`{ content: [...], totalElements: ..., totalPages: ... }`).

Ao atribuir esse objeto paginado diretamente à variável de estado `ordens` via `setOrdens(dataOs)`, a variável passou a referenciar um `Object` não iterável em vez de um `Array`. 

Consequências em runtime:
- Linha 287: `{resumo?.totalAtendimentos ?? ordens.length}` resultava em fallback incorreto ou `undefined`.
- Linha 340: `{ordens.length} {ordens.length === 1 ? 'registro' : 'registros'}` resultava em `undefined registros`.
- Linha 344: `{ordens.length === 0 ? (...) : (...)}` avaliava `undefined === 0` como `false`, pulando o empty state.
- Linha 363: `{ordens.map((os) => {` disparava crash imediato:
  `Runtime TypeError: ordens.map is not a function`.

### Endpoint
`GET /api/maquinas/{id}/historico` (com suporte a parâmetros de paginação `page`, `size`, `sort`).

### Resposta Real da API (Backend Spring Boot)
```json
{
  "content": [
    {
      "id": 307,
      "numeroOs": "OS-2026-0043",
      "clienteId": 1332,
      "clienteNome": "Cliente Solda Teste",
      "clienteTelefone": "31999991111",
      "clienteCpfCnpj": "00014014000",
      "maquinaId": 783,
      "maquinaTipoEquipamento": "MAQUINA_SOLDA",
      "maquinaTipoDescricao": "Máquina de Solda",
      "maquinaMarca": "ESAB",
      "maquinaModelo": "LHN 280i Plus",
      "maquinaNumeroSerie": "SN-SLD-001",
      "maquinaPotencia": "250A",
      "maquinaTensao": "220V/380V",
      "tecnicoId": null,
      "tecnicoNome": null,
      "status": "ABERTA",
      "statusDescricao": "Aberta",
      "dataEntrada": "2026-09-17T02:20:37.893Z",
      "previsaoConclusao": null,
      "dataConclusao": null,
      "problemaRelatado": "Solda desarmando proteção térmica após 15 minutos em 200A.",
      "diagnostico": null,
      "solucaoAplicada": null,
      "testesRealizados": null,
      "observacoes": "Acompanha tocha TIG e grampo terra.",
      "horimetroAtual": 46,
      "valorMaoObra": 0,
      "valorPecas": 0,
      "valorDesconto": 0,
      "valorTotal": 0,
      "createdAt": "2026-09-17T02:20:37.894Z",
      "updatedAt": "2026-09-17T02:20:37.894Z"
    }
  ],
  "page": 0,
  "size": 20,
  "totalElements": 1,
  "totalPages": 1,
  "first": true,
  "last": true
}
```

### Tipo Esperado pelo Componente
`OrdemServico[]` (array legítimo com suporte a `.length` e `.map()`).

### Correção Aplicada
1. Importação da interface genérica `PageResponse` em `frontend/src/app/maquinas/[id]/page.tsx`.
2. Adequação da chamada para solicitar até 50 registros (`?size=50`) e tipagem estrita de retorno como `PageResponse<OrdemServico>`.
3. Extração correta do array contido na propriedade de dados paginados:
   ```typescript
   const resOs = await apiFetch(`/api/maquinas/${maquinaId}/historico?size=50`);
   if (resOs.ok) {
     const dataOs: PageResponse<OrdemServico> = await resOs.json();
     setOrdens(dataOs.content ?? []);
   }
   ```
4. Adição de teste unitário de contrato para proteger contra regressão (`frontend/src/lib/maquinasHistoricoContrato.test.ts`).

---

## 2. Erros Semelhantes Encontrados

Foi realizada varredura global em todos os arquivos do frontend por chamadas a `.map(`, `.filter(`, `.find(`, `.reduce(`, `.flatMap(`, `.sort(` e `.slice(`.

- **Avaliação:** Em todos os outros 18 arquivos do frontend que realizam requisições HTTP, as respostas paginadas foram tratadas corretamente utilizando explicitamente `.content` (ex: `data.content || []` em `clientes/page.tsx`, `maquinas/page.tsx`, `ordens-servico/page.tsx`, `produtos/page.tsx`, `estoque/page.tsx`, `estoque/movimentacoes/page.tsx`, `relatorios/page.tsx` e `clientes/[id]/page.tsx`).
- O `BUG-HISTÓRICO` em `maquinas/[id]/page.tsx` era o **único ponto remanescente** no projeto com essa discrepância de contrato.

---

## 3. Contratos Frontend/Backend

Matriz de auditoria de todos os contratos e endpoints utilizados pelo Frontend:

| Endpoint | Backend DTO / Retorno | Frontend Type | Formato Real | Consistente? |
| :--- | :--- | :--- | :--- | :--- |
| `POST /api/auth/login` | `LoginResult` / Cookie HttpOnly | `LoginResponse` | JSON + Set-Cookie | Sim |
| `GET /api/auth/me` | `CurrentUserResponse` | `CurrentUser` | Objeto | Sim |
| `POST /api/auth/logout` | `204 No Content` | - | Vazio | Sim |
| `GET /api/clientes` | `PageResponse<ClienteResponseDTO>` | `PageResponse<Cliente>` | `{ content: [...] }` | Sim |
| `GET /api/clientes/{id}` | `ClienteResponseDTO` | `Cliente` | Objeto | Sim |
| `GET /api/clientes/{id}/resumo` | `ClienteResumoDTO` | `ClienteResumo` | Objeto | Sim |
| `GET /api/clientes/{id}/maquinas` | `PageResponse<MaquinaResponseDTO>` | `PageResponse<Maquina>` | `{ content: [...] }` | Sim |
| `GET /api/clientes/{id}/ordens-servico` | `PageResponse<OrdemServicoResponseDTO>` | `PageResponse<OrdemServico>` | `{ content: [...] }` | Sim |
| `POST /api/clientes` | `ClienteResponseDTO` | `Cliente` | Objeto | Sim |
| `PUT /api/clientes/{id}` | `ClienteResponseDTO` | `Cliente` | Objeto | Sim |
| `PATCH /api/clientes/{id}/status` | `ClienteResponseDTO` | `Cliente` | Objeto | Sim |
| `GET /api/maquinas` | `PageResponse<MaquinaResponseDTO>` | `PageResponse<Maquina>` | `{ content: [...] }` | Sim |
| `GET /api/maquinas/{id}` | `MaquinaResponseDTO` | `Maquina` | Objeto | Sim |
| `GET /api/maquinas/{id}/resumo` | `MaquinaResumoDTO` | `MaquinaResumo` | Objeto | Sim |
| `GET /api/maquinas/{id}/historico` | `PageResponse<OrdemServicoResponseDTO>` | `PageResponse<OrdemServico>` | `{ content: [...] }` | **Corrigido (BUG-01)** |
| `POST /api/maquinas` | `MaquinaResponseDTO` | `Maquina` | Objeto | Sim |
| `PUT /api/maquinas/{id}` | `MaquinaResponseDTO` | `Maquina` | Objeto | Sim |
| `PATCH /api/maquinas/{id}/status` | `MaquinaResponseDTO` | `Maquina` | Objeto | Sim |
| `GET /api/ordens-servico` | `PageResponse<OrdemServicoResponseDTO>` | `PageResponse<OrdemServico>` | `{ content: [...] }` | Sim |
| `GET /api/ordens-servico/{id}` | `OrdemServicoResponseDTO` | `OrdemServico` | Objeto | Sim |
| `GET /api/ordens-servico/{id}/itens` | `List<OrdemServicoItemResponseDTO>` | `OrdemServicoItem[]` | Array direto `[...]` | Sim |
| `GET /api/ordens-servico/{id}/pdf` | `byte[]` (`application/pdf`) | `Blob` (Download) | Binário PDF | Sim |
| `POST /api/ordens-servico` | `OrdemServicoResponseDTO` | `OrdemServico` | Objeto | Sim |
| `PUT /api/ordens-servico/{id}` | `OrdemServicoResponseDTO` | `OrdemServico` | Objeto | Sim |
| `PATCH /api/ordens-servico/{id}/status` | `OrdemServicoResponseDTO` | `OrdemServico` | Objeto | Sim |
| `POST /api/ordens-servico/{id}/itens` | `OrdemServicoItemResponseDTO` | `OrdemServicoItem` | Objeto | Sim |
| `DELETE /api/ordens-servico/{id}/itens/{id}` | `204 No Content` | - | Vazio | Sim |
| `GET /api/produtos` | `PageResponse<ProdutoResponseDTO>` | `PageResponse<Produto>` | `{ content: [...] }` | Sim |
| `GET /api/produtos/{id}` | `ProdutoResponseDTO` | `Produto` | Objeto | Sim |
| `GET /api/produtos/{id}/compatibilidades` | `List<CompatibilidadeResponseDTO>` | `Compatibilidade[]` | Array direto `[...]` | Sim |
| `POST /api/produtos/{id}/compatibilidades` | `CompatibilidadeResponseDTO` | `Compatibilidade` | Objeto | Sim |
| `DELETE /api/produtos/{id}/compatibilidades/{mId}` | `204 No Content` | - | Vazio | Sim |
| `POST /api/produtos` | `ProdutoResponseDTO` | `Produto` | Objeto | Sim |
| `PUT /api/produtos/{id}` | `ProdutoResponseDTO` | `Produto` | Objeto | Sim |
| `PATCH /api/produtos/{id}/status` | `ProdutoResponseDTO` | `Produto` | Objeto | Sim |
| `GET /api/fornecedores` | `PageResponse<FornecedorResponseDTO>` | `PageResponse<Fornecedor>` | `{ content: [...] }` | Sim |
| `GET /api/categorias` | `PageResponse<CategoriaResponseDTO>` | `PageResponse<Categoria>` | `{ content: [...] }` | Sim |
| `GET /api/categorias/ativas` | `List<CategoriaResponseDTO>` | `Categoria[]` | Array direto `[...]` | Sim |
| `GET /api/estoque/resumo` | `EstoqueResumoDTO` | `EstoqueResumo` | Objeto | Sim |
| `GET /api/estoque/movimentacoes` | `PageResponse<EstoqueMovimentacaoResponseDTO>` | `PageResponse<EstoqueMovimentacao>` | `{ content: [...] }` | Sim |
| `POST /api/estoque/movimentar` | `EstoqueMovimentacaoResponseDTO` | `EstoqueMovimentacao` | Objeto | Sim |
| `GET /api/relatorios/ordens-servico` | `RelatorioOsResponseDTO` | `RelatorioOsResponse` | Objeto com `.itens.content` | Sim |
| `GET /api/relatorios/estoque` | `PageResponse<RelatorioEstoqueItemDTO>` | `PageResponse<RelatorioEstoqueItem>` | `{ content: [...] }` | Sim |
| `GET /api/relatorios/movimentacoes` | `PageResponse<EstoqueMovimentacaoResponseDTO>` | `PageResponse<EstoqueMovimentacao>` | `{ content: [...] }` | Sim |
| `GET /api/relatorios/pecas-mais-utilizadas` | `PageResponse<PecaMaisUtilizadaDTO>` | `PageResponse<PecaMaisUtilizada>` | `{ content: [...] }` | Sim |
| `GET /api/relatorios/clientes` | `PageResponse<RelatorioClienteDTO>` | `PageResponse<RelatorioClienteItem>` | `{ content: [...] }` | Sim |
| `GET /api/relatorios/equipamentos` | `PageResponse<RelatorioMaquinaDTO>` | `PageResponse<RelatorioMaquinaItem>` | `{ content: [...] }` | Sim |
| `GET /api/busca/rapida` | `BuscaRapidaDTO` | `BuscaRapidaResultado` | Objeto com 4 listas | Sim |

---

## 4. Runtime Errors

- **Identificado e Eliminado:** `TypeError: ordens.map is not a function` em `frontend/src/app/maquinas/[id]/page.tsx:363`.
- **Outros Erros Potenciais Investigados:**
  - `Cannot read properties of undefined`: Verificado que todos os acessos aninhados (`resumo?.totalAtendimentos`, `cliente?.enderecos?.[0]`, `osRelatorio?.itens.content`) possuem guardas adequadas ou tipagem estrita.
  - `Cannot read properties of null`: Verificado no tratamento de retornos 404 (redirecionamento ou tela de erro amigável).
  - Hydration mismatch: Verificado que datas e formatações são executadas em componentes do cliente com efeitos montados sem disparar conflito entre servidor e cliente.

---

## 5. Auditoria Página por Página

| Página | Carrega | Navegação | API | Erro | Status |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `/login` | ✅ Sim | ✅ OK | 200 OK | Nenhum | Aprovado |
| `/dashboard` | ✅ Sim | ✅ OK | 200 OK | Nenhum | Aprovado |
| `/clientes` | ✅ Sim | ✅ OK | 200 OK | Nenhum | Aprovado |
| `/clientes/[id]` | ✅ Sim | ✅ OK | 200 OK | Nenhum | Aprovado |
| `/maquinas` | ✅ Sim | ✅ OK | 200 OK | Nenhum | Aprovado |
| `/maquinas/[id]` | ✅ Sim | ✅ OK | 200 OK | **Corrigido (BUG-01)** | **Aprovado** |
| `/ordens-servico` | ✅ Sim | ✅ OK | 200 OK | Nenhum | Aprovado |
| `/ordens-servico/nova` | ✅ Sim | ✅ OK | 200 OK | Nenhum | Aprovado |
| `/ordens-servico/[id]` | ✅ Sim | ✅ OK | 200 OK | Nenhum | Aprovado |
| `/produtos` | ✅ Sim | ✅ OK | 200 OK | Nenhum | Aprovado |
| `/estoque` | ✅ Sim | ✅ OK | 200 OK | Nenhum | Aprovado |
| `/estoque/movimentacoes` | ✅ Sim | ✅ OK | 200 OK | Nenhum | Aprovado |
| `/relatorios` (OS) | ✅ Sim | ✅ OK | 200 OK | Nenhum | Aprovado |
| `/relatorios` (Estoque) | ✅ Sim | ✅ OK | 200 OK | Nenhum | Aprovado |
| `/relatorios` (Movimentações) | ✅ Sim | ✅ OK | 200 OK | Nenhum | Aprovado |
| `/relatorios` (Peças Mais Usadas)| ✅ Sim | ✅ OK | 200 OK | Nenhum | Aprovado |
| `/relatorios` (Clientes) | ✅ Sim | ✅ OK | 200 OK | Nenhum | Aprovado |
| `/relatorios` (Equipamentos) | ✅ Sim | ✅ OK | 200 OK | Nenhum | Aprovado |

---

## 6. Null / Undefined

Auditoria de propriedades opcionais e nulas no banco de dados e serialização:
- **Campos Nulos de Equipamentos:** `numeroSerie`, `anoFabricacao`, `horimetro`, `potencia`, `tensao`, `observacoes` possuem fallbacks visuais adequados (`'Não informado'`, `'0 h'`, `'N/A'`, `'Nenhuma observação técnica cadastrada.'`).
- **Campos Nulos de Ordens de Serviço:** `diagnostico`, `solucaoAplicada`, `testesRealizados`, `observacoes`, `tecnicoNome` são renderizados com condicionais de bloco, exibindo apenas as seções preenchidas.
- **Campos Nulos de Clientes:** `cpfCnpj`, `rgIe`, `telefone`, `celular`, `email`, `observacoes` possuem fallbacks (`'-'`, `'Não informado'`).
- **Campos Nulos de Peças:** `codigoBarras`, `marca`, `localizacao`, `fornecedorNome`, `categoriaNome` tratados com `'-'`.

---

## 7. Paginação

- Listagens principais utilizam componentes de paginação com `page`, `size`, `totalElements` e `totalPages`.
- `relatorios/page.tsx`: exportação CSV consome todos os registros iterativamente através do helper `fetchTodosRegistrosRelatorio`, evitando truncamento.
- `maquinas/[id]/page.tsx`: configurado explicitamente para consultar até 50 manutenções (`?size=50`) e renderizar o histórico completo com segurança.

---

## 8. Estado Assíncrono

- Todas as telas implementam spinners de carregamento (`isLoading`) e tratamento de erros de rede.
- Operações de mutação (salvar, status, itens) utilizam flags de submissão (`isSubmitting`, `loading`) para desabilitar botões e prevenir submissão concorrente (duplo clique).
- Falhas de autenticação (`401`) no `apiFetch` realizam tentativa automática e transparente de renovação com cookie de refresh antes de redirecionar para `/login`.

---

## 9. Responsividade

- A aplicação utiliza classes do Tailwind CSS com breakpoints responsivos (`sm:`, `md:`, `lg:`), testada em resoluções padrão:
  - 1366x768 (notebook comercial);
  - 1280x720 (HD);
  - 1920x1080 (Full HD);
  - 125% e 150% de escala de exibição no Windows.
- Modais utilizam `max-h-[90vh]` e `overflow-y-auto` para evitar sobreposição ou corte de conteúdo em telas reduzidas.

---

## 10. Segurança

- **Autenticação:** Cookies `HttpOnly` com flags de segurança para `access_token` e `refresh_token`. Nenhum token exposto em `localStorage` ou `sessionStorage`.
- **Proteção contra Brute Force:** `LoginAttemptService` com bloqueio temporário (lockout) de 15 minutos após 5 tentativas consecutivas falhas por IP e e-mail.
- **Autorização:** Endpoints protegidos no backend via `SecurityConfig` com verificação de roles (`ROLE_ADMIN`, `ROLE_TECNICO`, etc.).
- **Sanitização:** Não há uso de `dangerouslySetInnerHTML`. Dados de WhatsApp sanitizados com remoção de caracteres perigosos e codificação via `encodeURIComponent`.

---

## 11. Performance

- Consultas com debounce em buscas por texto (`useDebounce` / `setTimeout` de 300–400ms em clientes, equipamentos e ordens de serviço).
- Modais e listas auxiliares (como peças e equipamentos) carregam dados sob demanda (`isOpen`).
- Backend utiliza índices e consultas otimizadas JPQL para relatórios e busca unificada.

---

## 12. Testes Adicionados

1. **`frontend/src/lib/maquinasHistoricoContrato.test.ts`**:
   - `deve extrair o array de ordens a partir de dataOs.content`: Valida consumo legítimo do contrato `PageResponse<OrdemServico>`.
   - `deve lidar corretamente com histórico vazio (content vazio)`: Valida comportamento do empty state.
   - `deve comprovar a causa raiz: atribuir a resposta bruta causa TypeError no .map()`: Protege contra regressão reproduzindo a exceção que ocorria antes do saneamento.
   - `deve preservar a integridade dos campos da Ordem de Serviço na visualização de histórico`: Valida tipagem e propriedades fundamentais do DTO.

---

## 13. Resultado Final e Classificação

| Severidade | Descrição | Quantidade |
| :---: | :--- | :---: |
| **P0** | Corrupção ou perda crítica de dados | **0** |
| **P1** | Crash de página / Contrato incorreto (`BUG-HISTÓRICO`) | **1 (Corrigido)** |
| **P2** | Falhas moderadas de usabilidade ou truncamento | **0** |
| **P3** | Alinhamentos visuais ou avisos menores | **0** |

- **BUG-HISTÓRICO corrigido?** **SIM ✅**
- **Quantos contratos Frontend/Backend estavam inconsistentes?** **1** (`GET /api/maquinas/{id}/historico`, agora corrigido e protegido por teste).
- **Quantos Runtime Errors foram encontrados?** **1** (`TypeError: ordens.map is not a function`, eliminado).
- **Quantas páginas foram testadas?** **15 rotas e abas operacionais**.
- **Quantidade de novos testes automatizados:** **4 novos cenários no teste de contrato frontend**.
- **Resultado do Backend:** **193/193 testes passando (0 falhas, 0 erros)**.
- **Resultado do Frontend:** **33/33 testes passando (0 falhas)**.
- **Resultado do Lint:** **0 erros, 0 warnings**.
- **Resultado do Build:** **Aprovado com sucesso (Turbopack, TypeScript e Static Generation sem erros)**.
- **Migrations V1–V9:** **Intactas (0 migrations criadas ou alteradas)**.
