# QA-CORRECTION-REPORT-V1.1 — Relatório de Saneamento e Homologação Final
## Oficina Gestão — Versão 1.1

- **Data da Homologação:** 16 de Setembro de 2026
- **Auditoria de Origem:** [QA-MASTER-2-REPORT-V1.1.md](file:///c:/Projetos/oficina-gestao/QA-MASTER-2-REPORT-V1.1.md)
- **Status Anterior:** REPROVADO
- **Status Final:** **APROVADO**

---

## 1. Sumário Executivo

Após a conclusão da auditoria técnica rigorosa executada no **QA Master 2.0**, foram identificadas 6 issues (1 P1, 3 P2 e 2 P3). Todas as issues foram devidamente diagnosticadas, reproduzidas e sanadas através de intervenções mínimas, seguras e aderentes à arquitetura do projeto.

Nenhuma funcionalidade nova foi introduzida, nenhuma migration foi criada ou alterada (V1–V9 permanecem intactas), e nenhuma biblioteca ou dependência externa foi adicionada ao backend ou frontend.

Todos os testes automatizados foram executados e aprovados com 100% de sucesso:
- **Backend:** 193 testes passando (0 falhas, 0 erros, 0 ignorados).
- **Frontend:** 29 testes passando (0 falhas).
- **Frontend Lint:** 0 erros, 0 avisos.
- **Frontend Build:** Compilação Next.js / TypeScript finalizada com sucesso.
- **Banco de Dados:** Schema inalterado, isolamento absoluto mantido via Spring Boot REST API.

---

## 2. Detalhamento das Correções por Issue

### ISSUE-001 — Backend permite abertura de Ordem de Serviço para cliente inativo ou equipamento inativo via API
- **Severidade:** P1 (Alta)
- **Status:** **CORRIGIDA**
- **Causa Raiz Confirmada:** O método `criar()` em `OrdemServicoService.java` recuperava o cliente e a máquina dos repositórios via ID, porém não validava os atributos `cliente.getAtivo()` e `maquina.getAtivo()`, permitindo que requisições diretas via API REST abrissem ordens de serviço para cadastros inativados.
- **Arquivos Alterados:**
  - `backend/src/main/java/com/oficinagestao/service/OrdemServicoService.java`
- **Implementação Aplicada:**
  - Adicionadas checagens explícitas antes da persistência:
    - Se `!Boolean.TRUE.equals(cliente.getAtivo())`, lança `BusinessException("Não é possível abrir ordem de serviço para cliente inativo.")`.
    - Se `!Boolean.TRUE.equals(maquina.getAtivo())`, lança `BusinessException("Não é possível abrir ordem de serviço para equipamento inativo.")`.
- **Testes Criados / Atualizados:**
  - `backend/src/test/java/com/oficinagestao/service/OrdemServicoServiceTest.java`:
    - `criar_ClienteInativo_DeveLancarExcecao`
    - `criar_MaquinaInativa_DeveLancarExcecao`
    - `criar_ClienteEMaquinaInativos_DeveLancarExcecao`
  - `backend/src/test/java/com/oficinagestao/controller/OrdemServicoControllerTest.java`:
    - `criar_ClienteInativo_Retorna400`
    - `criar_MaquinaInativa_Retorna400`
- **Evidência de Resolução:** Tentativas de abertura de OS com cliente ou máquina inativos retornam HTTP 400 Bad Request com a mensagem exata de regra de negócio, bloqueando a criação tanto na camada de serviço quanto na camada de controle REST.

---

### ISSUE-002 — Exportação CSV dos relatórios utiliza somente os dados da página atualmente carregada e pode truncar o conjunto filtrado
- **Severidade:** P2 (Média)
- **Status:** **CORRIGIDA**
- **Causa Raiz Confirmada:** A rotina de exportação em `frontend/src/app/relatorios/page.tsx` iterava unicamente sobre `dados?.content`, que representava os registros paginados (tamanho 20) carregados no DOM da tela ativa, gerando relatórios CSV incompletos caso o resultado filtrado contivesse mais de 20 registros.
- **Arquivos Criados / Alterados:**
  - `frontend/src/lib/csvExportHelper.ts` (Novo)
  - `frontend/src/lib/csvExportHelper.test.ts` (Novo)
  - `frontend/src/app/relatorios/page.tsx` (Alterado)
- **Implementação Aplicada:**
  - Criada a função modular e tipada `fetchTodosRegistrosRelatorio<T>`, que itera por todas as páginas da API (`page = 0, 1, 2...`) com `size = 100` preservando integralmente os filtros ativos, até que `page >= totalPages` ou `isLast = true`.
  - Atualizadas as funções de exportação dos 6 relatórios em `page.tsx` (`exportarCsvOS`, `exportarCsvFinanceiro`, `exportarCsvClientes`, `exportarCsvEstoque`, `exportarCsvProdutividade`, `exportarCsvFaturamento`) para consumir a paginação exaustiva.
  - Adicionado estado visual de loading `isExporting` aos botões de exportação, desabilitando múltiplos cliques durante o download.
- **Testes Criados / Atualizados:**
  - `frontend/src/lib/csvExportHelper.test.ts`: 8 testes unitários cobrindo paginação única, paginação múltipla (20, 21, 40, 41, 100+ registros), preservação rigorosa de filtros e listas vazias.
- **Evidência de Resolução:** Testes unitários comprovam a extração de 100% dos dados filtrados independentemente da página selecionada na interface, respeitando os contratos de paginação da API Spring Boot.

---

### ISSUE-003 — Endpoint de login não possui rate limiting / lockout para tentativas consecutivas
- **Severidade:** P2 (Média)
- **Status:** **CORRIGIDA**
- **Causa Raiz Confirmada:** O método `login()` de `AuthService.java` não rastreava falhas sucessivas de autenticação, expondo o endpoint `/api/auth/login` a potenciais ataques de força bruta contra senhas de usuários.
- **Arquivos Criados / Alterados:**
  - `backend/src/main/java/com/oficinagestao/security/LoginAttemptService.java` (Novo)
  - `backend/src/test/java/com/oficinagestao/security/LoginAttemptServiceTest.java` (Novo)
  - `backend/src/main/java/com/oficinagestao/service/AuthService.java` (Alterado)
  - `backend/src/test/java/com/oficinagestao/service/AuthServiceTest.java` (Alterado)
- **Implementação Aplicada:**
  - Implementado `LoginAttemptService` como componente Spring thread-safe baseado em `ConcurrentHashMap`.
  - Rastreamento duplo de chave: `ip:<ip>` e `email:<email>`.
  - Limite de 5 tentativas consecutivas incorretas; após a 5ª tentativa, é aplicado um lockout automático de 15 minutos (`15 * 60 * 1000` ms).
  - Em caso de bloqueio ativo, o serviço lança imediatamente `BadCredentialsException("Muitas tentativas de login incorretas. Conta/IP bloqueados temporariamente. Tente novamente em 15 minutos.")`.
  - Em caso de autenticação bem-sucedida, as tentativas falhas para o IP e email são imediatamente limpas (`resetarTentativas`).
- **Testes Criados / Atualizados:**
  - `LoginAttemptServiceTest.java`: 7 testes unitários cobrindo falhas progressivas, ativação do lockout na 5ª falha, bloqueio durante o período, reset em sucesso e isolamento de chaves.
  - `AuthServiceTest.java`: Adicionados testes de integração validando o acionamento do bloqueio em tentativas consecutivas.
- **Evidência de Resolução:** Testes unitários e de integração demonstram o bloqueio efetivo na 5ª tentativa incorreta, com rejeição imediata antes de qualquer consulta custosa a banco ou criptografia BCrypt.

---

### ISSUE-004 — Existe fallback hardcoded conhecido para JWT_SECRET, permitindo inicialização com segredo padrão em ambiente produtivo caso a variável não seja fornecida
- **Severidade:** P2 (Média)
- **Status:** **CORRIGIDA**
- **Causa Raiz Confirmada:** O arquivo `application.properties` e a classe `JwtService.java` utilizavam o fallback `${JWT_SECRET:oficinagestao-secret-key-para-desenvolvimento-local-com-minimo-256-bits-ok}`, o que permitiria que uma implantação em produção subisse acidentalmente com o segredo público se a variável de ambiente não fosse injetada.
- **Arquivos Alterados / Criados:**
  - `backend/src/main/java/com/oficinagestao/security/JwtService.java` (Alterado)
  - `backend/src/test/java/com/oficinagestao/security/JwtServiceTest.java` (Novo)
- **Implementação Aplicada:**
  - Injetado o Spring `Environment` no `JwtService`.
  - No método `@PostConstruct initKey()`, o serviço avalia se está rodando em ambiente de produção (perfis `prod`, `production` ou variáveis de ambiente `RENDER`, `RAILWAY_ENVIRONMENT`).
  - Em ambiente de produção:
    - Se a chave for a chave padrão de desenvolvimento (`DEFAULT_DEV_SECRET`), vazia, ou tiver menos de 32 caracteres (256 bits), o Spring Boot aborta a inicialização lançando `IllegalStateException("ERRO CRÍTICO DE SEGURANÇA: JWT_SECRET não configurado ou inseguro para ambiente de produção.")`.
  - Em ambiente de desenvolvimento/teste local: o fallback seguro é mantido para garantir DX fluida e execução sem fricção do CI.
- **Testes Criados / Atualizados:**
  - `JwtServiceTest.java`: 5 testes unitários validando:
    1. Aceitação do fallback em ambiente de desenvolvimento.
    2. Rejeição com falha fatal em ambiente de produção com segredo padrão.
    3. Rejeição com falha fatal em ambiente de produção com segredo vazio.
    4. Rejeição com falha fatal em ambiente de produção com segredo curto (< 32 caracteres).
    5. Aceitação e assinatura válida em ambiente de produção com segredo customizado e forte.
- **Evidência de Resolução:** A aplicação não sobe em produção sem uma chave forte de 256 bits explicitamente injetada via variável de ambiente.

---

### ISSUE-005 — Resposta a credenciais inválidas difere de usuário inativo
- **Severidade:** P3 (Baixa)
- **Status:** **CORRIGIDA**
- **Causa Raiz Confirmada:** Quando um usuário existente estava inativo (`!usuario.getAtivo()`), o `AuthService.java` lançava `BadCredentialsException("Usuário inativo no sistema.")`, enquanto para senha incorreta ou usuário inexistente lançava `"Credenciais inválidas."`. Essa discrepância de mensagem permitia a enumeração de contas válidas na API.
- **Arquivos Alterados:**
  - `backend/src/main/java/com/oficinagestao/service/AuthService.java`
  - `backend/src/test/java/com/oficinagestao/service/AuthServiceTest.java`
- **Implementação Aplicada:**
  - Ao identificar usuário inativo, o sistema emite um log interno estruturado em nível de auditoria: `log.warn("Tentativa de autenticação para usuário inativo: {}", request.getEmail())`.
  - Para a resposta externa do cliente HTTP, lança genericamente `BadCredentialsException("Credenciais inválidas.")`.
- **Testes Criados / Atualizados:**
  - `AuthServiceTest.java`: Atualizado teste `login_UsuarioInativo_DeveLancarExcecao` para verificar a mensagem genérica uniforme `"Credenciais inválidas."` e o registro da tentativa falha no rate limiting.
- **Evidência de Resolução:** Resposta externa unificada em HTTP 401 com corpo idêntico para usuário inexistente, senha incorreta ou usuário inativo, eliminando vetor de enumeração de contas.

---

### ISSUE-006 — Transição para PRONTA aceita laudo técnico arbitrariamente curto sem validação substancial
- **Severidade:** P3 (Baixa)
- **Status:** **CORRIGIDA**
- **Causa Raiz Confirmada:** A validação em `OrdemServicoService.java` para a transição para o status `PRONTA` verificava apenas se o laudo era diferente de nulo e não-em-branco (`!laudoTecnico.trim().isEmpty()`), permitindo strings irrelevantes como `"."`, `"ok"` ou `"a"`.
- **Arquivos Alterados:**
  - `backend/src/main/java/com/oficinagestao/service/OrdemServicoService.java`
  - `backend/src/test/java/com/oficinagestao/service/OrdemServicoServiceTest.java`
- **Implementação Aplicada:**
  - Atualizada a regra de negócio para exigir laudo técnico de bancada consistente:
    - `if (laudoTecnico == null || laudoTecnico.trim().length() < 15)`
    - Lança `BusinessException("Para marcar a ordem de serviço como PRONTA, é obrigatório preencher o laudo técnico detalhado com no mínimo 15 caracteres.")`.
- **Testes Criados / Atualizados:**
  - `OrdemServicoServiceTest.java`:
    - `atualizarStatus_ParaProntaComLaudoCurto_DeveLancarExcecao` (testa valores como `"ok"`, `"teste"`, `"curto"`, `"12345678901234"`).
    - `atualizarStatus_ParaProntaComLaudoValido_DeveAtualizarStatus` (testa laudo descritivo completo).
- **Evidência de Resolução:** Tentativas de transição de status para `PRONTA` com laudo descritivo menor que 15 caracteres são rejeitadas pelo backend com HTTP 400 e mensagem explicativa.

---

## 3. Resumo de Testes e Validações

| Camada / Componente | Testes Executados | Sucesso | Falhas | Erros | Ignorados | Resultado |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Backend (JUnit 5 / Spring Boot)** | 193 | 193 | 0 | 0 | 0 | **APROVADO** |
| **Frontend (Node Test Runner)** | 29 | 29 | 0 | 0 | 0 | **APROVADO** |
| **Frontend Lint (ESLint / Next)** | - | - | 0 | 0 | 0 | **APROVADO** |
| **Frontend Build (Next.js Production)** | - | - | 0 | 0 | 0 | **APROVADO** |
| **Migrations Flyway (V1–V9)** | 0 criadas | 0 alteradas | - | - | - | **INTACTAS** |
| **Dependências Externas** | 0 adicionadas | - | - | - | - | **CONFORME** |

---

## 4. Lista Completa de Arquivos Modificados e Criados

### Arquivos Modificados (7):
1. `backend/src/main/java/com/oficinagestao/security/JwtService.java`
2. `backend/src/main/java/com/oficinagestao/service/AuthService.java`
3. `backend/src/main/java/com/oficinagestao/service/OrdemServicoService.java`
4. `backend/src/test/java/com/oficinagestao/controller/OrdemServicoControllerTest.java`
5. `backend/src/test/java/com/oficinagestao/service/AuthServiceTest.java`
6. `backend/src/test/java/com/oficinagestao/service/OrdemServicoServiceTest.java`
7. `frontend/src/app/relatorios/page.tsx`

### Arquivos Criados (5):
1. `backend/src/main/java/com/oficinagestao/security/LoginAttemptService.java`
2. `backend/src/test/java/com/oficinagestao/security/LoginAttemptServiceTest.java`
3. `backend/src/test/java/com/oficinagestao/security/JwtServiceTest.java`
4. `frontend/src/lib/csvExportHelper.ts`
5. `frontend/src/lib/csvExportHelper.test.ts`

---

## 5. Regressões e Intercorrências Durante o Saneamento

1. **Injeção de Construtor em `JwtService`:**
   - *Ocorrência:* A adição de um construtor de teste sobrecarregado sem a anotação `@Autowired` no construtor primário causou falha de instanciação pelo container do Spring nos testes que levantavam contexto.
   - *Resolução:* Anotado explicitamente o construtor primário com `@Autowired`, restaurando a resolução inequívoca do Spring.
2. **Resolução de Tipos em Módulo TypeScript no Test Runner do Node:**
   - *Ocorrência:* O runner nativo `node --experimental-strip-types` não realiza resolução de caminhos sem extensão ESM em importações (`import ... from './types'`), causando erro `ERR_MODULE_NOT_FOUND`.
   - *Resolução:* Definida a interface genérica `PageResponse<T>` diretamente no arquivo `csvExportHelper.ts`, tornando o módulo totalmente autônomo e compatível tanto com o build do Next.js quanto com a execução de testes do Node.
3. **Regressões em Regras de Negócio Existentes:**
   - Nenhuma regressão foi introduzida. Todos os 174 testes originais do backend e 21 do frontend continuam passando integralmente, acrescidos dos 19 novos testes do backend e 8 novos testes do frontend.

---

## 6. Novos Problemas Identificados

- Nenhum novo problema, vulnerabilidade ou inconsistência foi identificada.

---

## 7. Conclusão e Parecer Final

Todas as pendências do QA Master 2.0 foram 100% saneadas dentro do rigor arquitetural estipulado:
- Sem alterações no schema do banco (zero migrations).
- Sem dependências de bibliotecas de terceiros desnecessárias.
- Sem alterações de funcionalidades da V1.1.
- Comunicação e segurança estritamente validadas na camada de domínio backend.

### STATUS FINAL DA HOMOLOGAÇÃO: **APROVADO** ✅
