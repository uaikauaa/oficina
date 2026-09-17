# HOMOLOGAÇÃO FUNCIONAL FINAL — V1.1
## Oficina Gestão — Relatório de Homologação Funcional & Smoke Test E2E

**Data de Execução:** 16 de Setembro de 2026  
**Responsável:** Antigravity AI — Engenheiro de QA & Confiabilidade de Sistemas  
**Versão do Sistema:** Oficina Gestão V1.1  
**Status da Homologação:** **REPROVADO** (Identificadas falhas críticas P1 em ambiente integrado com PostgreSQL Neon)

---

## 1. Ambiente

Todos os testes de homologação funcional e smoke test de ponta a ponta (E2E) foram executados com os serviços reais em execução local e conectados ao banco de dados em nuvem:

| Componente | Especificação Técnica / Versão |
| :--- | :--- |
| **Sistema Operacional** | Windows 11 Pro 64-bit |
| **Backend Runtime** | Java 21 (Eclipse Temurin 21.0.12.1-tem) |
| **Backend Framework** | Spring Boot 3.4.3 (Spring Data JPA, Hibernate 6.6.8, Spring Security 6.2) |
| **Banco de Dados** | PostgreSQL 18.6 (Hospedado no Neon Serverless, região AWS sa-east-1) |
| **Frontend Runtime** | Node.js v24.21.0 / npm 11.1.0 |
| **Frontend Framework** | Next.js 16.3.5 (App Router, Turbopack, React 19, TypeScript 5, Tailwind CSS) |
| **Navegadores de Teste** | Google Chrome 128+ / Chromium Engine & HTTP/2 E2E Client |
| **Branch Git** | `main` |
| **Commit Base** | `2d08b1d` (*fix(qa): saneamento das issues ISSUE-001 a ISSUE-006 do QA Master 2.0 (V1.1)*) |
| **Estado das Migrations**| Flyway V1 até V9 aplicadas e validadas integralmente no Neon |

---

## 2. Dados Utilizados

Para garantir a rastreabilidade e evitar interferência em dados preexistentes, foram utilizados dados sintéticos e controlados de teste, marcados explicitamente com o identificador de homologação:

* **Conta de Operador Administrativo:**
  * E-mail: `admin@oficina.com`
  * Perfil: `ADMIN` / Autenticação JWT via Cookie `HttpOnly; SameSite=Strict`
* **Cliente A (Pessoa Física):**
  * Nome: `João da Silva Santos Homologação [timestamp]`
  * CPF: `91947640447` (Válido / Sintético)
  * Telefone / Celular: `11958820872` (Sintético único)
  * Endereço: Avenida Paulista, 1000, Apto 101, Bela Vista, São Paulo/SP, CEP 01310-100
* **Cliente B (Pessoa Jurídica):**
  * Razão Social: `Metalúrgica Brasil Peças e Soldas LTDA [timestamp]`
  * Nome Fantasia: `Metalúrgica Brasil`
  * CNPJ: `48291048000192` (Válido / Sintético)
  * Endereço: Avenida das Nações Unidas, 12901, Brooklin, São Paulo/SP, CEP 04578-000
* **Equipamento A (Vinculado ao Cliente A):**
  * Tipo: `MAQUINA_SOLDA` (Máquina de Solda)
  * Marca / Modelo: `Esab Smashweld 277X`
  * Número de Série: `SN-ESAB-[timestamp]`
  * Tensão / Potência / Horímetro: `220V` / `250A` / `120.5 h`
* **Equipamento B (Vinculado ao Cliente B):**
  * Tipo: `GERADOR_ENERGIA` (Gerador de Energia)
  * Marca / Modelo: `Toyama TG3100`
  * Número de Série: `SN-TOYAMA-[timestamp]`
  * Tensão / Potência / Horímetro: `110V/220V` / `3.1kVA` / `45.0 h`
* **Fornecedor:**
  * Razão Social: `Fornecedor Componentes Técnicos LTDA`
  * CNPJ: `98700019283741`
* **Produto A:**
  * Código / Nome: `IGBT-[timestamp]` / `Módulo IGBT 1200V 50A Homologação`
  * Custo / Venda: `R$ 50,00` / `R$ 100,00`
  * Estoque Inicial Conhecido: `10 UN`
  * Estoque Mínimo: `5 UN`

---

## 3. Smoke Test

O fluxo funcional percorreu a sequência exata de operações previstas no roteiro de homologação:

```
LOGIN
  ↓
DASHBOARD
  ↓
CRIAR CLIENTE A & B
  ↓
CRIAR EQUIPAMENTO A & B
  ↓
TESTE DE INTEGRIDADE CLIENTE/EQUIPAMENTO
  ↓
CRIAR PRODUTO A & FORNECEDOR
  ↓
MOVIMENTAÇÃO DE ESTOQUE (ENTRADA +10, SAÍDA -3, AJUSTE)
  ↓
ABRIR ORDEM DE SERVIÇO (OS PRINCIPAL)
  ↓
ADICIONAR PEÇAS NA OS (2 UN PRODUTO A) & MÃO DE OBRA
  ↓
VALIDAR BAIXA DO ESTOQUE & PREÇO HISTÓRICO CONGELADO
  ↓
REGISTRAR DIAGNÓSTICO E SOLUÇÃO
  ↓
TRANSIÇÃO PARA PRONTA (TESTE DE LAUDO DE BANCADA)
  ↓
GERAÇÃO DE URL PARA WHATSAPP
  ↓
TRANSIÇÃO PARA CONCLUÍDA & TESTE DE IMUTABILIDADE
  ↓
EMISSÃO DE PDF VETORIAL A4
  ↓
HISTÓRICO POR CLIENTE E EQUIPAMENTO
  ↓
CANCELAMENTO DE OS SECUNDÁRIA & DEVOLUÇÃO AUTOMÁTICA
  ↓
CONSULTA AOS 6 RELATÓRIOS & EXPORTAÇÃO CSV
  ↓
BUSCA RÁPIDA (CTRL+K)
  ↓
TESTE DE CONCORRÊNCIA EM ESTOQUE
```

---

## 4. Resultado de Cada Etapa

| Etapa | Descrição da Validação | Status | Observações / Resultado Obtido |
| :--- | :--- | :---: | :--- |
| **6. Login** | Autenticação, bloqueio sem credenciais, cookie HttpOnly, logout e revogação | **APROVADO** | Cookie emitido corretamente com flags de segurança. Tentativa incorreta retornou 401. Rate limiting ativo. |
| **7. Dashboard** | Carregamento de contadores de OS abertas, prontas e clientes | **FALHA (P1)** | Endpoint `/api/clientes?size=1` responde 200, porém `/api/ordens-servico` retorna 500 no PostgreSQL (*BUG-HOMOLOG-001*). |
| **8. Cliente** | Cadastro PF/PJ, edição, persistência e validação de duplicidade | **APROVADO** | Persistência íntegra. Validação impediu duplicidade de CPF, Telefone e Celular. |
| **9. Equipamento** | Cadastro de máquina e gerador, vínculo de cliente e inativação | **FALHA (P1)** | Cadastro e consulta operam 100%, mas a inativação via `/api/maquinas/{id}/status` falha com 409 devido à constraint de auditoria (*BUG-HOMOLOG-002*). |
| **10. Produto** | Cadastro de fornecedor e produto com estoque inicial e preços | **APROVADO** | Salvo com código único, categoria e fornecedor vinculados com sucesso. |
| **11. Estoque** | Entrada manual (+10 -> 20), saída manual (-3 -> 17) e ajuste auditado | **APROVADO** | Movimentações geram histórico e saldos matematicamente exatos. Validação rejeitou quantidade zerada conforme especificado. |
| **12. Ordem de Serviço** | Abertura de OS com cliente e equipamento válidos | **APROVADO** | OS gerada em status `ABERTA`, com número sequencial único formatado (`OS-2026-XXXX`). |
| **13. Integridade Cliente/Equipamento** | Tentativa de vincular Cliente A com Equipamento B (do Cliente B) | **APROVADO** | API rejeitou a requisição com código `400 Bad Request` e mensagem de domínio clara. |
| **14. Peças na OS** | Adição de 2 itens de Produto A (R$ 100 un) e recálculo com mão de obra | **APROVADO** | Total de peças = R$ 200,00. Estoque baixou imediatamente de 17 para 15. Total da OS recalculado perfeitamente para R$ 350,00 com mão de obra. |
| **15. Preço Histórico** | Reajuste do preço de venda do Produto A de R$ 100 para R$ 150 | **APROVADO** | O item já gravado na OS permaneceu rigidamente congelado em R$ 100,00 (Total R$ 200,00). |
| **16. Diagnóstico** | Registro e persistência de diagnóstico técnico e solução | **APROVADO** | Campos persistidos e auditados sem truncamento. |
| **17. Laudo de Bancada** | Bloqueio de PRONTA com laudo < 15 chars e máquina de estados | **APROVADO / FALHA (P1)** | Bloqueio com laudo curto funcionou (400). A transição para PRONTA respeita a máquina de estados, mas a gravação de auditoria falha no Postgres (*BUG-HOMOLOG-002*). |
| **18. Status Pronta** | Filtro de OS prontas para retirada | **BLOQUEADO** | Bloqueado em consequência da falha na gravação do status no PostgreSQL (*BUG-HOMOLOG-002*). |
| **19. WhatsApp** | Geração de link com DDI 55, telefone limpo e mensagem codificada | **APROVADO** | Link gerado no formato `https://wa.me/5511958820872?text=...`, sem envio automático indevido. |
| **20. Concluída & Imutabilidade**| Transição para CONCLUÍDA e teste de alteração posterior | **BLOQUEADO** | Bloqueado pela transição de status no PostgreSQL (*BUG-HOMOLOG-002*). |
| **21. PDF** | Emissão do documento vetorial oficial da OS | **APROVADO** | Retornou `application/pdf` (> 1000 bytes) com formatação A4 e dados históricos congelados. |
| **22. Histórico** | Consulta de histórico por cliente e por equipamento | **APROVADO** | Endpoints `/api/clientes/{id}/ordens-servico` e `/api/maquinas/{id}/ordens-servico` retornaram 200 com paginação. |
| **23. Cancelamento & Devolução** | Cancelamento de OS secundária com retorno automático de estoque | **BLOQUEADO** | Transição para CANCELADA disparou rollback por violação de constraint de auditoria (*BUG-HOMOLOG-002*). |
| **24. Relatórios** | Acesso aos 6 relatórios gerenciais | **PARCIAL (P1)** | Estoque, Peças Mais Usadas, Clientes e Equipamentos retornam 200. Relatórios de OS e Movimentações retornam 500 sem termo (*BUG-HOMOLOG-001*). |
| **25. CSV** | Exportação de dados completos em CSV | **APROVADO** | Codificação UTF-8 com BOM, delimitador ponto-e-vírgula e paginação completa (ISSUE-002 sanada). |
| **26. Busca Global** | Busca unificada (Ctrl+K) com termos acentuados | **APROVADO** | Endpoint `/api/busca/rapida?termo=João` retornou resultados agregados em 200. |
| **27. Responsividade** | Layouts em 1366x768, 1280x720 e 1440x900 | **APROVADO** | Grades fluidas, tabelas com overflow horizontal e modais contidos. |
| **28. Segurança Funcional** | Bloqueio de rotas protegidas sem sessão | **PARCIAL (P2)** | Next.js redireciona `/dashboard`, `/clientes`, `/maquinas`, `/ordens-servico` com 307. Rota `/relatorios` não está no middleware (*BUG-HOMOLOG-003*). |
| **29. Sessão** | Expiração de token JWT e comportamento do cliente | **APROVADO** | Token expirado recebe 401 e força redirecionamento limpo para o login. |
| **30. Concorrência** | Disparo de saídas simultâneas superando saldo de estoque | **APROVADO** | Transações isoladas: exatamente 1 requisição obteve sucesso (201) e a segunda foi rejeitada por saldo insuficiente (400). |
| **31. Erros de Rede** | Resposta da interface sob falha na API | **APROVADO** | Interface exibe mensagens amigáveis de erro sem travar o estado do cliente. |
| **32. Integridade Geral** | Consistência entre Banco Neon, API, Frontend e Cálculos | **FALHA (P1)** | Incompatibilidade de queries JPQL e constraints de auditoria no PostgreSQL real. |

---

## 5. Problemas Encontrados

Seguindo estritamente a diretriz: **nenhum código de produção foi alterado durante esta fase**. Os problemas foram isolados, reproduzidos e catalogados para posterior saneamento.

---

### BUG-HOMOLOG-001 — Falha SQL no PostgreSQL com Cláusula `lower(bytea)`
* **Severidade:** **P1 (Crítica)**
* **Etapa:** 7 (Dashboard), 24 (Relatórios) e Listagem Geral de Ordens de Serviço.
* **Componente:** `backend` — `OrdemServicoRepository.java` e `EstoqueMovimentacaoRepository.java`.
* **Passos para Reproduzir:**
  1. Iniciar a aplicação conectada ao PostgreSQL do Neon.
  2. Efetuar login como administrador.
  3. Enviar requisição GET sem parâmetros de filtro para `http://localhost:8080/api/ordens-servico`.
  4. Enviar requisição GET para `http://localhost:8080/api/relatorios/ordens-servico` ou `http://localhost:8080/api/relatorios/movimentacoes`.
* **Comportamento Esperado:** Retornar status HTTP 200 com a página de registros e contadores de OS.
* **Comportamento Obtido:** Retorna status HTTP 500 (Internal Server Error).
* **Evidência (Log Real do Backend):**
  ```
  org.postgresql.util.PSQLException: ERROR: function lower(bytea) does not exist
    Dica: No function matches the given name and argument types. You might need to add explicit type casts.
    Posição: 1021
    at org.hibernate.sql.results.jdbc.internal.DeferredResultSetAccess.executeQuery(DeferredResultSetAccess.java:250)
  ```
* **Causa Raiz:** A consulta JPQL utiliza `LOWER(CONCAT('%', :termo, '%'))`. Quando o parâmetro `:termo` não é fornecido na requisição (ou seja, é `null`), o driver JDBC do PostgreSQL infere o tipo do parâmetro como `bytea`, gerando erro de tipo no PostgreSQL, que não aceita `lower(bytea)`. Quando fornecido um termo de busca como `?termo=OS`, a consulta executa com sucesso (200 OK).
* **Impacto:** Impede o carregamento inicial padrão da tela de listagem de Ordens de Serviço, dos cards de contadores do Dashboard (que consultam OS abertas e prontas com `size=1`) e dos relatórios de OS e movimentações quando não filtrados.

---

### BUG-HOMOLOG-002 — Violação de Check Constraint `auditoria_acao_check` no PostgreSQL
* **Severidade:** **P1 (Crítica)**
* **Etapa:** 9 (Equipamento — Inativação), 17 (Laudo de Bancada / PRONTA), 20 (CONCLUÍDA) e 23 (Cancelamento).
* **Componente:** `backend` — `ClienteService.java` (linha 135), `MaquinaService.java` (linha 186) e `OrdemServicoService.java` (linha 287).
* **Passos para Reproduzir:**
  1. Efetuar requisição PATCH para `http://localhost:8080/api/maquinas/{id}/status` com `{ "ativo": false }`.
  2. Efetuar requisição PATCH para `http://localhost:8080/api/clientes/{id}/status` com `{ "ativo": false }`.
  3. Efetuar requisição PATCH para `http://localhost:8080/api/ordens-servico/{id}/status` alterando status para `EM_DIAGNOSTICO`, `PRONTA`, `CONCLUIDA` ou `CANCELADA`.
* **Comportamento Esperado:** Status do registro atualizado com sucesso e evento de auditoria gravado (HTTP 200).
* **Comportamento Obtido:** Transação abortada com rollback e resposta HTTP 409 (Conflict).
* **Evidência (Log Real do Backend):**
  ```
  2026-09-16T21:05:25.944-03:00 ERROR 4364 --- [oficina-gestao-backend] o.h.engine.jdbc.spi.SqlExceptionHelper : 
  ERROR: new row for relation "auditoria" violates check constraint "auditoria_acao_check"
    Detalhe: Failing row contains (87, 1, Maquina, 689, INATIVACAO, null, null, 0:0:0:0:0:0:0:1, 2026-09-17 00:05:25.916181+00).
  2026-09-16T21:05:25.965-03:00 WARN 4364 --- [oficina-gestao-backend] c.o.exception.GlobalExceptionHandler : 
  Violação de integridade de dados na rota /api/maquinas/689/status: could not execute statement
  ```
* **Causa Raiz:** Na migration V1 (`V1__create_initial_schema.sql`), a tabela `auditoria` foi criada com:
  ```sql
  acao VARCHAR(20) NOT NULL CHECK (acao IN ('INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT'))
  ```
  Porém, os serviços de negócio passam strings de ação não previstas na constraint:
  * `MaquinaService.java`: passa `"ATIVACAO"` ou `"INATIVACAO"`.
  * `ClienteService.java`: passa `"ATIVACAO"` ou `"INATIVACAO"`.
  * `OrdemServicoService.java`: passa `"STATUS_" + novoStatus.name()` (ex: `"STATUS_PRONTA"`).
* **Impacto:** Inutiliza a inativação/ativação de clientes e equipamentos e impede qualquer avanço no ciclo de vida das Ordens de Serviço em ambiente de banco de dados real.

---

### BUG-HOMOLOG-003 — Rota `/relatorios` Ausente no Middleware de Autenticação do Next.js
* **Severidade:** **P2 (Média)**
* **Etapa:** 28 (Segurança Funcional).
* **Componente:** `frontend` — `frontend/src/middleware.ts`.
* **Passos para Reproduzir:**
  1. Limpar cookies de sessão no navegador.
  2. Acessar diretamente via HTTP GET a URL `http://localhost:3000/relatorios`.
* **Comportamento Esperado:** O Next.js deve interceptar a rota via Middleware e responder com redirecionamento HTTP 307 para `/login?redirect=%2Frelatorios`.
* **Comportamento Obtido:** A rota responde com HTTP 200 e carrega a casca da página (o bloqueio só ocorre via cliente/React quando as requisições à API backend falham com 401).
* **Evidência:**
  ```javascript
  // Resposta obtida pelo teste de rotas protegidas:
  { route: '/dashboard', status: 307, location: '/login?redirect=%2Fdashboard' }
  { route: '/clientes', status: 307, location: '/login?redirect=%2Fclientes' }
  { route: '/maquinas', status: 307, location: '/login?redirect=%2Fmaquinas' }
  { route: '/ordens-servico', status: 307, location: '/login?redirect=%2Fordens-servico' }
  { route: '/relatorios', status: 200, location: null } // Ausente do matcher e do isProtectedRoute
  ```
* **Causa Raiz:** O array `matcher` e a expressão de verificação `isProtectedRoute` no arquivo `frontend/src/middleware.ts` omitiram as entradas `/relatorios` e `/relatorios/:path*`.
* **Impacto:** Usuário não autenticado consegue visualizar a casca inicial da página de relatórios antes que as chamadas da API retornem 401 no cliente.

---

## 6. Evidências

### Evidência 1: Integridade de Dados de Estoque e Preço Histórico
Durante o teste da OS Principal (`OS-2026-0033`):
* Produto A criado com `estoqueInicial = 10`, `precoVenda = R$ 100,00`.
* Entrada manual de `+10` -> Saldo auditado: `20 UN`.
* Saída manual de `-3` -> Saldo auditado: `17 UN`.
* Inclusão de `2 UN` na Ordem de Serviço -> Saldo baixado imediatamente no estoque para `15 UN`.
* Valor acumulado de peças na OS: `R$ 200,00`.
* Alteração cadastral posterior do Produto A para `R$ 150,00`:
  * Consulta imediata da OS comprovou que o valor do item permaneceu congelado em `R$ 100,00` (Total R$ 200,00), comprovando o cumprimento integral da regra de congelamento de preço histórico.

### Evidência 2: Proteção Transacional de Concorrência em Estoque
* Disparo de duas chamadas assíncronas concorrentes de saída manual de `10 UN` do Produto A quando o saldo disponível era de `15 UN` (demanda combinada de 20 UN):
  * Requisição A: HTTP 201 Created (sucesso).
  * Requisição B: HTTP 400 Bad Request (`Estoque insuficiente para a movimentação solicitada`).
  * Saldo final remanescente: `5 UN` (nenhum saldo negativo gerado, sem race conditions).

### Evidência 3: Rejeição de Vínculo Cruzado de Equipamento e Cliente
* Requisição POST para `/api/ordens-servico` com `clienteId = Cliente A` e `maquinaId = Equipamento B (do Cliente B)`:
  * Resposta: HTTP 400 Bad Request.
  * Payload retornado:
    ```json
    {
      "status": 400,
      "error": "BUSINESS_ERROR",
      "message": "O equipamento selecionado não pertence ao cliente informado."
    }
    ```

---

## 7. Regressões

Foi realizada verificação minuciosa para garantir que as 6 correções aplicadas na etapa anterior de saneamento continuam intactas:

1. **ISSUE-001 (Abertura de OS para inativos):** Regra implementada e presente no código do `OrdemServicoService.java`.
2. **ISSUE-002 (Exportação CSV multipágina):** O endpoint e a lógica de paginação contínua nos relatórios estão preservados.
3. **ISSUE-003 (Rate Limiting de Login):** Tentativas repetidas de autenticação inválida continuam protegidas contra força bruta.
4. **ISSUE-004 (JWT_SECRET seguro):** Inicialização sem fallback hardcoded validada com sucesso.
5. **ISSUE-005 (Audit Logging em Devolução):** Service de movimentação continua registrando eventos com IP e usuário.
6. **ISSUE-006 (Validação de Laudo de Bancada):** Tentativa de transição com laudo curto (`"ok"`) foi rejeitada com HTTP 400.

**Conclusão sobre regressões:** Nenhuma regressão foi introduzida no código das issues sanadas. Os problemas encontrados decorrem de diferenças entre o ambiente de testes H2 (em memória) e a semântica estrita do PostgreSQL Neon em produção.

---

## 8. Segurança

* **Autenticação:** Cookie `access_token` emitido com `HttpOnly; Secure; SameSite=Strict`.
* **Rotas da API:** Todas as rotas sob `/api/*` (exceto `/api/auth/login`) rejeitam acessos sem token com HTTP 401.
* **Rotas do Frontend:** Redirecionamento 307 ativo para as telas operacionais principais. Resguardar apenas a rota `/relatorios` no `middleware.ts` (*BUG-HOMOLOG-003*).
* **Auditoria de Acessos:** Login e logout registram IP de origem do cliente e usuário autenticado.

---

## 9. Integridade de Dados

* **Modelo Relacional:** Estrutura de chaves estrangeiras entre `clientes`, `maquinas`, `ordens_servico`, `produtos`, `fornecedores` e `estoque_movimentacoes` íntegra.
* **Matemática Financeira:**
  * $\text{Valor Total da OS} = \text{Mão de Obra} + \text{Peças} - \text{Desconto}$.
  * No teste: $150{,}00 + 200{,}00 - 0{,}00 = \text{R\$\ } 350{,}00$ validado em banco e tela.
* **Imutabilidade Histórica:** Preço de venda unitário gravado na tabela `ordens_servico_itens` preservado independentemente de mutações posteriores na tabela `produtos`.

---

## 10. Relatórios

Foram testados os 6 relatórios gerenciais da aplicação:
1. **Estoque:** HTTP 200 OK — Dados e indicadores coerentes.
2. **Peças Mais Utilizadas:** HTTP 200 OK — Agrupamento e contadores corretos.
3. **Clientes:** HTTP 200 OK — Lista e totais compatíveis.
4. **Equipamentos:** HTTP 200 OK — Registros recuperados com sucesso.
5. **Ordens de Serviço:** HTTP 500 sem filtro / HTTP 200 com termo (*BUG-HOMOLOG-001*).
6. **Movimentações de Estoque:** HTTP 500 sem filtro / HTTP 200 com termo (*BUG-HOMOLOG-001*).

---

## 11. PDF

* **Endpoint:** `GET /api/ordens-servico/{id}/pdf`
* **Formato:** `application/pdf`
* **Header Content-Disposition:** `inline; filename="OS-2026-XXXX.pdf"`
* **Validação de Conteúdo:** O PDF gerado possui mais de 1.000 bytes, layout A4 vetorial limpo, exibindo cliente, equipamento, problema, diagnóstico técnico e discriminação das peças com preços congelados.

---

## 12. CSV

* **Formato:** UTF-8 com BOM (`\uFEFF`).
* **Delimitador:** Ponto e vírgula (`;`).
* **Tratamento de Campos:** Aspas duplas em campos com caracteres especiais ou quebras de linha.
* **Paginação:** Exportação multipágina garantindo a totalidade dos registros filtrados sem truncamento na primeira página.

---

## 13. WhatsApp

* **Ação:** Clique no botão "Avisar no WhatsApp".
* **Formato da URL:** `https://wa.me/5511958820872?text=Ol%C3%A1%20...`
* **Validações:**
  * DDI 55 inserido automaticamente.
  * Sanitização de caracteres não numéricos do telefone (removidos parênteses, traços e espaços).
  * Mensagem com número da OS, modelo do equipamento e valor total codificada via URL encode.
  * **Comportamento estrito:** Abertura da URL em nova aba para revisão humana manual, sem envio autônomo.

---

## 14. Responsividade

Foram validados os layouts nas resoluções especificadas:
* **1366x768 @ 125% (Resolução comum de balcão e bancada):**
  * Sidebar colapsável funcional.
  * Dashboard exibe cards em grid adaptativo sem sobreposição de textos.
* **1280x720 (Resolução HD reduzida):**
  * Tabelas operacionais com barra de rolagem horizontal suave (`overflow-x-auto`).
  * Modais de inclusão de peça e diagnóstico permanecem centralizados com scroll interno se necessário.
* **1440x900:**
  * Aproveitamento amplo de espaço em tabelas gerenciais e relatórios.

---

## 15. Resultado Final

### STATUS: **REPROVADO**

### Justificativa Técnica:
Embora todas as regras de negócio de domínio (cálculos financeiros, baixas de estoque, concorrência, preço histórico, segurança JWT e validações técnicas de bancada) tenham demonstrado conformidade plena, a aplicação **não pode ser homologada para produção neste estado** devido a **2 defeitos de Severidade P1** identificados na camada de persistência com o **PostgreSQL real do Neon**:

1. **BUG-HOMOLOG-001 (P1):** A listagem padrão de Ordens de Serviço e os relatórios de OS e Movimentações falham com erro 500 (`function lower(bytea) does not exist`) na ausência de termo de pesquisa digitado.
2. **BUG-HOMOLOG-002 (P1):** A alteração de status de cliente/equipamento e a progressão de ciclo de vida das Ordens de Serviço disparam erro 409 (`violates check constraint "auditoria_acao_check"`), impedindo que Ordens de Serviço sejam colocadas como `PRONTA`, `CONCLUIDA` ou `CANCELADA` no banco real.

Conforme a **Regra Absoluta nº 36**, nenhuma alteração de código foi aplicada durante este ciclo de homologação. O sistema deve agora avançar para uma etapa de correção pontual autorizada para sanar os defeitos `BUG-HOMOLOG-001`, `BUG-HOMOLOG-002` e `BUG-HOMOLOG-003`.
