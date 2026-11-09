# Etapa 1 — conexão Neon e prontidão administrativa

Data: 9 de novembro de 2026. Referência de código: `5a9beb1816e10dd6c20d592f3dd04305eb476f51`, branch `chore/neon-connection-admin-readiness-audit` baseada no PR #21. Este relatório registra observações sanitizadas. A [matriz de 83 rotas](permission-matrix.md) integra o contrato da etapa 2.

## A. Estado e escopo

`main` remota: `62e8f62d4166f5f9695c49e6588897e31777b038`. PR [#21](https://github.com/uaikauaa/oficina/pull/21) aberto, não integrado, head `5a9beb1`; PRs #20 e #18 também abertos. #18 não foi usado como base. Um único worktree local. Dois PNGs não rastreados preexistiam no frontend e foram preservados. A aplicação local já estava rodando quando esta auditoria começou: Java PID 31944 em `127.0.0.1:8080`, Node PID 33412 em `127.0.0.1:3000`, PostgreSQL local em `127.0.0.1:15434` e Mailpit em `127.0.0.1:8025`. O processo Java possuía conexões TCP estabelecidas com a porta 15434; o Node estabeleceu conexão com a 8080 durante a chamada `/api/health` via frontend. Assim, essa instância local **não** usa Neon. A URL aberta no navegador do operador não foi observada diretamente.

O `.env` da raiz atual contém configuração sintética local, é ignorado pelo Git e foi carregado pelo Java em execução; seus três segredos têm pelo menos 32 caracteres e são distintos. Não foi alterado. `DotenvEnvironmentPostProcessor` lê `.env` do diretório de trabalho, depois `../.env` e `backend/.env`, ignorando o arquivo em profile `test` e preservando variáveis de processo. `SPRING_PROFILES_ACTIVE` dentro do `.env` não ativou o profile `dev` na inicialização observada: o Spring registrou o profile padrão. Para ativar `dev`, fornecê-lo antes de iniciar o processo. O frontend requer `INTERNAL_BACKEND_URL` no próprio ambiente; o arquivo `.env` da raiz não é carregado automaticamente pelo processo Node iniciado em `frontend`. `application.properties` resolve `DB_URL`, `DB_USERNAME` e `DB_PASSWORD` por placeholders; Hikari usa os limites configurados ali. O endpoint ativo deve ser confirmado por processo, não apenas pelo conteúdo atual do arquivo.

**Segredos no pedido:** o texto fornecido contém credenciais aparentes do banco e SMTP, além de chaves aparentes. Tratar esses valores como expostos e planejar rotação nos provedores com procedimento separado e manutenção de acesso. Eles não constam deste relatório nem dos testes. A configuração operacional histórica no container parado não deve ser assumida como atual.

## B. Neon original: execução diagnóstica isolada

Antes da conexão, foi verificado que iniciar o aplicativo completo poderia escrever: `spring.flyway.enabled=true`; `AdminAccountBootstrap` insere em banco vazio; `NotificacaoService` sincroniza registros em `ApplicationReadyEvent`; `RefreshTokenCleanupScheduler` remove tokens vencidos; `SharedRateLimitService` remove buckets expirados. `ConfiguracaoOficinaBootstrap` apenas valida, `spring.jpa.hibernate.ddl-auto=validate` não cria schema, e `/api/health` usa `Connection.isValid`. Por isso **nenhum backend completo foi iniciado com o Neon**. Também não houve login, envio SMTP real, migration, DML, DDL ou teste automatizado comum no Neon.

O diagnóstico Java isolado obteve a configuração histórica do container operacional **parado**, rejeitou URLs com credenciais e hosts fora de `.neon.tech`, abriu conexão JDBC com `sslmode=verify-full` e fábrica de certificados Java padrão, configurou `readOnly=true`, `readOnlyMode=always`, `autoCommit=false` e confirmou `transaction_read_only=on` antes das consultas. Uma segunda execução construiu um `HikariDataSource` isolado, com pool máximo 1 e os mesmos parâmetros, executou `SELECT` e encerrou o pool. Os valores privados só existiram em memória do processo e não foram impressos. A autenticação PostgreSQL, o driver e o HikariCP passaram. A URL histórica aponta para endpoint **pooled**; endpoint direto, ID de projeto, branch, compute e plano contratado não foram confirmados no painel Neon. O banco e a role SQL corresponderam à configuração histórica, mas isso, sozinho, não prova qual projeto/branch o operador visualiza no console.

| Evidência sanitizada | Resultado |
|---|---|
| Banco/usuário/schema e transação | Correspondem à configuração histórica; schema `public`; somente leitura `on` |
| TLS externo | JDBC `verify-full` com verificação de certificado e hostname completou a conexão |
| HikariCP | Pool isolado de 1 conexão abriu, consultou e fechou; repetição com `channelBinding=require` também passou |
| `pg_stat_ssl` | Linha presente; `ssl=false` no trecho interno pooler→PostgreSQL. Não mede o TLS cliente→pooler |
| Flyway | 24 registros válidos, V24 atual, 0 pendentes, validação de 25 migrations descobertas (B24 incluída) |
| Hibernate | Validação de schema de 17 entidades aprovada, sem bootstrap Spring |
| Catálogo | 21 tabelas `public`, 0 views, 205 constraints (21 PK, 21 FK, 12 UNIQUE), 80 índices, 19 sequências e 0 triggers observados |
| Volume SQL | `pg_database_size` = 11.640.832 bytes naquele instante; não equivale ao armazenamento faturado do projeto |

O catálogo SQL e a autenticação estabelecem os níveis A e B de diagnóstico e parte do nível C. **Conexão operacional do backend completo ainda não aprovada**: o aplicativo completo permanece no banco local, e o destino no painel Neon não foi cruzado com o endpoint histórico. Para fechar esse gate, confirmar no console o ID do projeto, branch, compute, banco, usuário, endpoint pooled e endpoint direto oficial. Não inferir o direto retirando `-pooler` do hostname. Obter credencial diagnóstica de leitura restrita, se disponível, para auditorias futuras. Manter o aplicativo completo afastado do Neon até haver plano explícito para seus efeitos de startup e migrations.

O [pooler do Neon](https://neon.com/blog/pgbouncer-the-one-with-prepared-statements) usa PgBouncer em modo transacional. O teste Hikari/JDBC confirma uma consulta curta, não todos os padrões de transação, prepared statements, estado de sessão nem concorrência do aplicativo. Antes de produção, validar em ambiente isolado carga, transações e parâmetros Hikari conforme número máximo de instâncias Cloud Run. Não usar o endpoint pooled para migração ou administração sem orientação do Neon.

O driver fixado em `backend/pom.xml` é pgJDBC 42.7.12. A [documentação do pgJDBC](https://jdbc.postgresql.org/documentation/use/) confirma o parâmetro JDBC `channelBinding=require`; o teste isolado com esse parâmetro passou no endpoint pooled. O valor não está configurado no processo local atual. Qualquer mudança operacional de URL requer revisão separada da configuração efetiva e de rotação de conexões.

## C. Identidades e autenticação

Na conexão histórica do Neon foi observada **uma** conta em `usuarios`. Geisa (ID 1 confirmado) está presente, ativa, com e-mail normalizado, formato BCrypt compatível (`$2a$`/`$2b$`/`$2y$`, 60 caracteres), `token_version` válido e role `ROLE_ADMIN`. Não foi lido, impresso ou testado o hash integral, e nenhuma senha foi verificada. A identidade planejada para administração principal **não existe** nesse banco. Não há duplicidade após `lower(trim(email))`. Os metadados observados não revelam se a senha que o operador conhece corresponde ao hash. Os e-mails fornecidos no pedido foram usados apenas como parâmetros de consulta e não foram reproduzidos neste documento público.

O modelo atual é `usuarios` ↔ `usuario_roles` ↔ `roles`; V2 removeu os outros papéis do MVP. `SecurityConfig` exige `ROLE_ADMIN` em todo `/api/**` salvo exceções de autenticação e saúde. `LoginRequest` exige e-mail válido; `AuthService` faz `trim().toLowerCase()`, consulta exata com `findByEmailForUpdate`, BCrypt, estado ativo, desafio 2FA e, só após verificação, cria sessão JWT e refresh token. Tentativas falhas consomem buckets persistentes por IP e IP+e-mail; a resposta genérica não prova qual condição falhou. O fluxo do frontend envia `{email,senha,rememberMe}` para `/api/auth/login` na mesma origem e o proxy Next encaminha para `INTERNAL_BACKEND_URL`.

O administrador `admin@oficina.local` da sessão anterior está somente no PostgreSQL local sintético. O banco local tinha uma conta `ROLE_ADMIN`, desafio 2FA utilizado, evento de login/logout e refresh token, mostrando uma autenticação real local, não uma sessão mockada. Isso explica por que esse administrador não aparece no Neon. A falha da conta Geisa em `localhost:3000` é explicada pelo destino local diferente **se essa foi a URL usada**; a URL do navegador do operador e um login real no Neon não foram observados, logo a causa exata de qualquer outra tentativa permanece inconclusiva. Não repetir tentativas na conta real para distingui-la.

**Plano de provisionamento, somente para etapa futura:** confirmar controle da caixa de correio do futuro administrador por canal aprovado e segundo fator; realizar backup e restauração de teste; criar conta com senha definida por convite seguro e expiração, sem passar segredo em CLI ou Git; atribuir `ROLE_SUPER_ADMIN` em transação auditada; confirmar login, 2FA, acesso e recuperação; só então atribuir `ROLE_OPERADOR_GERAL` a Geisa e retirar sua role antiga mediante autorização específica. Preservar ID, hash, estado, relações e histórico de Geisa; incrementar `token_version` e revogar sessões ao mudar papéis. Se a conta principal já existir em outra branch, reconciliar identidade antes de promoção. `INITIAL_ADMIN_*` cria usuário apenas com banco vazio; não serve para promover em banco populado. Preparar rollback transacional e manter uma conta administrativa funcional durante a transição.

## D. Estrutura e dados do banco

Contagens observadas (somente metadados agregados): 9 clientes, 11 máquinas, 4 produtos, 3 categorias, 14 ordens de serviço, 6 itens, 11 movimentações de estoque, 4 endereços, 0 fornecedores, 25 notificações, 261 eventos de auditoria, 81 desafios 2FA e 11 refresh tokens. As tabelas de segurança, configuração e Flyway também existem. Contagem **não classifica** registros como testes. Nenhum dado operacional foi exportado. Todos esses registros são tratados como protegidos ou de natureza indeterminada até revisão humana com critérios de origem e dependências. Nenhum candidato à exclusão foi confirmado.

O histórico da conta, das OS e do estoque impõe auditoria de dependências antes de qualquer exclusão. A remoção física de usuário, cliente, equipamento ou item não pode ser proposta com base apenas em nomes, e-mails ou contagens. A simulação de limpeza nesta etapa limita-se ao inventário de tabelas e dependências; resultado: **zero exclusões autorizáveis**. Não há evidência de backup restaurável neste trabalho. Antes de qualquer saneamento, obter snapshot/exportação consistente fora do repositório, registrar hash e escopo, restaurar em banco isolado, verificar contagens e relações, ensaiar rollback e exigir aprovação específica do conjunto de IDs e efeitos. O backup do provedor, se existir, ainda precisa de confirmação e ensaio de restauração.

## E. RBAC planejado e riscos

Papéis pretendidos: `ROLE_SUPER_ADMIN` (controle total); `ROLE_OPERADOR_GERAL` (todas as operações operacionais e financeiras existentes, sem identidade, segurança ou infraestrutura); `ROLE_ADMIN` (delegado com limites); `ROLE_GERENTE`, `ROLE_ATENDENTE`, `ROLE_TECNICO`, `ROLE_ESTOQUISTA`, `ROLE_FINANCEIRO` e `ROLE_CONSULTA` com permissões mínimas definidas na etapa 2. Esses papéis **não existem ou não estão ativos** no modelo corrente e não foram inseridos no Neon.

A [matriz](permission-matrix.md) lista 83 combinações de rota e método, inclusive aliases. A cada rota operacional foi proposto acesso `OPERADOR_GERAL` e `SUPER_ADMIN`; permissões de papéis delegados exigem revisão por serviço e regra de negócio. O identificador granular é preliminar. Na etapa 2, substituir o gate global `ROLE_ADMIN` por verificação de permissão no backend, com negação por padrão. O frontend não é barreira de autorização. Métodos de status, exclusão de itens, vínculos, movimentação e relatórios exigem preservação dos invariantes atuais e testes de acesso por ID. Todas as operações da Geisa atualmente possíveis devem continuar possíveis; ações administrativas novas ficam restritas.

| Achado | Grau | Evidência e impacto | Ação / gate etapa 2 |
|---|---|---|---|
| F01 | CRÍTICO | Backend local ativo aponta para PostgreSQL local, enquanto a conta Geisa está no Neon; login nesse local não encontra a conta. | Deixar explícito no ambiente qual destino está ativo; confirmar console Neon; não promover o local como produção. Bloqueia. |
| F02 | ALTO | Segredos aparentes foram incluídos no texto da solicitação. | Tratar como expostos, rotacionar no provedor sob plano de continuidade; revisar acessos. Bloqueia produção. |
| F03 | ALTO | `AdminAccountBootstrap`, Flyway, sincronização de notificações e schedulers podem escrever no startup. | Não iniciar aplicativo completo no Neon para diagnóstico. Definir perfil operacional seguro e plano de migração separado antes de homologação. Bloqueia aprovação da conexão completa. |
| F04 | ALTO | `JwtAuthenticationFilter` confia em roles dentro do JWT enquanto `token_version` só muda quando explicitamente incrementado. | Na etapa 2, alteração de role deve incrementar versão, revogar sessões e testar token antigo. Bloqueia RBAC. |
| F05 | ALTO | Gate global `ROLE_ADMIN` protege também todas as rotas operacionais. | Matriz, enforcement no backend e regressão integral de Geisa. Bloqueia RBAC. |
| F06 | MÉDIO | `SPRING_PROFILES_ACTIVE` no `.env` local não ativou `dev` no processo observado; frontend não carrega `.env` raiz automaticamente. | Configurar ambiente antes do startup; testes de precedência e contrato de inicialização. |
| F07 | MÉDIO | Banco e endpoint SQL são conhecidos; projeto/branch e endpoint direto não foram verificados no painel. | Cruzar IDs e endpoints no console, registrar evidência privada. Bloqueia aprovação integral. |
| F08 | MÉDIO | Backup restaurável e natureza dos dados operacionais não foram demonstrados. | Exportação/snapshot, hash e restauração isolada antes de limpeza ou mudança de contas. Bloqueia mutações. |
| F09 | MÉDIO | Endpoint pooled passou consulta curta, sem ensaio de carga transacional. | Homologar Hikari, concorrência, prepared statements e limites com banco isolado. |

Controles observados no código: BCrypt, 2FA, JWT com `token_version`, cookies HttpOnly, CSRF, rate limiting persistente, rejeição de headers de proxy não confiáveis, limites de corpo, CORS, Swagger/Actuator restritos por configuração. Parte foi exercitada em testes sintéticos, não no Neon. Recuperação de acesso administrativa por convite e proteção do último SUPER_ADMIN ainda precisam de desenho e implementação. Configuração SMTP real (autenticação, remetente, STARTTLS, credencial e capacidade de entrega) não foi testada; a suíte usa Mailpit.

## F. Dashboard futuro — viabilidade

SQL `pg_database_size` fornece tamanho lógico do banco e contagens locais; não fornece consumo faturado do projeto, CU-horas, retenção, backups nem quota. API/painel Neon são fontes para esses dados, mas o plano e as permissões da conta não foram consultados. A [documentação da Neon sobre métricas de consumo](https://neon.com/platforms) lista endpoints de consumo por projeto/branch para planos Launch/Scale/Agent/Enterprise; portanto, disponibilidade da mesma API no Free **não está confirmada**. O [plano Free divulgado pela Neon em outubro de 2026](https://neon.com/blog/neon-free-plan-1-gb-per-project) informa 1 GB por projeto; o limite e uso reais desta conta permanecem pendentes de inspeção do painel.

Para Google Cloud Run, [Cloud Monitoring](https://docs.cloud.google.com/run/docs/monitoring) disponibiliza métricas de requisições, latência, CPU, memória e instâncias. Uma futura API backend restrita a SUPER_ADMIN pode ler séries com conta de serviço e permissão `roles/monitoring.viewer`, sem chave no navegador, com cache, TTL, horário de atualização, valor ausente explícito e custos monitorados. Dados de faturamento exigem consulta de billing autorizada e podem ter atraso; nunca converter estimativa em valor exato. Alertas de orçamento em 50/80/95% são configuráveis, mas [alertas simples não impõem teto de gasto](https://docs.cloud.google.com/billing/docs/how-to/budgets). A documentação atual menciona *spend caps* para serviços suportados, sujeitos a elegibilidade e possível interrupção; a conta deste projeto não foi verificada. Nenhuma API foi habilitada nem faturamento alterado.

## G. Testes e gate

No PostgreSQL descartável `oficina-forensic-tests-20261109`, isolado em `127.0.0.1:5433/oficina_gestao_test`, com profile `test`, `TEST_DB_*` explícitos e migrations sintéticas, `mvn test` passou **843 testes**, incluindo os novos testes da identidade da conexão Spring e precedência `.env`. `mvn clean verify` também passou com **843 testes** em cópia isolada do backend e da documentação, porque o JAR na pasta original estava em uso pelo servidor local. Frontend: **378 testes**, lint e TypeScript passaram. O guard de testes rejeita destinos, portas, schemas e configurações não permitidos antes de criar pool. A execução anterior do PR #21 validou Flyway, frontend, Playwright e integração real com banco sintético, mas não substitui CI da branch atual nem validação operacional Neon.

| Gate | Estado | Base |
|---|---|---|
| BACKEND → NEON | PENDENTE | JDBC/Hikari isolados passaram; backend completo não apontou para Neon |
| IDENTIDADE DO BANCO | PENDENTE | Banco/schema SQL confirmados; projeto/branch do painel não |
| TLS | APROVADO para conexão diagnóstica | `verify-full` completou; `pg_stat_ssl` interno não mede trecho externo |
| JDBC / HIKARICP | APROVADO para leitura isolada | Driver e pool de 1 conexão consultaram em transação somente leitura |
| FLYWAY | APROVADO para estado atual | V24, 0 pendentes, validação sem `migrate` |
| HIBERNATE | APROVADO para schema | 17 entidades validadas sem inicialização Spring |
| INTEGRIDADE DO BANCO | PENDENTE | Catálogo e contagens coerentes; backup/restauração não verificados |
| CONTA GEISA | APROVADO para existência | Ativa, papel ADMIN; hash não testado |
| CONTA SUPER_ADMIN | PENDENTE | Endereço planejado ausente; provisionamento posterior |
| PROVISIONAMENTO SEGURO | PENDENTE | Procedimento desenhado, nenhuma conta criada |
| MODELO RBAC | PENDENTE | Modelo proposto, não implementado |
| MATRIZ DE PERMISSÕES | PENDENTE | Inventário preparatório; validar regras por serviço na etapa 2 |
| AUTENTICAÇÃO / 2FA | PENDENTE operacionalmente | Código e testes sintéticos; nenhuma tentativa real no Neon |
| SEGURANÇA | PENDENTE | Segredos aparentes expostos no pedido, rotação e gates de startup pendentes |
| BACKUP | PENDENTE | Restauração não demonstrada |
| LIMPEZA DOS DADOS | PENDENTE | Nenhum candidato confirmado; nenhuma exclusão executada |
| VIABILIDADE DAS MÉTRICAS NEON | PARCIAL | SQL disponível; APIs e plano da conta não verificados |
| VIABILIDADE DAS MÉTRICAS GOOGLE CLOUD | PARCIAL | Documentação pública; projeto/IAM/billing não inspecionados |
| CI | PENDENTE nesta branch | PR #21 teve checks verdes no commit base; branch atual ainda a conferir |
| PRONTIDÃO PARA ETAPA 2 | **NO-GO para mutações; GO para desenho isolado** | F01–F08, identidade do painel e backup pendentes |
| PRODUÇÃO | **NO-GO** | Sem homologação, rotação de segredos e autorização de deploy |

## HANDOFF — ETAPA 2: PAINEL ADMINISTRATIVO E RBAC

1. **SHA/branch:** usar o commit final desta branch, registrado no PR correspondente; ponto de partida auditado `5a9beb1`.
2. **PRs:** #21 aberto; #20 e #18 abertos, nenhum automaticamente incorporado. Reavaliar diffs antes de integrar.
3. **Banco:** o endpoint histórico conectou ao banco esperado, schema `public`; confirmar IDs de projeto e branch no console antes de mutações.
4. **Modelo:** `usuarios`, `roles`, `usuario_roles`; autenticação por BCrypt, 2FA, JWT e versão do token.
5. **Contas:** Geisa (ID 1) ativa com `ROLE_ADMIN`; futuro SUPER_ADMIN ausente no destino consultado. Preservar integralmente Geisa.
6. **Transição:** identidade verificada, backup restaurado, convite seguro, 2FA, teste funcional, migração auditada e rollback; só então mudar role de Geisa com autorização específica.
7. **Migrations:** V1–V24 e B24 presentes; próxima migration versionada disponível: V25. Não executar no Neon sem revisão/aprovação.
8. **Permissões:** [83 combinações](permission-matrix.md); OG cobre todas as rotas operacionais; definir concessões limitadas dos demais papéis sem ampliar privilégio.
9. **Endpoints:** controllers de auth, busca, categorias, clientes, configuração, estoque, fornecedores, máquinas, notificações, OS, produtos, relatórios, saúde e sistema; tabela detalhada na matriz.
10. **Frontend:** reutilizar login/2FA, cliente API de mesma origem, tratamento CSRF, formulários e componentes atuais; desenhar rotas `/admin/usuarios`, `/admin/papeis`, `/admin/auditoria`, `/admin/infraestrutura` só na etapa 2.
11. **Auditoria:** registrar ator, alvo, mudança de role/permissão, motivo, horário e resultado sem tokens ou hashes; preservar histórico.
12. **Usuários:** convite e verificação de e-mail; desativação lógica padrão; exclusão física apenas após análise de referências e aprovação.
13. **Segurança:** deny-by-default, antiescalonamento, último SUPER_ADMIN, ações críticas reforçadas, proteção IDOR/BOLA, revogação de sessões e recuperação.
14. **Métricas:** SQL para tamanho lógico/contagens; API Neon conforme plano; Cloud Monitoring/Run/Billing com IAM mínimo, cache e sinalização de atraso.
15. **Free/limites:** disponibilidade real depende do plano Neon e Google Cloud do projeto; obter dados no console, sem pressupor API ou cota.
16. **Testes:** matriz por papel/método/objeto, tokens antigos, lockout, 2FA, backup/rollback, Flyway em banco isolado e integração operacional sintética.
17. **Bloqueios:** confirmar projeto/branch, rota operacional de conexão, rotação de segredos aparentes, backup restaurável e plano de startup seguro.
18. **Aceite:** Geisa mantém todas as operações existentes; novo administrador autenticável e com 2FA; acesso administrativo exclusivo; regressões verdes; restauração e rollback ensaiados.
19. **Permitido agora:** leitura diagnóstica, testes sintéticos, documentação e PR. **Requer autorização posterior:** contas/roles reais, migrations remotas, limpeza, reinício operacional, deploy e merge.
