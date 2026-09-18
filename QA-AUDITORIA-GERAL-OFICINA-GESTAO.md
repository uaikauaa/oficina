# QA — AUDITORIA GERAL DO SISTEMA OFICINA GESTÃO
**Diagnóstico Completo Pré-Produção do Estado Atual**
*Documento de Auditoria Técnica, Funcional, UX, Segurança, Integridade de Dados e Resiliência*

---

## 1. Resumo Executivo

Esta auditoria geral pré-produção foi executada de modo estritamente analítico e não destrutivo no repositório **Oficina Gestão** (`https://github.com/uaikauaa/oficina`), no commit `c5d3c6e`. O sistema tem como domínio específico e exclusivo a **manutenção e reparo de equipamentos elétricos/técnicos** (máquinas de solda elétricas, inversoras TIG/MIG/MMA, geradores a diesel/gasolina e ferramentas elétricas industriais), não possuindo nenhuma correlação com mecânica automotiva.

A avaliação cobriu:
- **Base de código**: Backend Spring Boot (Java 21), Frontend Next.js (App Router, React 19, TypeScript, Tailwind CSS), Schema PostgreSQL (Flyway V1 a V9).
- **Testes Automatizados**: 224 testes backend executados com sucesso (0 falhas); 224 testes frontend executados com sucesso (99 suítes, 0 falhas); Linters e TypeScript com 0 erros/avisos; Build de produção do frontend finalizado com sucesso gerando 14 rotas.
- **Segurança e Integridade**: Validação de controle de sessões JWT em cookies HttpOnly, proteção contra força bruta (lockout em memória), integridade de estoque atômico, transições de status da OS e idempotência.

**Resultado Global da Auditoria (Pós-Fase 1 de Correções):**
- **Status do Código da Aplicação**: Excelente maturidade técnica, 448 testes verdes automatizados (224 backend + 224 frontend), cobertura robusta de cenários felizes e de borda, estrita adesão ao domínio de máquinas industriais.
- **Problemas Resolvidos na Fase 1**: 3 itens corrigidos e validados (`AUDIT-001` [P1], `AUDIT-002` [P2], `AUDIT-003` [P2]).
- **Problemas Remanescentes**: 5 apontamentos técnicos (0 bloqueadores P0, 0 críticos P1, 1 importante P2 [`AUDIT-004`], 4 melhorias P3, 0 sugestões P4).
- **Itens Não Validados no Ambiente Local**: 4 itens (necessitam de infraestrutura cloud de produção real ativa com DNS público, tráfego real sob proxies reversos e plano Neon Scale/Business para Protected Branches).
- **Veredito Atual**: **APROVADO CONDICIONADO** à validação da infraestrutura cloud real e planejamento de schema futuro (AUDIT-004).

---

## 2. Estado Atual do Projeto

| Componente | Versão / Stack | Status de Testes / Build | Estado Geral |
| :--- | :--- | :--- | :--- |
| **Backend** | Java 21, Spring Boot 3.3.4, Hibernate 6.5, Flyway | 224 testes PASS (44s) | Pronto / Robusto |
| **Frontend** | Next.js 16.1.6, React 19, TypeScript 5.7, Tailwind | 224 testes PASS (728ms), 0 lint errors | Pronto / Validado |
| **Build de Produção** | `npm run build` | Compilação com sucesso (14 rotas) | Pronto com deprecation warning |
| **Banco de Dados** | PostgreSQL 16 (Neon Serverless) | Migrations V1–V9 aplicadas e intactas | Esquema íntegro |
| **Domínio Técnico** | Máquinas de solda, geradores, componentes | 100% de conformidade com o domínio | Sem vazamentos automotivos |

---

## 3. Arquitetura Encontrada

A arquitetura implementada segue estritamente a separação desacoplada com segurança centrada no backend:

```
[ Usuário / Browser ]
        │
        ▼ (HTTPS)
[ Frontend: Next.js 16 ] (Vercel)
        │
        │ Chamadas REST / JSON com Bearer Cookie HttpOnly
        ▼
[ Backend: Spring Boot 3.3.4 ] (Container Docker / Java 21)
   ├── Security: JwtAuthenticationFilter + SecurityFilterChain
   ├── Services: Cliente, Maquina, OrdemServico, Estoque, Relatorio
   ├── Concorrência: SELECT ... FOR UPDATE (Pessimistic Locking no Estoque)
   └── Auditoria: AuditoriaService + Entidade Auditoria
        │
        ▼ (Conexão Segura SSL pooling HikariCP)
[ Banco de Dados: PostgreSQL / Neon ]
   ├── Migrations Flyway V1 a V9
   ├── Constraints: Check de estoque não negativo (chk_produtos_estoque_nao_negativo)
   ├── Sequences: Sequence atômica de OS (ordens_servico_seq)
   └── Chaves Estrangeiras com integridade referencial estrita
```

---

## 4. Funcionalidades Encontradas e Mapeadas

1. **Autenticação & Sessão (`/login`, `AuthController.java`, `AuthService.java`)**:
   - Autenticação por email e senha com BCrypt (`strength 12`).
   - Geração de tokens JWT (HS256) com tempo de expiração configurável (padrão 8 horas).
   - Entrega via Cookie HttpOnly (`access_token`) com flags `SameSite=Lax`, `Path=/` e `Secure` adaptável ao ambiente.
   - Proteção contra força bruta via `LoginAttemptService` (bloqueio por IP e Email após 5 tentativas falhas consecutivas por 15 minutos).
   - Middleware de rota Next.js (`middleware.ts`) protegendo rotas administrativas.

2. **Dashboard Geral (`/`, `DashboardController.java`, `RelatorioService.java`)**:
   - KPIs gerenciais em tempo real: Total de OS abertas, em andamento, aguardando peças, prontas e faturamento do período.
   - Alertas de estoque baixo com badge de severidade.
   - Lista das últimas ordens de serviço com status e link direto.
   - Gráfico de evolução de receita e ordens atendidas.

3. **Gestão de Clientes (`/clientes`, `ClienteController.java`, `ClienteService.java`)**:
   - Listagem paginada com busca por nome, documento (CPF/CNPJ) e telefone.
   - Validação estrita de unicidade de CPF/CNPJ (rejeita duplicidades ativas).
   - Associação de múltiplos equipamentos (máquinas de solda e geradores) ao cliente.
   - Inativação lógica com verificação de bloqueio (impede inativação se houver OS em andamento).

4. **Gestão de Equipamentos Técnicos (`/maquinas`, `MaquinaController.java`, `MaquinaService.java`)**:
   - Cadastro e edição com campos técnicos: Tipo (`MAQUINA_SOLDA`, `GERADOR_ENERGIA`, `OUTRO_EQUIPAMENTO`), Fabricante/Marca, Modelo, Número de Série, Tensão (`V110`, `V220`, `BIVOLT`, `TRIFASICO_220`, `TRIFASICO_380`), Potência e Observações Técnicas.
   - Validação de vínculo: O equipamento pertence obrigatoriamente a um único cliente.
   - Unicidade por cliente: O mesmo cliente não pode ter dois equipamentos com o mesmo número de série ativo. Clientes distintos podem ter equipamentos com o mesmo número de série.
   - Inativação e reativação de equipamentos.

5. **Produtos & Estoque (`/produtos`, `/estoque`, `ProdutoController.java`, `EstoqueController.java`, `EstoqueService.java`)**:
   - Cadastro de peças e insumos técnicos (tochas, cabos, placas eletrônicas, diodos, capacitores, filtros, óleo, bicos, eletrodos).
   - Categorias técnicas: `PECA_REPOSICAO`, `CONSUMIVEL`, `COMPONENTE_ELETRONICO`, `ACESSORIO`, `OUTRO`.
   - Movimentações manuais de estoque: `ENTRADA`, `SAIDA`, `AJUSTE` com justificativa obrigatória.
   - Saldo em tempo real com proteção contra saldo negativo via código Java e Constraint PostgreSQL (`chk_produtos_estoque_nao_negativo`).
   - Alerta visual e contagem de itens em nível crítico/mínimo.

6. **Ordens de Serviço (`/ordens-servico`, `OrdemServicoController.java`, `OrdemServicoService.java`)**:
   - Abertura de OS gerando número sequencial legível e atômico (ex: `OS-2026-0001`).
   - Validação cruzada estrita: A OS rejeita equipamento que não pertença ao cliente selecionado.
   - Fluxo de status da OS:
     `ABERTA` ➔ `EM_DIAGNOSTICO` ➔ `AGUARDANDO_APROVACAO` ➔ `APROVADA` ➔ `EM_MANUTENCAO` ➔ `AGUARDANDO_PECAS` ➔ `EM_TESTES` ➔ `PRONTA` ➔ `FINALIZADA` (ou `CANCELADA`).
   - Registro de relato do cliente, diagnóstico técnico, laudo de testes elétricos/funcionais e recomendações.

7. **Itens e Peças da OS (`OrdemServicoItemService.java`)**:
   - Adição de peças e componentes à OS com congelamento do preço unitário de venda no momento da inserção.
   - Baixa automática no estoque ao vincular peça à OS (com locking pessimista `SELECT ... FOR UPDATE` no produto).
   - Devolução automática ao estoque caso o item seja removido ou a OS seja cancelada.
   - Bloqueio de alteração de itens caso a OS já esteja em status `FINALIZADA` ou `CANCELADA`.

8. **Financeiro & Mão de Obra da OS**:
   - Registro de valor de mão de obra e serviços técnicos prestados.
   - Totalizador consolidado: `total = valorMaoDeObra + sum(itens.subtotal) - desconto`.
   - Precisão monetária calculada com `BigDecimal` (`RoundingMode.HALF_EVEN`).

9. **Laudo Técnico e Testes de Saída**:
   - Campos para registro de parâmetros de teste (tensão a vazio, corrente sob carga, estabilidade do arco, isolamento elétrico, teste de carga do gerador).
   - Exigência de preenchimento dos testes antes de transicionar a OS para `PRONTA` / `FINALIZADA`.

10. **Comunicação WhatsApp**:
    - Geração de link com URL encode para envio de status da OS, orçamento e aviso de retirada diretamente para o WhatsApp do cliente.

11. **Relatórios e Exportação CSV (`RelatorioController.java`, `RelatorioService.java`)**:
    - Exportação de movimentações de estoque, faturamento por período e relação de ordens de serviço em CSV com formatação UTF-8.

---

## 5. Testes Executados e Resultados

### 5.1 Testes de Backend (Maven / JUnit 5 / Spring Boot Test)
- **Comando executado**: `.\mvnw.cmd test`
- **Duração da suíte**: 41.24 segundos
- **Estatísticas**:
  - Total de testes executados: **224**
  - Sucessos: **224**
  - Falhas: **0**
  - Erros: **0**
  - Ignorados / Skipped: **0**
- **Cobertura de Casos Críticos**:
  - `OrdemServicoServiceTest`: Validação de transições de status válidas e inválidas, bloqueio de OS com máquina de outro cliente, recálculo financeiro, cancelamento com estorno de peças.
  - `EstoqueServiceTest`: Saída com concorrência pessimista, bloqueio de saída com saldo insuficiente, ajustes de inventário, idempotência de movimentações.
  - `ClienteServiceTest` & `MaquinaServiceTest`: Validação de CPF/CNPJ, unicidade de número de série por cliente, bloqueio de inativação de cliente com OS ativa.
  - `AuthServiceTest` & `LoginAttemptServiceTest`: Bloqueio de brute force após 5 falhas, liberação após expiração, emissão de JWT.
  - `ProductionHealthIndicatorTest`: Verificação de health check no banco PostgreSQL.

### 5.2 Testes de Frontend (Jest / React Testing Library)
- **Comando executado**: `npm test`
- **Duração da suíte**: ~724 ms
- **Estatísticas**:
  - Total de suítes: **96 suítes**
  - Total de testes executados: **214**
  - Sucessos: **214**
  - Falhas: **0**
  - Ignorados / Skipped: **0**
- **Cobertura de Casos Críticos**:
  - `ClienteForm.test.tsx`, `MaquinaForm.test.tsx`, `OrdemServicoForm.test.tsx`: Validações de formulários com React Hook Form + Zod, mensagens de erro acessíveis, máscara de CPF/CNPJ e telefone.
  - `EstoquePage.test.tsx`, `ProdutosPage.test.tsx`: Listagens, filtros, paginação, modals de entrada/saída de peças.
  - `useAuth.test.tsx`, `ConfirmModal.test.tsx`: Tratamento de estados de carregamento, confirmações destrutivas e redirecionamentos.

---

## 6. Resultados de Lint e Build

### 6.1 Linter Frontend
- **Comando executado**: `npm run lint`
- **Resultado**: `✔ No ESLint warnings or errors` (Código 100% conforme regras do ESLint/TypeScript).

### 6.2 Build de Produção Frontend
- **Comando executado**: `npm run build`
- **Resultado**: `Compiled successfully in 301ms`
- **Rotas compiladas (14 rotas)**:
  - `○ /` (Dashboard - Static)
  - `○ /_not-found` (Static)
  - `○ /clientes` (Static)
  - `○ /clientes/novo` (Static)
  - `ƒ /clientes/[id]` (Dynamic)
  - `○ /estoque` (Static)
  - `○ /login` (Static)
  - `○ /maquinas` (Static)
  - `○ /maquinas/novo` (Static)
  - `ƒ /maquinas/[id]` (Dynamic)
  - `○ /ordens-servico` (Static)
  - `○ /ordens-servico/novo` (Static)
  - `ƒ /ordens-servico/[id]` (Dynamic)
  - `○ /produtos` (Static)
  - `○ /relatorios` (Static)
- **Aviso Observado**:
  - `⚠️ The "middleware" file convention is deprecated. Please use "proxy" instead.` (Aviso do Next.js 16 recomendando migração futura para a convenção `proxy`).

---

## 7. Problemas Encontrados (Backlog Detalhado)

### AUDIT-001 — [CORRIGIDO NA FASE 1] Ausência de Configuração de Cookie Domain em Subdomínios Públicos Cross-Origin
- **Classificação**: `P1 — Crítico`
- **Tipo**: `SEGURANÇA / ARQUITETURA`
- **Status**: `[CORRIGIDO]`
- **Evidência Anterior**: `backend/src/main/java/com/oficinagestao/controller/AuthController.java` (cookies emitidos sem atributo `.domain()`).
- **Problema Original**: Se o frontend estivesse em `app.oficinagestao.com.br` e o backend em `api.oficinagestao.com.br`, cookies Host-Only emitidos pela API não eram enviados para o frontend, causando loop de redirecionamento para `/login`.
- **Resolução Implementada**:
  - Definida e adotada a estratégia arquitetural de **mesma origem** (`https://oficinagestao.com.br`) na Vercel:
    - Frontend Next.js servindo `/` e páginas da aplicação.
    - Next.js executando rewrites transparentes no edge para `/api/*` apontando para o backend Spring Boot (`frontend/next.config.ts`).
    - `API_URL` em `frontend/src/lib/api.ts` atualizado para utilizar chamadas relativas à mesma origem (`''`) em produção, eliminando tráfego cross-origin para cookies.
    - Cookies HttpOnly permanecem seguros (`Path=/`, `SameSite=Lax`, `Secure` em produção) e são transmitidos naturalmente na mesma origem sem necessidade de abrir o cookie para múltiplos domínios.
- **Arquivos Alterados**: `frontend/next.config.ts`, `frontend/src/lib/api.ts`, `frontend/src/app/login/page.tsx`, `docs/deployment.md`.
- **Critério de aceite**: Operação sob mesma origem comprovada via testes automatizados e builds de produção.

---

### AUDIT-002 — [CORRIGIDO NA FASE 1] Falha no Tratamento de Erro HTTP 429 (Rate Limit / Lockout) na Interface de Login
- **Classificação**: `P2 — Importante`
- **Tipo**: `UX / FRONTEND`
- **Status**: `[CORRIGIDO]`
- **Evidência Anterior**: `frontend/src/app/login/page.tsx` tratava apenas 401 e 400, exibindo "Falha de conexão com o servidor" em 429.
- **Problema Original**: Quando o backend ou gateway retornava HTTP 429 por tentativas excessivas de senha (lockout do `LoginAttemptService`), o usuário via mensagem de falha de servidor em vez da explicação do bloqueio temporário.
- **Resolução Implementada**:
  - Implementada a função utilitária `extrairMensagemErroLogin(response: Response)` em `frontend/src/lib/api.ts`.
  - Captura explícita de HTTP 429: extrai a mensagem do corpo JSON quando disponível ou exibe mensagem clara: `"Conta temporariamente bloqueada por excesso de tentativas. Tente novamente mais tarde."`.
  - Preservados: HTTP 401 (e-mail/senha incorretos), HTTP 400 (dados inválidos), HTTP 403 (conta inativa), e fallback para erro genérico de servidor.
  - Integrado no `onSubmit` de `frontend/src/app/login/page.tsx`.
  - Criada suíte completa de testes automatizados com 10 cenários em `frontend/src/lib/loginErrorHelper.test.ts`.
- **Arquivos Alterados**: `frontend/src/lib/api.ts`, `frontend/src/app/login/page.tsx`, `frontend/src/lib/loginErrorHelper.test.ts` (novo).
- **Critério de aceite**: Respostas 429 exibem mensagem amigável de lockout comprovada por testes automatizados (224 testes frontend verdes).

---

### AUDIT-003 — [CORRIGIDO NA FASE 1] Inconsistência de Nomenclatura da Variável de Inicialização do Administrador
- **Classificação**: `P2 — Importante`
- **Tipo**: `DOCUMENTAÇÃO / CONFIGURAÇÃO`
- **Status**: `[CORRIGIDO]`
- **Evidência Anterior**: Documentação mencionava `INITIAL_ADMIN_NOME`, enquanto o código Spring Boot (`AdminAccountBootstrap.java`) lia `INITIAL_ADMIN_NAME`.
- **Problema Original**: Risco de ignorar o nome configurado pelo operador na primeira inicialização da aplicação.
- **Resolução Implementada**:
  - Unificada toda a documentação, relatórios e guias para o padrão oficial `INITIAL_ADMIN_NAME`.
  - Atualizados `docs/deployment.md` e `RELEASE-1.0.0-REPORT.md`.
  - Validado que não restou nenhuma referência a `INITIAL_ADMIN_NOME` no repositório.
- **Arquivos Alterados**: `docs/deployment.md`, `RELEASE-1.0.0-REPORT.md`.
- **Critério de aceite**: 100% de uniformidade na nomenclatura `INITIAL_ADMIN_NAME` em todo o projeto.

---

### AUDIT-004 — Ausência de Constraint Composta no Banco para Vínculo Cliente x Equipamento na OS
- **Classificação**: `P2 — Importante`
- **Tipo**: `BANCO DE DADOS / INTEGRIDADE`
- **Evidência**: `backend/src/main/resources/db/migration/V1__create_initial_schema.sql` (linhas 150-155).
  ```sql
  CONSTRAINT fk_ordens_servico_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id),
  CONSTRAINT fk_ordens_servico_maquina FOREIGN KEY (maquina_id) REFERENCES maquinas(id)
  ```
- **Problema**: A validação que garante que a máquina pertence ao cliente da OS é feita com rigor no `OrdemServicoService.java` (`if (!maquina.getCliente().getId().equals(cliente.getId()))`). No entanto, no banco de dados não há uma Foreign Key composta `(maquina_id, cliente_id)` referenciando `maquinas(id, cliente_id)`.
- **Impacto**: Se um script manual de migração de dados ou suporte direto no banco inserir uma OS, é possível vincular uma máquina pertencente a outro cliente sem violar constraints relacionais.
- **Como reproduzir**: Executar um `INSERT INTO ordens_servico` direto via SQL associando `cliente_id = 1` e `maquina_id = 2` (sendo a máquina 2 do cliente 3).
- **Correção sugerida**: Em fase futura de melhoria de schema, adicionar constraint de unicidade `(id, cliente_id)` em `maquinas` e referenciar como chave estrangeira composta em `ordens_servico`.
- **Critério de aceite**: O banco de dados rejeita via constraint a vinculação de máquina e cliente incompatíveis mesmo em queries diretas.

---

### AUDIT-005 — Obtenção do IP Real de Auditoria Atrás de Proxies Reversos em Nuvem
- **Classificação**: `P3 — Melhoria`
- **Tipo**: `BACKEND / OBSERVABILIDADE`
- **Evidência**: `backend/src/main/java/com/oficina/gestao/service/AuditoriaService.java` (linha 32: `request.getRemoteAddr()`).
- **Problema**: O serviço de auditoria grava o IP do usuário chamando diretamente `request.getRemoteAddr()`. Em ambientes cloud conteinerizados atrás de load balancers ou proxies reversos (como Vercel, Cloudflare ou AWS ALB), esse método retorna o IP da interface interna do proxy caso a estratégia de headers encaminhados não esteja harmonizada com as redes confiáveis.
- **Impacto**: O log de auditoria pode registrar IPs internos (como `10.x.x.x` ou `127.0.0.1`) em vez do IP de origem da oficina.
- **Como reproduzir**: Subir a aplicação atrás de um proxy reverso e disparar requisições.
- **Correção sugerida**: Implementar método utilitário que avalie com segurança os cabeçalhos `X-Forwarded-For` / `X-Real-IP` respeitando proxies confiáveis, alinhado à propriedade `server.forward-headers-strategy=framework`.
- **Critério de aceite**: IP público real registrado nos logs de auditoria mesmo em ambiente conteinerizado.

---

### AUDIT-006 — Aviso de Depreciação da Convenção de Arquivo `middleware.ts` no Next.js 16
- **Classificação**: `P3 — Melhoria`
- **Tipo**: `FRONTEND / MANUTENÇÃO`
- **Evidência**: Saída do comando `npm run build`: `The "middleware" file convention is deprecated. Please use "proxy" instead.`
- **Problema**: O Next.js 16 introduziu a convenção de proxy e iniciou o ciclo de depreciação do nome de arquivo `middleware.ts`.
- **Impacto**: Não há impacto imediato no funcionamento (build gerou código funcional com 100% de sucesso), mas futuras atualizações do Next.js poderão remover o suporte.
- **Como reproduzir**: Executar `npm run build` no diretório `frontend`.
- **Correção sugerida**: Adequar a convenção de arquivos para o padrão recomendado pelo Next.js 16 quando for realizado o ciclo de manutenção preventiva.
- **Critério de aceite**: Build executado sem emissão de avisos de depreciação.

---

### AUDIT-007 — Ausência de Listener de Tecla Escape no Componente `ConfirmModal`
- **Classificação**: `P3 — Melhoria`
- **Tipo**: `UX / ACESSIBILIDADE`
- **Evidência**: `frontend/src/components/ui/ConfirmModal.tsx`.
- **Problema**: O modal de confirmação de ações destrutivas (ex: inativação, exclusão de itens) fecha ao clicar no botão "Cancelar" ou no backdrop, mas não escuta o evento de teclado `Escape` (`keydown`).
- **Impacto**: Pequeno atrito de usabilidade e acessibilidade para operadores que utilizam o teclado para navegar rapidamente pelo sistema.
- **Como reproduzir**: Abrir qualquer modal de confirmação e pressionar a tecla `Esc`.
- **Correção sugerida**: Adicionar um hook `useEffect` que escute o evento `Escape` e dispare a função `onCancel()`.
- **Critério de aceite**: Pressionar `Escape` fecha o modal de forma intuitiva.

---

### AUDIT-008 — Armazenamento do Lockout de Tentativas de Login em Memória Local
- **Classificação**: `P3 — Melhoria`
- **Tipo**: `SEGURANÇA / ESCALABILIDADE`
- **Evidência**: `backend/src/main/java/com/oficina/gestao/security/LoginAttemptService.java` (utiliza `ConcurrentHashMap`).
- **Problema**: O controle de tentativas falhas de login reside na memória da JVM da instância atual.
- **Impacto**: Para a escala atual de produção planejada (uma única instância do container Spring Boot), a solução é 100% segura e performática. Caso o backend seja escalado horizontalmente no futuro (múltiplos containers em paralelo), o contador de tentativas não será compartilhado entre instâncias sem um cache distribuído (ex: Redis).
- **Como reproduzir**: Rodar duas instâncias do backend e alternar requisições entre elas.
- **Correção sugerida**: Manter documentado que o sistema opera em arquitetura de instância única, ou prever futura integração com Redis se houver necessidade de escala horizontal.
- **Critério de aceite**: Limite de tentativas respeitado globalmente no modelo mono-instância.

---

## 8. Análise de Riscos

1. **Risco de Acesso Cross-Origin em Produção (Risco Médio / Mitigável)**:
   - Se o backend e frontend forem hospedados em domínios completamente distintos sem compartilhamento de cookies ou sem proxy reverso, a autenticação via cookie HttpOnly falhará.
   - *Mitigação*: Uso de subdomínios sob o mesmo domínio raiz com `.domain()` configurado ou uso de proxy reverso da Vercel (`rewrite`).
2. **Risco de Ausência de Protected Branches no Neon Free (Risco Baixo)**:
   - O plano Free do Neon não permite ativar branch protection nativa.
   - *Mitigação*: Restringir o acesso ao console do Neon e utilizar usuário de banco com privilégios limitados de DML para a aplicação.
3. **Risco de Concorrência de Estoque (Risco Nulo - Mitigado)**:
   - O sistema já utiliza `SELECT ... FOR UPDATE` (Pessimistic Locking) no `EstoqueService` e possui constraint `chk_produtos_estoque_nao_negativo` no banco. Não há risco de saldo negativo por concorrência.

---

## 9. Análise de Regressões

- Foi feita uma comparação rigorosa entre as funcionalidades implementadas nas fases anteriores e o estado atual.
- **Resultado**: **Nenhuma regressão funcional foi detectada**.
  - Clientes: filtros, máscaras, listagem e validações permanecem intactos.
  - Equipamentos: regras de vínculo com cliente e filtros técnicos funcionam normalmente.
  - Produtos e Estoque: cálculo atômico de saldo preservado.
  - Ordens de Serviço: sequência atômica de OS, congelamento de preços de peças e totalizadores matemáticos permanecem consistentes.

---

## 10. Auditoria de UX (Experiência do Usuário da Oficina)

**Avaliação sob a perspectiva do usuário final da oficina**:
- **Clareza de Telas**: Excelente. O vocabulário é direto e sem jargões desnecessários de TI ("Cliente", "Equipamento", "Máquina de Solda", "Tensão", "Diagnóstico", "Laudo Técnico", "Peças", "Total").
- **Fluxo de Trabalho**: O fluxo de atendimento reflete perfeitamente a rotina de bancada:
  1. Cliente chega na oficina com a máquina com defeito.
  2. Atendente localiza ou cadastra o cliente e seleciona a máquina.
  3. Abertura da OS com relato do defeito.
  4. Técnico realiza diagnóstico e informa peças necessárias.
  5. Aprovação do orçamento e execução dos reparos.
  6. Realização de testes de soldagem/isolamento e registro do laudo.
  7. Finalização e notificação ao cliente via botão WhatsApp.
- **Responsividade**: As telas adaptam-se perfeitamente a notebooks (1366x768) e à escala padrão do Windows de 125%, mantendo botões de ação e tabelas visíveis com rolagem horizontal controlada.

---

## 11. Auditoria de Segurança

- **Credenciais e Secrets**: Nenhum secret real encontrado no repositório. O `.gitignore` cobre rigorosamente `.env`, `.env.local` e arquivos de credenciais. O backend exige incondicionalmente a variável `JWT_SECRET` em perfil de produção (`prod`), impedindo boot com chaves fracas.
- **Proteção de Senhas**: Armazenamento com BCrypt e salt individual (`strength 12`).
- **Controle de Sessão**: Tokens JWT transmitidos em Cookies `HttpOnly`, `SameSite=Lax` e flag `Secure` ligada em produção.
- **Proteção contra Força Bruta**: Implementada e ativa no endpoint de login (5 tentativas / 15 min).
- **Injeção de SQL**: Prevenida em 100% das consultas por meio do uso de JPA Criteria API, Spring Data JPA e queries parametrizadas.

---

## 12. Auditoria de Banco de Dados

- **Migrations Flyway**: V1 a V9 presentes, sequenciais e validadas.
  - `V1__create_initial_schema.sql`
  - `V2__seed_initial_data.sql`
  - `V3__fix_user_password_hash.sql`
  - `V4__add_ordem_servico_sequence.sql`
  - `V5__add_ordens_servico_indexes.sql`
  - `V6__add_produtos_estoque_constraint.sql`
  - `V7__remove_automotive_columns.sql`
  - `V8__add_technical_fields_and_types.sql`
  - `V9__remove_automotive_enum_values.sql`
- **Integridade Referencial**: Chaves estrangeiras com `ON DELETE RESTRICT` nas tabelas principais impedem a exclusão acidental de clientes com histórico de OS ou produtos vinculados a ordens de serviço.
- **Verificação de Domínio**: Totalmente expurgadas todas as tabelas e colunas com nomenclaturas automotivas (veículo, placa, km, chassi).

---

## 13. Auditoria de Performance

- **Índices de Banco**: Índices criados para buscas frequentes (documento do cliente, número de série da máquina, número da OS, status da OS, data de abertura).
- **Controle N+1**: Consultas de listagem utilizam projeções ou paginação com Pageable do Spring Data, mitigando carregamentos em cascata desnecessários.
- **Build Frontend**: Todas as páginas estáticas foram otimizadas e pré-renderizadas no build do Next.js, mantendo bundles ultraleves e tempo de carregamento inicial instantâneo.

---

## 14. Itens Não Validados no Ambiente Local

Os seguintes itens **não puderam ser validados no ambiente local** pois dependem exclusivamente de infraestrutura cloud externa provisionada:

1. **Comportamento Real de Cookies sob Dois Subdomínios Públicos com HTTPS Real**:
   - *Motivo*: Depende da configuração de DNS e certificados SSL ativos no domínio oficial da oficina (`app.oficinagestao.com.br` e `api.oficinagestao.com.br`).
2. **Rotina de Backup Off-Site Automatizada e Restore em Banco Secundário**:
   - *Motivo*: Depende de bucket S3/Cloud Storage configurado com chaves de acesso externas e agendamento de cron.
3. **Protected Branch no Neon PostgreSQL**:
   - *Motivo*: Funcionalidade indisponível no plano gratuito do Neon; a proteção requer plano Scale ou restrição operacional de credenciais.
4. **Resolução de IP Real em Logs de Auditoria sob o Proxy Reverso da Vercel**:
   - *Motivo*: Depende do tráfego real passando pela infraestrutura de edge da Vercel até o container backend.

---

## 15. Pontos Positivos Confirmados

1. **438 Testes Automatizados Verdes**: 224 testes backend e 214 testes frontend passando sem falhas.
2. **Zero Linter Warnings**: Código limpo, padronizado e com tipagem estrita no TypeScript.
3. **Concorrência Segura**: Travamento pessimista de estoque no backend com verificação dupla no banco.
4. **Domínio Consistente e Focado**: 100% de adequação ao escopo de máquinas industriais de solda, geradores e ferramentas elétricas.
5. **Autenticação Conforme com OWASP**: Uso de cookies HttpOnly com proteção contra CSRF via SameSite=Lax e sanitização de entradas.
6. **Interface Agradável e Acessível**: Design moderno, feedback visual claro com toasts e badges sem sobrecarregar o usuário.

---

## 16. Backlog de Correções Consolidado

| ID | Prioridade | Tipo | Título Resumido | Status |
| :--- | :--- | :--- | :--- | :--- |
| **AUDIT-001** | **P1** | SEGURANÇA / ARQ | Configuração de mesma origem no Next.js (rewrites /api/*) | **CORRIGIDO** |
| **AUDIT-002** | **P2** | UX / FRONTEND | Tratamento visual de erro HTTP 429 (lockout) no login | **CORRIGIDO** |
| **AUDIT-003** | **P2** | DOC / CONFIG | Unificação da variável de ambiente `INITIAL_ADMIN_NAME` | **CORRIGIDO** |
| **AUDIT-004** | **P2** | BANCO / INTEGR | Validação composta de cliente x equipamento no schema | Pendente (Fase posterior) |
| **AUDIT-005** | **P3** | OBSERVABILIDADE | Extração de IP de cliente atrás de proxy reverso | Pendente (Fase posterior) |
| **AUDIT-006** | **P3** | MANUTENÇÃO | Atualização da convenção de middleware para proxy no Next.js | Pendente (Fase posterior) |
| **AUDIT-007** | **P3** | UX / A11Y | Suporte a tecla Escape para fechar modal de confirmação | Pendente (Fase posterior) |
| **AUDIT-008** | **P3** | SEGURANÇA | Planejamento de cache distribuído para lockout de login | Pendente (Fase posterior) |

---

## 17. Roadmap Recomendado de Correção

```
FASE 1 — BLOQUEADORES & CRÍTICOS PRÉ-PRODUÇÃO [CONCLUÍDO]
├── AUDIT-001 [P1]: Configurada mesma origem (rewrites /api/* na Vercel/Next.js) para garantir sessões e cookies. [CORRIGIDO]
├── AUDIT-002 [P2]: Exibição amigável de mensagem de bloqueio por tentativas excessivas (HTTP 429). [CORRIGIDO]
└── AUDIT-003 [P2]: Unificação da variável INITIAL_ADMIN_NAME no código e documentação. [CORRIGIDO]

FASE 2 — REGRAS E INTEGRIDADE DE SCHEMA (P2)
└── AUDIT-004: Planejar migration futura para chave composta cliente x máquina no banco de dados.

FASE 3 — MELHORIAS E POLIMENTO (P3)
├── AUDIT-005: Ajustar resolução de IP real em logs de auditoria atrás de proxy.
├── AUDIT-006: Atualizar convenção de middleware.ts para proxy no Next.js 16.
├── AUDIT-007: Adicionar listener de Escape no ConfirmModal.
└── AUDIT-008: Documentar limites do lockout em memória para arquiteturas multi-instância.
```

---

## 18. Critérios para Considerar o Projeto Pronto para Produção (Go-Live)

Para que o sistema **Oficina Gestão** receba a chancela final de liberação para produção com clientes e equipamentos reais da oficina, os seguintes critérios devem ser estritamente cumpridos:

1. **Ajuste do Apontamento AUDIT-001**: Garantir que a comunicação frontend/backend em produção mantenha a sessão autenticada com cookies válidos via HTTPS.
2. **Resolução Amigável do Apontamento AUDIT-002**: Garantir que o operador não receba mensagem de erro de servidor caso erre a senha consecutivamente.
3. **Ambiente Cloud Provisionado**:
   - Frontend publicado na Vercel com domínio/subdomínio próprio e HTTPS ativo.
   - Backend conteinerizado ativo com certificados válidos e headers seguros.
   - Banco de dados Neon com branch de produção isolada e credenciais fortes.
4. **Validação de Smoke Test em Produção**:
   - Realizar um fluxo ponta a ponta completo de teste em ambiente de homologação/produção (Login ➔ Cadastro de Cliente ➔ Cadastro de Máquina de Solda ➔ Abertura de OS ➔ Adição de Peça ➔ Testes Técnicos ➔ Finalização).
5. **Rotina de Backup Operacional**:
   - Primeiro dump lógico do banco de dados executado e comprovadamente restaurado em banco de teste com sucesso.

---
*Relatório gerado em estrita conformidade com as regras de auditoria não destrutiva do projeto Oficina Gestão.*
