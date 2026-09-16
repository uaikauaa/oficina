# QA MASTER 2.0 — RELATÓRIO DE AUDITORIA TÉCNICA FINAL, REGRESSÃO E SEGURANÇA
## OFICINA GESTÃO — VERSÃO 1.1

**Data:** 16 de Setembro de 2026  
**Auditor Responsável:** Antigravity QA Master Agent  
**Versão Auditada:** Oficina Gestão V1.1  
**Tipo de Aplicação:** WebApp Exclusivo (Next.js 16 + Spring Boot 3.4.3 + PostgreSQL Neon)  
**Status da Avaliação:** **REPROVADO** (Critério Rígido: Presença de apontamento P1 em regras críticas de negócio)  

---

## 1. Resumo Executivo

A auditoria técnica **QA Master 2.0** realizou uma inspeção aprofundada, exaustiva e multidisciplinar no código-fonte, suítes de teste, migrações de banco de dados, fluxos de segurança, contratos de API e comportamentos de concorrência do sistema **Oficina Gestão V1.1**.

### Principais Conclusões:
1. **Solidez Arquitetural e Transacional:** O núcleo de estoque, concorrência pessimista (`SELECT ... FOR UPDATE`), congelamento de preços históricos na OS e restrições de integridade no banco de dados (`chk_produtos_estoque_nao_negativo`) demonstraram robustez exemplar contra corrupção de dados e condições de corrida.
2. **Revalidação de Issues Anteriores:**
   - **ISSUE-001 (Abertura de OS para Cliente/Equipamento Inativo):** **NÃO CORRIGIDO NO BACKEND (P1)**. Embora o frontend oculte ou filtre equipamentos inativos na interface, o endpoint `POST /api/ordens-servico` não valida os campos `cliente.getAtivo()` e `maquina.getAtivo()`, permitindo a abertura de OS diretamente via API para clientes e máquinas inativadas.
   - **ISSUE-002 (Exportação CSV de Conjunto Filtrado Completo):** **NÃO CORRIGIDO (P2)**. As rotinas de exportação CSV em `/relatorios` exportam estritamente o conteúdo da página corrente em tela (`relatorio?.content`, limitado a 15 registros), omitindo os demais registros quando o resultado filtrado ultrapassa uma página (ex: 45+ registros).
3. **Segurança Geral:** Nenhum token sensível é armazenado em `localStorage` ou `sessionStorage`; o sistema adota cookies `HttpOnly` com `SameSite=Lax` e `SameSite=Strict`. No entanto, inexiste proteção contra força bruta no login (`/api/auth/login`) e há fallback público para a secret JWT se a variável de ambiente não for informada.
4. **Resultado Global:** Seguindo estritamente os critérios do QA Master 2.0 (onde a existência de qualquer apontamento P1 impede a aprovação), o status da versão V1.1 é classificado como **REPROVADO**, com plano de ação imediato recomendado na Seção 24.

---

## 2. Ambiente Auditado

* **Frontend:**
  * Framework: Next.js 16.3.5 (App Router, Turbopack)
  * Biblioteca de UI: React 19.2.8, Tailwind CSS v4, Lucide React
  * Formulários & Validação: React Hook Form 7.88, Zod 4.6.5
  * Runtime de Execução Local: Node.js v24.21.0 / NPM 11.2.0
  * Runtime do CI: Node.js 22.x LTS
* **Backend:**
  * Linguagem: Java 21 LTS (Oracle OpenJDK)
  * Framework: Spring Boot 3.4.3
  * Segurança: Spring Security, JJWT 0.12.6 (HMAC-SHA256)
  * Persistência: Spring Data JPA, Hibernate 6.6
  * Migrations: Flyway Database Migrations (V1 a V9)
  * Documentação: SpringDoc OpenAPI 2.8.5 / Swagger UI
  * Geração de Documentos: OpenPDF 2.0.3
* **Banco de Dados:**
  * Motor: PostgreSQL 16 (Hospedagem em nuvem Neon Serverless e container efêmero no CI)
  * Estado do Schema: Migrations V1 a V9 aplicadas e validadas
* **Pipeline de CI:**
  * GitHub Actions (`ci.yml`) com jobs paralelos de Backend (Postgres Service + Maven) e Frontend (Node 22 + Lint + Build + Testes nativos).

---

## 3. Testes Executados

1. **Suíte Automatizada do Backend:**
   * Comando: `./mvnw clean test`
   * Testes executados: 174
   * Falhas: 0 | Erros: 0 | Ignorados: 0
   * Duração: ~34 segundos
2. **Suíte Automatizada do Frontend:**
   * Comando: `npm test` (via Node.js nativo com `--experimental-strip-types`)
   * Testes executados: 21 (6 suites)
   * Falhas: 0 | Ignorados: 0
   * Duração: ~104 ms
3. **Análise Estática de Código (Linter):**
   * Comando: `npm run lint` (ESLint 9)
   * Resultado: 0 erros, 0 avisos
4. **Compilação de Produção:**
   * Comando: `npm run build` (Next.js Turbopack)
   * Resultado: 15 rotas estáticas e dinâmicas geradas com sucesso.
5. **Auditoria de Dependências:**
   * Comando: `npm audit`
   * Resultado: 0 vulnerabilidades encontradas.
6. **Auditoria Estrutural de Código e Testes Adversariais Manuais/Estáticos:**
   * Injeção de valores negativos em horímetro, preços e descontos;
   * Bypass de integridade de cliente inativo via payload manual de API;
   * Inspeção de concorrência com bloqueio pessimista em banco de dados;
   * Simulação de replay attack em refresh tokens.

---

## 4. Issues Encontradas

Durante a auditoria foram identificadas e categorizadas **6 issues técnicas**, distribuídas da seguinte forma:
* **P0 (Crítico):** 0 issues
* **P1 (Alto):** 1 issue
* **P2 (Médio):** 3 issues
* **P3 (Baixo):** 2 issues

---

## 5. P0 — Crítico

*Nenhuma vulnerabilidade ou falha de severidade P0 foi identificada na versão auditada.*
- Não há bypass catastrófico de autenticação;
- Não há risco de saldo de estoque negativo no banco de dados (bloqueio por Lock Pessimista e `CHECK (estoque_atual >= 0)`);
- Não há quebra de atomicidade transacional com perda de dados.

---

## 6. P1 — Alto

### [ISSUE-001] Abertura de Ordem de Serviço e Cadastro de Máquina para Cliente Inativo ou Equipamento Inativo no Backend
* **ID:** ISSUE-001
* **Severidade:** P1 (ALTO)
* **Área:** Backend / Regras de Negócio
* **Arquivo:** `backend/src/main/java/com/oficinagestao/service/OrdemServicoService.java` (linhas 67–78) e `MaquinaService.java` (linhas 94–99)
* **Endpoint:** `POST /api/ordens-servico` e `POST /api/maquinas`
* **Pré-condição:** Existência de um cliente com `ativo = false` ou de uma máquina com `ativo = false`.
* **Passos de Reprodução:**
  1. No banco de dados ou via endpoint de inativação, definir um cliente como inativo (`ativo = false`).
  2. Submeter uma requisição HTTP POST para `/api/ordens-servico` com o payload:
     ```json
     {
       "clienteId": <id_cliente_inativo>,
       "maquinaId": <id_maquina_valida>,
       "problemaRelatado": "Equipamento não liga"
     }
     ```
  3. Observar a resposta HTTP do backend.
* **Resultado Obtido:** O backend retorna HTTP 201 CREATED e gera a Ordem de Serviço com status `ABERTA`, ignorando completamente o status inativo do cliente. O mesmo ocorre ao vincular um equipamento inativo (`maquina.getAtivo() == false`) ou ao cadastrar uma nova máquina para um cliente desativado em `MaquinaService.criar`.
* **Resultado Esperado:** O backend deve rejeitar a criação com HTTP 400 Bad Request lançando `BusinessException` informando que o cliente ou equipamento encontra-se inativo e não pode receber novas ordens de serviço ou vínculos cadastrais.
* **Impacto:** Quebra da integridade de regras de negócio em operações diretas de API. A proteção atual reside apenas na camada visual do frontend (que filtra a listagem), permitindo bypass por qualquer cliente REST ou script malicioso autenticado.
* **Teste Existente:** Nenhum teste em `OrdemServicoServiceTest.java` testa a inativação de cliente ou máquina na criação de OS.
* **Teste Faltante:** Testes unitários e de integração testando `naoDeveCriarOSSeClienteEstiverInativo` e `naoDeveCriarOSSeMaquinaEstiverInativa`.

---

## 7. P2 — Médio

### [ISSUE-002] Exportação CSV Parcial (Apenas Registros da Página Corrente em Relatórios)
* **ID:** ISSUE-002
* **Severidade:** P2 (MÉDIO)
* **Área:** Frontend / Relatórios
* **Arquivo:** `frontend/src/app/relatorios/page.tsx` (linhas 307–434)
* **Endpoint:** `GET /api/relatorios/*`
* **Pré-condição:** Relatório possuir mais de 15 registros correspondentes aos filtros selecionados (múltiplas páginas).
* **Passos de Reprodução:**
  1. Acessar a tela `/relatorios` na aba "Ordens de Serviço", "Estoque" ou qualquer uma das 6 abas.
  2. Aplicar um filtro que retorne 45 registros (3 páginas de 15 itens).
  3. Clicar no botão "Exportar CSV".
  4. Abrir o arquivo CSV gerado em uma planilha.
* **Resultado Obtido:** O arquivo CSV contém apenas os 15 registros da página que estava selecionada na tela no momento do clique. Os 30 registros restantes são descartados. Se o usuário estiver na página 2, o CSV conterá apenas os itens 16 a 30.
* **Resultado Esperado:** O botão de exportação deve baixar a integralidade dos dados filtrados (todas as páginas do conjunto de dados ativo), seja realizando uma requisição específica para a exportação com `size=10000` ou iterando por todas as páginas disponíveis.
* **Impacto:** Extração incompleta e inconsistente de dados gerenciais e fiscais para análise externa em planilhas.
* **Teste Existente:** Há teste em `csvHelper.test.ts` para o utilitário de formatação de strings CSV, mas inexiste teste de integração para a rotina de exportação completa do relatório.
* **Teste Faltante:** Teste de interface ou integração garantindo exportação multi-página completa.

---

### [ISSUE-003] Ausência de Rate Limiting e Proteção Contra Ataques de Força Bruta no Login
* **ID:** ISSUE-003
* **Severidade:** P2 (MÉDIO)
* **Área:** Segurança / Autenticação
* **Arquivo:** `backend/src/main/java/com/oficinagestao/service/AuthService.java` (linhas 53–65) e `SecurityConfig.java`
* **Endpoint:** `POST /api/auth/login`
* **Pré-condição:** Endpoint de login acessível publicamente.
* **Passos de Reprodução:**
  1. Enviar consecutivamente 100 requisições POST para `/api/auth/login` com senhas arbitrárias para o e-mail do administrador.
  2. Avaliar o tempo de resposta e os status HTTP retornados.
* **Resultado Obtido:** Todas as 100 requisições são processadas sem delay artificial, sem bloqueio de IP, sem bloqueio temporário de conta e sem exigência de desafio (captcha).
* **Resultado Esperado:** O sistema deve limitar a taxa de tentativas (ex: no máximo 5 tentativas a cada 5 minutos por IP/usuário) e aplicar bloqueio temporário ou retardo progressivo.
* **Impacto:** Exposição das contas administrativas a ataques automatizados de força bruta (*credential stuffing*).
* **Teste Existente:** Nenhum teste de limite de requisições.
* **Teste Faltante:** Teste de segurança para rate limiting e bloqueio temporário de autenticação.

---

### [ISSUE-004] Fallback Hardcoded de JWT Secret em Produção se Variável de Ambiente Estiver Ausente
* **ID:** ISSUE-004
* **Severidade:** P2 (MÉDIO)
* **Área:** Segurança / Configuração
* **Arquivo:** `backend/src/main/resources/application.properties` (linha 37) e `JwtService.java` (linha 28)
* **Problema:** A propriedade `security.jwt.secret` possui o valor padrão `${JWT_SECRET:default-secret-key-oficina-gestao-dev-environment-2026-secure-token}`. Caso a aplicação suba em ambiente de produção sem a definição explícita de `JWT_SECRET`, ela inicializará silenciosamente utilizando um segredo público documentado no repositório.
* **Resultado Obtido:** O servidor sobe com sucesso e assina tokens válidos com a chave de desenvolvimento pública.
* **Resultado Esperado:** Em perfil de produção ou inicialização geral, a aplicação deve falhar no bootstrap se o segredo for idêntico ao fallback público ou se tiver tamanho inferior a 256 bits gerados aleatoriamente.
* **Impacto:** Risco crítico em caso de erro operacional no provisionamento de variáveis de ambiente no provedor de nuvem (Render/Railway/Neon).
* **Teste Existente:** Inexistente.

---

## 8. P3 — Baixo

### [ISSUE-005] Enumeração Parcial de Contas por Diferenciação de Mensagem em Usuário Inativo
* **ID:** ISSUE-005
* **Severidade:** P3 (BAIXO)
* **Área:** Segurança / Autenticação
* **Arquivo:** `backend/src/main/java/com/oficinagestao/service/AuthService.java` (linhas 62–64)
* **Endpoint:** `POST /api/auth/login`
* **Problema:** Quando um e-mail não existe ou a senha está incorreta, a aplicação retorna HTTP 401 com a mensagem `"Credenciais inválidas."`. No entanto, se o usuário existir, a senha estiver correta, mas a conta estiver desativada, a aplicação retorna HTTP 403 com a mensagem `"Conta de usuário inativa."`.
* **Impacto:** Permite que um atacante confirme a existência de contas de e-mail específicas e seu status cadastral no sistema.
* **Recomendação:** Retornar a mesma mensagem genérica (`"Credenciais inválidas."`) ou tratar o status de inativo de forma uniforme na interface.

---

### [ISSUE-006] Aceitação de Laudo Técnico de Bancada sem Tamanho Mínimo para Transição PRONTA
* **ID:** ISSUE-006
* **Severidade:** P3 (BAIXO)
* **Área:** Backend / Regras de Negócio
* **Arquivo:** `backend/src/main/java/com/oficinagestao/service/OrdemServicoService.java` (linhas 213–218)
* **Endpoint:** `PATCH /api/ordens-servico/{id}/status`
* **Problema:** Para avançar o status da OS para `PRONTA`, o backend exige que `testesRealizados` não seja nulo nem em branco (`!isBlank()`). No entanto, o envio de um caractere arbitrário (ex: `"."` ou `"ok"`) é aceito pelo validador.
* **Impacto:** Permite que operadores contornem o registro detalhado de laudo de bancada inserindo caracteres sem significado técnico.
* **Recomendação:** Exigir um comprimento mínimo razoável (ex: `@Size(min = 10)` ou validação de pelo menos 10 caracteres significativos).

---

## 9. Segurança

| Vetor de Teste | Status | Detalhes da Auditoria |
| :--- | :---: | :--- |
| **Armazenamento de Tokens no Frontend** | **SEGURO** | Nenhum token em `localStorage` ou `sessionStorage`. Cookies `HttpOnly` exclusivos. |
| **Flags de Cookies de Autenticação** | **SEGURO** | `access_token` com `SameSite=Lax`, `path="/"`, `HttpOnly=true`. `refresh_token` com `SameSite=Strict`, `path="/api/auth"`. |
| **Proteção contra Replay Attack de Refresh Token** | **SEGURO** | Rotação automática a cada refresh. Reutilização de token revogado dispara *family revocation* imediata de todos os tokens do usuário. |
| **Validação e Assinatura de JWT** | **SEGURO** | HMAC-SHA256 verificado rigorosamente pelo parser do JJWT. Tokens adulterados no payload ou assinatura são rejeitados com HTTP 401. |
| **Injeção de SQL / JPQL** | **SEGURO** | Todas as consultas utilizam Spring Data JPA com parâmetros nomeados (`@Param`). Nenhuma concatenação dinâmica de strings SQL. |
| **Manipulação Direta de Objetos (IDOR)** | **SEGURO** | Remoção de itens de OS utiliza `findByIdAndOrdemServicoId(itemId, ordemServicoId)`, impedindo remoção cruzada entre ordens. |
| **Exposição de Stack Trace** | **SEGURO** | `GlobalExceptionHandler` captura todas as exceções e retorna payloads padronizados `ApiErrorResponse` sem expor rastros internos ou detalhes do banco. |
| **Brute Force no Login** | **VULNERÁVEL (P2)** | Inexistência de rate limiting ou bloqueio de tentativas sucessivas (ver ISSUE-003). |
| **Fallback de Segredo JWT** | **ATENÇÃO (P2)** | Aplicação permite inicialização com fallback default caso `JWT_SECRET` não seja configurado (ver ISSUE-004). |

---

## 10. Integridade de Dados

* **Restrição de Saldo Negativo:**
  * No backend: `EstoqueService` e `OrdemServicoItemService` validam `saldoAnterior.compareTo(quantidade) < 0` antes da baixa.
  * No PostgreSQL: Migration `V7__add_stock_constraints_and_indices.sql` garante fisicamente a constraint `chk_produtos_estoque_nao_negativo CHECK (estoque_atual >= 0)`.
* **Preço Histórico Congelado:**
  * Ao adicionar um produto à OS, o campo `valorUnitario` em `ordem_servico_itens` é preenchido com o valor de venda do momento da adição.
  * Alterações posteriores no preço do produto em `produtos` não afetam os itens já lançados nem o valor total da OS.
* **Integridade Cadastral (Exclusão Lógica):**
  * Nenhuma tabela do domínio possui endpoints de deleção física (`DELETE`). Clientes, máquinas, produtos e fornecedores operam exclusivamente via inativação lógica (`ativo = false`), garantindo rastreabilidade histórica perene.

---

## 11. Concorrência

* **Bloqueio Pessimista de Escrita (Pessimistic Write Lock):**
  * Implementado em `ProdutoRepository.findByIdWithLock` (`@Lock(LockModeType.PESSIMISTIC_WRITE)`).
  * Quando duas requisições simultâneas tentam baixar estoque do mesmo item, a segunda transação é colocada em espera até que a primeira conclua a alteração do saldo.
  * Teste adversarial: Produto com saldo = 1 recebendo duas requisições simultâneas de saída = 1: uma transação é concluída com sucesso (saldo passa a 0) e a segunda falha com `BusinessException("Estoque insuficiente")`. O saldo final nunca se torna negativo.

---

## 12. Regras de Negócio

### Matriz de Transições de Ciclo de Vida da OS:

| Status Atual | Status Solicitado | Permitido? | Comportamento Observado |
| :--- | :--- | :---: | :--- |
| `ABERTA` | `EM_DIAGNOSTICO` | **SIM** | Atualiza status e registra auditoria. |
| `ABERTA` | `AGUARDANDO_APROVACAO` | **SIM** | Atualiza status e registra auditoria. |
| `ABERTA` | `CANCELADA` | **SIM** | Cancela e estorna eventuais peças vinculadas. |
| `ABERTA` | `PRONTA` | **NÃO** | Rejeitado com HTTP 400 (`BusinessException`). |
| `ABERTA` | `CONCLUIDA` | **NÃO** | Rejeitado com HTTP 400 (`BusinessException`). |
| `EM_DIAGNOSTICO` | `AGUARDANDO_APROVACAO` | **SIM** | Permitido. |
| `EM_DIAGNOSTICO` | `EM_MANUTENCAO` | **SIM** | Permitido. |
| `EM_MANUTENCAO` | `AGUARDANDO_PECA` | **SIM** | Permitido. |
| `EM_MANUTENCAO` | `PRONTA` | **SIM** | Exige laudo técnico preenchido em `testesRealizados`. |
| `AGUARDANDO_PECA` | `EM_MANUTENCAO` | **SIM** | Permitido. |
| `PRONTA` | `CONCLUIDA` | **SIM** | Define `dataConclusao = now()`. |
| `PRONTA` | `EM_MANUTENCAO` | **SIM** | Permite retorno para retrabalho em bancada. |
| `CONCLUIDA` | Qualquer Status | **NÃO** | Status terminal imutável. Lança `BusinessException`. |
| `CANCELADA` | Qualquer Status | **NÃO** | Status terminal imutável. Lança `BusinessException`. |

---

## 13. Frontend

* **Responsividade e Viewport:**
  * As telas `/dashboard`, `/ordens-servico`, `/clientes`, `/maquinas`, `/produtos`, `/estoque` e `/relatorios` possuem contêineres de tabela com `overflow-x-auto`.
  * O modal `BuscaRapidaModal` (`Ctrl+K`) utiliza restrições verticais com `max-h-[calc(100vh-3rem)]` e rolagem independente na lista de resultados, prevenindo transbordamento em resoluções 1366x768 com 125% de escala de DPI.
* **Tratamento de Falhas e Estados de Carregamento:**
  * Uso de *spinners* de loading durante mutations de requisições;
  * Botões de submissão desabilitados durante envio para prevenção de duplo clique.

---

## 14. Backend

* **Arquitetura em Camadas:** Estrita separação entre Controllers REST, DTOs imutáveis (`records`), Camada de Serviço (`@Service` e `@Transactional`), Entidades JPA e Repositórios Spring Data.
* **Validação Declarativa:** Uso extensivo de Jakarta Bean Validation (`@NotBlank`, `@NotNull`, `@Size`, `@DecimalMin`).
* **Tratamento Global de Erros:** Respostas padronizadas via `ApiErrorResponse` contendo timestamp, código HTTP, status textual, mensagem e caminho de origem.

---

## 15. Banco de Dados

* **Conformidade de Schema:** Totalmente alinhado às migrations V1 a V9 do Flyway.
* **Chaves Estrangeiras e Índices:** Índices presentes para colunas de busca frequente (`tipo_equipamento`, `numero_serie`, `cliente_id`, `ativo`, `data_entrada`).
* **Sequências:** Uso da sequence `ordens_servico_seq` criada na migration V8 para geração garantida e sequencial dos identificadores de OS.

---

## 16. CSV

* **Formatação RFC 4180:**
  * Uso de delimitador de ponto e vírgula (`;`);
  * Quebra de linha consistente em `\r\n` (CRLF);
  * Escape de valores com aspas duplas (`""`);
  * Byte Order Mark UTF-8 (`\uFEFF`) presente no início do arquivo para suporte nativo em Microsoft Excel e editores de texto no Windows sem corromper caracteres acentuados.
* **Limitação Identificada:** Exportação truncada na página visualizada (ver ISSUE-002).

---

## 17. PDF

* **Qualidade e Estrutura do Documento:**
  * Gerado em formato vetorial A4 pelo `PdfService` utilizando a biblioteca OpenPDF;
  * Contém cabeçalho técnico oficial, identificação do cliente com dados de contato, detalhes do equipamento técnico (marca, modelo, número de série e horímetro), laudo de testes de bancada, tabela detalhada de componentes e discriminação financeira (mão de obra, peças, desconto e total líquido).
  * Valores de peças refletem os valores unitários históricos congelados na criação dos itens.

---

## 18. WhatsApp

* **Normalização de Números:** O utilitário `sanitizarTelefoneWhatsapp` em `whatsappHelper.ts` converte telefones com ou sem máscara para o padrão internacional `55 + DDD + Número`, rejeitando números sem DDD ou formatos incompletos.
* **Montagem de Mensagem:** Mensagem pré-formatada informando cliente, equipamento, número da OS e valor total.
* **Segurança no Envio:** A mensagem é aberta via `window.open(wa.me/...)` para revisão e envio estritamente manual pelo operador técnico, sem custos de API e sem disparos automatizados silenciosos.

---

## 19. Histórico e Rastreabilidade

* **Auditoria de Operações:** O `AuditoriaService` registra no banco de dados todas as mutações (`INSERT`, `UPDATE`, `STATUS_*`, `ATIVACAO`, `INATIVACAO`, `DELETE item`) com ID do usuário executor, entidade afetada, ID da entidade, ação e endereço IP de origem.
* **Histórico de Estoque:** Tabela `estoque_movimentacoes` registra com precisão o saldo anterior, saldo posterior, quantidade movimentada, motivo, tipo de movimentação e OS vinculada.

---

## 20. Performance

* **Consultas e N+1:** Os métodos de listagem de Ordens de Serviço e Equipamentos utilizam `JOIN FETCH` explícito para carregar relacionamentos `Cliente` e `Maquina`, prevenindo problemas de `N+1` no Hibernate.
* **Paginação:** Todos os endpoints de listagem do backend utilizam paginação via Spring Data `Pageable`.

---

## 21. Documentação × Código

* **Alinhamento do Domínio:** O sistema está 100% livre de termos automotivos (carro, veículo, placa, chassi, combustível). Toda a terminologia reflete rigorosamente o domínio de assistência técnica de **máquinas de solda, geradores de energia e componentes industriais**.
* **Divergência Documental Identificada:** O relatório `V1.1-IMPLEMENTATION-REPORT.md` (item 66) menciona *"A exportação utiliza exatamente a coleção filtrada ativa em tela no momento do clique"*, o que formalizou acidentalmente a exportação restrita aos 15 itens da página atual (ISSUE-002), em vez do dataset consolidado.

---

## 22. Cobertura de Testes

* **Testes Automatizados:** 174 testes no backend e 21 testes no frontend executam com 100% de sucesso.
* **Gaps de Cobertura Identificados:**
  * Ausência de testes de validação do status `ativo` de cliente/máquina em `OrdemServicoServiceTest`;
  * Ausência de testes de tentativa de login repetitivo (brute-force);
  * Ausência de testes de exportação com datasets superiores ao tamanho de página padrão.

---

## 23. Regressões

* Não foram detectadas regressões funcionais nas funcionalidades estáveis entregues na Release 1.0.0;
* O pipeline de CI (GitHub Actions) encontra-se verde e estabilizado com Node.js 22 LTS e testes passando em ambas as frentes.

---

## 24. Recomendações Técnicas

1. **Correção Imediata da ISSUE-001 (Backend):**
   * Em `OrdemServicoService.criar`, adicionar verificação:
     ```java
     if (!Boolean.TRUE.equals(cliente.getAtivo())) {
         throw new BusinessException("Não é possível abrir Ordem de Serviço para um cliente inativo.");
     }
     if (!Boolean.TRUE.equals(maquina.getAtivo())) {
         throw new BusinessException("Não é possível abrir Ordem de Serviço para um equipamento inativo.");
     }
     ```
   * Em `MaquinaService.criar`, adicionar validação semelhante para o cliente proprietário.
2. **Correção da ISSUE-002 (Frontend / Relatórios CSV):**
   * Ajustar as funções de exportação CSV para realizar uma requisição com parâmetro de paginação ampliado (ex: `size=10000` ou endpoint consolidado de exportação) de modo a obter todas as linhas que atendem aos filtros ativos, e não apenas o array da página corrente.
3. **Hardening de Segurança (ISSUE-003 e ISSUE-004):**
   * Implementar filtro de rate limiting em `/api/auth/login` (ex: via Bucket4j ou interceptor de tentativas em memória);
   * Adicionar validação no `@PostConstruct` de `JwtService` que interrompa a aplicação (`throw new IllegalStateException`) caso o profile ativo seja `prod` e a chave seja igual ao fallback de desenvolvimento.
4. **Refinamento de Laudo Técnico (ISSUE-006):**
   * Exigir tamanho mínimo de caracteres (ex: mínimo de 10 a 15 caracteres) para o campo `testesRealizados` ao transicionar para `PRONTA`.

---

## 25. Matriz Final de Issues

| ID | Severidade | Área | Problema | Reproduzido | Teste Existe | Impacto |
| :---: | :---: | :--- | :--- | :---: | :---: | :--- |
| **ISSUE-001** | **P1** | Backend / Negócio | Abertura de OS permitida para cliente ou equipamento inativo via API | **SIM** | NÃO | Quebra de regra de negócio em chamadas diretas de API |
| **ISSUE-002** | **P2** | Frontend / CSV | Exportação CSV trunca nos 15 registros da página corrente | **SIM** | NÃO | Relatórios incompletos para auditoria contábil/operacional |
| **ISSUE-003** | **P2** | Segurança / Auth | Ausência de proteção contra força bruta no login | **SIM** | NÃO | Risco de ataques automatizados de descoberta de credenciais |
| **ISSUE-004** | **P2** | Segurança / Config | Fallback de segredo JWT em produção | **SIM** | NÃO | Risco de uso de chave conhecida em provisionamento incorreto |
| **ISSUE-005** | **P3** | Segurança / Auth | Enumeração parcial de conta de usuário inativo | **SIM** | SIM | Revela status de conta desativada no sistema |
| **ISSUE-006** | **P3** | Backend / Negócio | Laudo técnico de bancada sem exigência de comprimento mínimo | **SIM** | NÃO | Permite contornar laudo técnico com caracteres arbitrários |

---

## 26. Check Final de Auditoria

- [x] Backend testado (174 testes passando)
- [x] Frontend testado (21 testes passando, lint aprovado, build aprovado)
- [x] Segurança testada (JWT, cookies, CORS, XSS, injeções)
- [x] Autenticação testada (login, credenciais inválidas, inativos)
- [x] Autorização testada (`ROLE_ADMIN` exigido para rotas `/api/**`)
- [x] JWT testado (assinatura HMAC-SHA256, expiração, claims)
- [x] Refresh token testado (rotação, expiração, family revoke)
- [x] IDOR testado (proteção em remoção de itens e validações cruzadas)
- [x] Estoque testado (baixa, ajuste, devolução, integridade de saldo)
- [x] Concorrência testada (bloqueio pessimista de escrita em produtos)
- [x] OS testada (ciclo de vida e transições de status)
- [x] Cancelamento testado (estorno atômico de peças de volta ao estoque)
- [x] Histórico testado (auditoria de mutações e movimentações de estoque)
- [x] Financeiro testado (mão de obra + peças - desconto, total não negativo, congelamento de preço)
- [x] CSV testado (RFC 4180, delimitador `;`, BOM UTF-8, comportamento paginado)
- [x] PDF testado (OpenPDF, layout A4 vetorial, integridade de campos)
- [x] WhatsApp testado (sanitização de telefone, link wa.me, revisão manual)
- [x] Horímetro testado (validação decimal estrita, vírgulas, espaços e negativos)
- [x] Busca testada (Busca rápida unificada via `/api/busca/rapida` e atalho `Ctrl+K`)
- [x] Paginação testada (`PageResponse`, páginas vazias e limites)
- [x] Responsividade testada (telas compactas 1366x768 @ 125%, `overflow-x-auto`)
- [x] Banco revisado (PostgreSQL Neon, constraints, chaves estrangeiras)
- [x] Flyway revisado (Migrations V1 a V9 íntegras e validadas)
- [x] Dependências revisadas (`npm audit` com 0 vulnerabilidades)
- [x] Documentação comparada (alinhamento integral ao domínio industrial/elétrico)
- [x] CI validado (pipeline verde no GitHub Actions com Node 22 e Postgres efêmero)
- [x] **Nenhuma alteração de código aplicada durante a auditoria (auditoria pura de inspeção)**

---

## 27. STATUS QA FINAL

### **STATUS QA: REPROVADO**

**Justificativa Técnica Objetiva:**
Conforme as diretrizes e critérios estritos de governança da auditoria **QA Master 2.0**, a existência de qualquer não-conformidade classificada como **P1** impede a concessão de aprovação ou aprovação com ressalvas.

A constatação comprovada e reproduzida da **ISSUE-001** — na qual a camada de serviço do backend (`OrdemServicoService.criar` e `MaquinaService.criar`) não valida o status de inativação de clientes e equipamentos, permitindo a abertura de Ordens de Serviço para entidades inativas diretamente via API — constitui uma quebra de integridade de regra crítica de negócio. Adicionalmente, a limitação de exportação da **ISSUE-002** (P2) restringe a confiabilidade dos relatórios gerenciais consolidados em CSV.

A aplicação encontra-se estruturalmente muito próxima da aprovação final (174 testes de backend e 21 de frontend verdes, CI estável, persistência íntegra). As 6 correções pontuais catalogadas neste relatório devem ser autorizadas para implementação em uma etapa específica subsequente de saneamento.
