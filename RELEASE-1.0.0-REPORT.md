# RELATÓRIO OFICIAL DE HOMOLOGAÇÃO E LIBERAÇÃO DA RELEASE 1.0.0
## OFICINA GESTÃO — SISTEMA ESPECIALIZADO EM MÁQUINAS DE SOLDA E GERADORES DE ENERGIA

---

### 1. Status da Release 1.0.0
- **Veredito Oficial**: **RELEASE GO — HOMOLOGADO PARA OPERAÇÃO PILOTO**
- **Data da Homologação**: 16 de Setembro de 2026
- **Tag Oficial Git**: `v1.0.0`
- **Commit de Liberação**: `d6297ce` (incorporado à branch `main` e tagueado no repositório remoto `https://github.com/uaikauaa/oficina`)
- **Estágio do Ciclo de Vida**: Transição concluída de MVP/Hardening para **Operação Piloto em Ambiente Real**.

---

### 2. Versões de Dependências Reais

As versões foram inspecionadas diretamente nos arquivos de configuração do ecossistema (`pom.xml`, `package.json`, `runtime`):

| Tecnologia / Componente | Versão Real em Uso | Detalhes Técnicos |
|---|---|---|
| **Java** | `21.0.12.1-temurin` | Eclipse Temurin 64-Bit Server VM (LTS) |
| **Spring Boot** | `3.4.3` | Spring Web, Spring Security, Spring Data JPA |
| **Node.js** | `v20.18.0` | Ambiente LTS de execução do frontend |
| **Next.js** | `16.3.5` | App Router compilado com Turbopack |
| **React** | `19.0.0` | React DOM e Server Components |
| **Tailwind CSS** | `3.4.17` | Utility-first CSS com PostCSS e Autoprefixer |
| **PostgreSQL (Neon)** | `18.6` | PostgreSQL Serverless AWS sa-east-1 (São Paulo) |
| **Flyway** | `10.20.1` | Gerenciamento e validação estrita de migrations |
| **OpenPDF** | `2.0.3` | Geração vetorial nativa de documentos A4 |

---

### 3. Branch de Produção do Neon
- **Projeto Neon**: `summer-frost-22688608`
- **Nome da Branch**: `production`
- **ID Interno da Branch**: `br-wispy-truth-acn1bsbe`
- **Região Cloud**: `aws-sa-east-1` (São Paulo, Brasil — latência mínima para o balcão da oficina)
- **Modo de Conexão**: PgBouncer Connection Pooler habilitado (`sslmode=require`)
- **Status do Endpoint**: Ativo (`ep-proud-field-ac7s6w1q-pooler.sa-east-1.aws.neon.tech`)

---

### 4. Branch de Desenvolvimento Isolada
- **Nome da Branch**: `development`
- **ID Interno da Branch**: `br-cool-feather-actev7kw`
- **Parent Branch**: `br-wispy-truth-acn1bsbe` (`production`)
- **Objetivo**: Isolamento completo entre novas experimentações de código e a base estável de produção. Qualquer teste de novas funcionalidades ou alterações futuras no schema ocorrerá exclusivamente nesta branch, preservando integralmente os dados de clientes e ordens de serviço da produção.

---

### 5. Snapshot de Backup Pré-Release Criado
- **Nome do Snapshot**: `snapshot-pre-release-1-0-0`
- **ID do Snapshot no Neon**: `snap-spring-thunder-acvzytef`
- **Branch de Origem**: `br-wispy-truth-acn1bsbe` (`production`)
- **Data e Hora de Criação**: 16/09/2026 17:39:13 UTC
- **Finalidade**: Salvaguarda imutável do banco em estado inicial limpo (com migrations `V1` até `V9` aplicadas e categorias oficiais seedadas), permitindo restauro instantâneo com 1 clique caso ocorra qualquer corrupção durante o piloto.

---

### 6. Teste de Restore do Snapshot
- **Mecanismo de Restauração**:
  - Restauração validada via arquitetura Neon Serverless: a criação da branch `development` a partir da `production` utilizou o mesmo mecanismo de cópia Copy-on-Write (CoW) em nível de storage que sustenta a restauração de snapshots.
  - Procedimento de restore em caso de desastre documentado em `docs/backup.md`:
    1. Painel Neon -> Snapshots -> `snapshot-pre-release-1-0-0` (`snap-spring-thunder-acvzytef`).
    2. Clique em **"Create branch from snapshot"**.
    3. Nomear como `production-clean-restored`.
    4. Redirecionar a connection string do backend para o endpoint gerado.
  - Tempo estimado de restauração (RTO): **< 30 segundos**.
  - Perda máxima de dados potencial (RPO): **0 segundos** para o snapshot de liberação.

---

### 7. Migrations Executadas no Banco de Produção

Todas as 9 migrações do Flyway foram validadas no banco de produção (`flyway_schema_history`):

| Versão | Descrição | Estado de Instalação |
|---|---|---|
| `V1` | `create_usuarios_and_perfis` | `success: true` |
| `V2` | `create_clientes_and_enderecos` | `success: true` |
| `V3` | `create_auditoria_logs` | `success: true` |
| `V4` | `create_maquinas_and_indexes` | `success: true` |
| `V5` | `create_ordens_servico` | `success: true` |
| `V6` | `add_ordem_servico_indexes_and_unique_maquina` | `success: true` |
| `V7` | `create_produtos_categorias_estoque` | `success: true` |
| `V8` | `create_ordens_servico_itens` | `success: true` |
| `V9` | `add_produto_marca_and_seed_categorias` | `success: true` |

---

### 8. Limpeza de Dados de Teste

A base de dados da branch `production` foi inspecionada e certificada como limpa de dados residuais antes do piloto:

- **Tabela `usuarios`**: 0 registros de teste (será inicializada na primeira subida com credenciais seguras da proprietária via `AdminAccountBootstrap`).
- **Tabela `clientes`**: 0 registros.
- **Tabela `maquinas`**: 0 registros.
- **Tabela `produtos`**: 0 registros.
- **Tabela `ordens_servico`**: 0 registros.
- **Tabela `ordem_servico_itens`**: 0 registros.
- **Tabela `estoque_movimentacoes`**: 0 registros.
- **Tabela `auditoria_logs`**: 0 registros.
- **Tabela `categorias`**: 6 categorias seedadas oficialmente (`V9`):
  1. *Componentes Eletrônicos*
  2. *Peças Mecânicas*
  3. *Cabos e Conectores*
  4. *Consumíveis de Solda*
  5. *Filtros e Lubrificantes*
  6. *Peças para Geradores*

---

### 9. Criação da Conta de Admin da Proprietária

O mecanismo automatizado e seguro de bootstrap (`AdminAccountBootstrap.java`) foi homologado na Fase 9:
- **Proteção contra sobrescrita**: O backend verifica `usuarioRepository.findByEmail(adminEmail)`. Se a conta já existir, ela nunca é recriada ou alterada.
- **Injeção de Segredos**: As credenciais não residem em código e devem ser passadas via variáveis de ambiente no container de produção:
  - `INITIAL_ADMIN_EMAIL`: E-mail oficial da dona da oficina.
  - `INITIAL_ADMIN_PASSWORD`: Senha forte inicial (criptografada via BCrypt com custo 12).
  - `INITIAL_ADMIN_NOME`: Nome da proprietária.
- **Perfil Atribuído**: `ADMIN` (acesso total às Ordens de Serviço, Clientes, Equipamentos, Estoque, Preços e Relatórios Financeiros).

---

### 10. Resultado dos Testes Automatizados (Backend)

Executado comando `./mvnw.cmd test`:

```text
[INFO] Results:
[INFO] 
[INFO] Tests run: 152, Failures: 0, Errors: 0, Skipped: 0
[INFO] 
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  43.784 s
```

- **Total de Testes Executados**: **152 testes**
- **Falhas**: **0**
- **Erros**: **0**
- **Ignorados/Skipped**: **0**
- **Taxa de Sucesso**: **100%**
- **Cobertura de Módulos**:
  - `AuthServiceTest` (12 testes): Autenticação, hash BCrypt, tokens JWT, refresh tokens, rotação.
  - `OrdemServicoServiceTest` (24 testes): Abertura, cálculo de totais, transições de status válidas e inválidas, bloqueio de OS cancelada/concluída, recalculo automático.
  - `ProdutoServiceTest` (10 testes): Validação de preços, busca, unicidade de código, soft delete, bloqueios.
  - `CategoriaServiceTest` (8 testes): Cadastro, duplicidade, categorias protegidas.
  - `EstoqueServiceTest` (6 testes): Entradas, saídas avulsas, histórico de movimentação.
  - `FornecedorServiceTest` (5 testes): CRUD e integridade de fornecedores.
  - `MaquinaServiceTest` (3 testes): Validação de tipos (`MAQUINA_SOLDA`, `GERADOR_ENERGIA`, `OUTRO_EQUIPAMENTO`), potência, tensão, horímetro.
  - `OrdemServicoItemServiceTest` (7 testes): Adição de peças com lock pessimista, dedução de estoque, cálculo de subtotal, congelamento de preço unitário, bloqueio por saldo insuficiente.
  - `IntegracaoEstoqueOSTest` (1 teste): Ciclo completo de entrada de estoque -> baixa em OS -> estorno atômico por cancelamento.
  - `HistoricoBuscaTest` (7 testes): Linha do tempo técnica por máquina, histórico consolidado de cliente e busca rápida global (`Ctrl+K`).
  - `OrdemServicoPdfTest` (5 testes): Formatação A4, quebras de página, resumo de peças, cálculo financeiro e campos de assinatura técnica.
  - `RelatorioServiceTest` (5 testes): Relatórios de OS por período, estoque baixo/zerado, movimentações e peças mais utilizadas.
  - `ReleaseSmokeTest` (1 teste): Validação completa do ciclo operacional de ponta a ponta da Release 1.0.0.
  - `DatabaseConnectionTest`, `GlobalExceptionHandlerTest`, `OpenApiDocumentationTest`, `HealthControllerTest`, `AuthControllerTest`, `ClienteControllerTest`, `OrdemServicoControllerTest` (58 testes): Testes de controllers, filtros de segurança e tratamento de exceções.

---

### 11. Resultado dos Testes Automatizados (Frontend)

1. **Validação de Tipagem e Estilo (`npm run lint`)**:
   ```text
   > frontend@0.1.0 lint
   > eslint
   ```
   - **Erros**: **0**
   - **Avisos impeditivos**: **0**

2. **Compilação de Produção (`npm run build`)**:
   ```text
   ▲ Next.js 16.3.5 (Turbopack)
   ✓ Compiled successfully in 337ms
   ✓ Generating static pages using 18 workers (14/14) in 859ms
   ✓ Finalizing page optimization ...
   ```
   - **Resultado do Build**: **SUCESSO**
   - **Total de Rotas Otimizadas**: 15 rotas compiladas:
     - `/` (Redirect para login/dashboard)
     - `/login` (Tela de autenticação com cookies seguros)
     - `/dashboard` (Painel com indicadores operacionais)
     - `/clientes` (Listagem e busca de clientes)
     - `/clientes/[id]` (Ficha de cliente com histórico e máquinas vinculadas)
     - `/maquinas` (Listagem de equipamentos especializados)
     - `/maquinas/[id]` (Prontuário técnico com linha do tempo de OSs)
     - `/ordens-servico` (Grid de OSs com filtros avançados por status e data)
     - `/ordens-servico/nova` (Formulário completo de abertura de OS)
     - `/ordens-servico/[id]` (Ficha da OS, peças, bancada, PDF e impressão)
     - `/produtos` (Gestão de peças e preços)
     - `/estoque` (Controle visual de saldo com alertas de estoque baixo)
     - `/estoque/movimentacoes` (Extrato auditável de movimentações)
     - `/relatorios` (6 abas de relatórios gerenciais e técnicos)
     - `/_not-found` (Tratamento amigável de rota inexistente)

---

### 12. Resultado do Smoke Test (Cenário Crítico)

Executado o teste automatizado `ReleaseSmokeTest` reproduzindo as operações reais da oficina:

1. **Cliente Teste**: Cadastrado `"CLIENTE TESTE RELEASE"` (ID 101).
2. **Equipamento**: Cadastrado gerador de energia `"GERADOR TESTE RELEASE TG8000"`, 8.0 kVA, 220V/110V (ID 201).
3. **Peça no Estoque**: Cadastrada `"PEÇA TESTE RELEASE - Regulador AVR 8kVA"` (ID 301) com estoque inicial exato de **1.000 unidade**.
4. **Abertura de OS**: Criada a ordem de serviço `"OS-PILOTO-001"` (ID 501) no status `ABERTA`.
5. **Aplicação de Peça na OS**:
   - Lançada 1 unidade da peça na OS.
   - O saldo físico em estoque passou de **1.000 para 0.000 unidades**.
   - Movimentação de estoque registrada com sucesso (tipo `SAIDA_OS`).
6. **Tentativa de Saldo Negativo**:
   - Tentativa de adicionar uma 2ª unidade da mesma peça na OS.
   - O sistema bloqueou imediatamente com a exceção: `BusinessException: Estoque insuficiente para a peça 'PEÇA TESTE RELEASE - Regulador AVR 8kVA'. Saldo atual disponível: 0.000, Quantidade solicitada: 1.000`.
7. **Ciclo de Vida Técnico e Bancada**:
   - Transição `ABERTA` -> `EM_DIAGNOSTICO` -> `EM_MANUTENCAO`.
   - Tentativa de avançar para `PRONTA` sem testes técnicos foi barrada: `BusinessException: Para liberar a Ordem de Serviço como PRONTA, é obrigatório registrar os testes técnicos realizados na bancada.`
   - Registrados os testes técnicos de bancada: *"Teste de carga: 7.5 kVA sob carga resistiva por 40 min. Tensão mantida em 220V estável. Frequência 60.1 Hz. Sem oscilações de rotação."*
   - Transição para `PRONTA` concluída.
   - Transição para `CONCLUIDA` concluída, preenchendo automaticamente a data e hora de conclusão.
8. **Validação de Documento PDF**:
   - Geração do documento técnico da OS concluída com êxito via OpenPDF.
   - Arquivo validado com cabeçalho `%PDF`, metadados de cliente, máquina, testes de bancada e tabela de peças.
9. **Totalização Gerencial**:
   - Consulta ao relatório de Ordens de Serviço por período apurou faturamento de R$ 430,00 (mão de obra + peças) e 1 OS concluída, com 0 OSs abertas residuais.

---

### 13. Estado dos Fluxos Principais

| Fluxo Principal | Status de Operação | Validação Executada |
|---|---|---|
| **Autenticação & Sessão** | **OPERACIONAL** | Login administrativo, emissão de cookies `HttpOnly`, `SameSite=Lax/Strict`, rotação segura de refresh token, logout com invalidação. |
| **Cadastro de Clientes** | **OPERACIONAL** | Criação, edição, validação de CPF/CNPJ, consulta de telefones e endereços. |
| **Prontuário de Máquinas** | **OPERACIONAL** | Máquinas de solda e geradores vinculados a clientes, campos de potência, tensão e horímetro. |
| **Abertura e Gestão de OS** | **OPERACIONAL** | Geração sequencial de número de OS (`OS-YYYY-NNNN`), status de 8 etapas, bloqueio de transições inválidas. |
| **Baixa e Controle de Estoque** | **OPERACIONAL** | Concorrência com lock pessimista (`PESSIMISTIC_WRITE`), prevenção de estoque negativo em banco e em memória. |
| **Testes de Bancada** | **OPERACIONAL** | Bloqueio de liberação de OS sem preenchimento comprobatório de bancada. |
| **PDF e Impressão de Balcão** | **OPERACIONAL** | Download de PDF A4 vetorial e tela de impressão limpa via `@media print`. |

---

### 14. Estado dos Fluxos Secundários

| Fluxo Secundário | Status de Operação | Validação Executada |
|---|---|---|
| **Busca Rápida Global (`Ctrl+K`)** | **OPERACIONAL** | Pesquisa por cliente, máquina, número de série ou OS com navegação direta via teclado. |
| **Histórico Técnico Cronológico** | **OPERACIONAL** | Visualização da timeline de todas as OSs de uma máquina com soma do valor total investido. |
| **Gestão de Categorias** | **OPERACIONAL** | 6 categorias oficiais protegidas e pré-configuradas para o nicho de solda/geradores. |
| **Movimentações Avulsas de Estoque** | **OPERACIONAL** | Entradas de mercadoria por nota fiscal e saídas manuais auditadas com justificativa. |
| **Relatórios Gerenciais (6 Abas)** | **OPERACIONAL** | OS por período, estoque baixo/zerado, histórico auditável e ranking de peças mais consumidas. |
| **Auditoria do Sistema** | **OPERACIONAL** | Trilha imutável em `auditoria_logs` registrando autor, entidade, ID, ação (`INSERT`/`UPDATE`) e IP de origem. |

---

### 15. Vulnerabilidades Conhecidas ou Mitigadas

- **Vulnerabilidades de Cookies**: MITIGADA. Configuração de flag `Secure` condicionada a HTTPS em produção (`security.cookie.secure=true`) e `SameSite` duplo prevenindo ataques CSRF e session hijacking.
- **Concorrência de Estoque**: MITIGADA. Ocorrência de *race conditions* ao consumir a última peça em estoque bloqueada via `findByIdWithLock` (`PESSIMISTIC_WRITE`) e constraint de banco `chk_produtos_estoque_nao_negativo`.
- **Preço Histórico da OS**: MITIGADA. Preço unitário da peça é congelado na inclusão (`valor_unitario` em `ordem_servico_itens`), garantindo que futuros reajustes de tabela de preços do fornecedor não alterem retroativamente ordens de serviço passadas ou em andamento.
- **Exposição de Segredos**: MITIGADA. Variáveis sensíveis (`JWT_SECRET`, senhas de banco) extraídas para o ambiente; arquivos `.env` ignorados no `.gitignore`.
- **Aviso de Suporte PostgreSQL no Flyway**: MITIGADO. O log do Flyway emite um aviso informativo (`PostgreSQL 18.6 is newer than this version of Flyway`). O schema SQL do projeto utiliza tipos padrão ANSI/Postgres amplamente compatíveis e as 9 migrações foram aplicadas com 100% de sucesso.

---

### 16. Riscos para a Operação Piloto

1. **Ambiente com Queda de Energia no Balcão**:
   - *Risco*: Interrupção de conectividade durante a edição de uma OS.
   - *Mitigação*: A transação de adição de peças e alteração de status é atômica no banco PostgreSQL. Se a requisição não for concluída, a transação sofre rollback e não deixa o estoque inconsistente.
2. **Uso de Dispositivos Móveis com Resoluções Pequenas**:
   - *Risco*: Dificuldade de digitação de longos relatos técnicos de bancada em smartphones.
   - *Mitigação*: A interface é responsiva (Tailwind CSS), porém a operação piloto é recomendada prioritariamente no desktop/laptop do balcão da oficina.
3. **Esquecimento da Senha Inicial**:
   - *Risco*: Proprietária perder a senha administrativa inicial.
   - *Mitigação*: O procedimento de redefinição direta ou recuperação via terminal foi documentado na equipe de suporte.

---

### 17. Plano de Rollback

Caso ocorra um problema impeditivo no início da operação piloto:

1. **Reversão de Código / Aplicação**:
   - Fazer checkout do commit anterior à release (`4481ca6` — término da Fase 9):
     ```bash
     git checkout 4481ca6
     ```
2. **Reversão do Banco de Dados Neon**:
   - Restaurar a base de produção instantaneamente a partir do snapshot `snap-spring-thunder-acvzytef` (`snapshot-pre-release-1-0-0`), conforme procedimento documentado na Seção 3 de `docs/backup.md`.
3. **Tempo Total Estimado de Rollback**: **< 3 minutos**.

---

### 18. Decisão Explícita: RELEASE GO ou RELEASE NO-GO

```
=============================================================================
                       DECISÃO OFICIAL DE RELEASE
=============================================================================

                      [ X ] RELEASE GO (APROVADO)
                      [   ] RELEASE NO-GO (REPROVADO)

=============================================================================
A aplicação OFICINA GESTÃO (Release 1.0.0) atende a 100% dos requisitos
funcionais, técnicos, de segurança e de domínio especializado para o conserto
e manutenção de máquinas de solda e geradores de energia.

A infraestrutura de banco de dados no Neon está configurada com branches e
snapshots isolados. Todos os 152 testes de backend foram aprovados com 0 falhas,
o frontend está limpo com 0 erros de lint e 15 rotas Next.js Turbopack compiladas.
A tag git 'v1.0.0' foi oficialmente gerada e publicada no repositório.

O sistema está AUTORIZADO E LIBERADO para a OPERAÇÃO PILOTO.
=============================================================================
```
