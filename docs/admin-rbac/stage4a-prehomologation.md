# Etapa 4A — pré-homologação isolada e preparação Neon

Data: 12/11/2026, America/Sao_Paulo. Repositório `uaikauaa/oficina`. Base exata: PR #29, `ba18f6c9791f680c23bc1d8096824e927823c2c7`. Branch de trabalho isolada: `audit/admin-stage4a`, baseada no head do #29. Alterações locais preexistentes em outras worktrees foram preservadas.

**Veredito: GO para revisão da preparação isolada; NO-GO para homologação definitiva, conexão/ativação no Neon original, contas reais, migrations no original, merge e deploy.** Há diferença temporal estatisticamente relevante na recuperação e configuração operacional incompleta/divergente. Nenhuma leitura remota, dump ou modificação no Neon original foi executada por esta etapa. Nenhum backend novo foi iniciado contra ele. Os testes usam PostgreSQL descartável e destinatários `.invalid`/Mailpit. Processos preexistentes não foram reiniciados, parados nem reconfigurados.

Procedimento completo para diagnóstico, backup/restore, ensaio, startup, ativação/rollback e contas: [runbook Neon 4A](stage4a-neon-runbook.md). Cada acesso futuro exige autorização específica; aprovação deste relatório não autoriza SQL, login real, e-mail, backup ou criação de role.

## PRs e workflows da referência

Consulta feita via GitHub em 12/11/2026. Todos os PRs abaixo estão abertos, **draft**, sem merge:

| PR | Head conferido | Base |
|---|---|---|
| [#25](https://github.com/uaikauaa/oficina/pull/25) | `bae5104d08d85ae1671284cdf814226ba2462ccb` | `audit/admin-rbac-security-validation` |
| [#26](https://github.com/uaikauaa/oficina/pull/26) | `c5caa53b7b9db330c9af13835cace2b09e6e71c6` | `fix/admin-invite-outbox-stage32` |
| [#27](https://github.com/uaikauaa/oficina/pull/27) | `69ef399ff665548d47acfd03f3de5d001efebd50` | `fix/admin-invite-outbox-stage32` |
| [#28](https://github.com/uaikauaa/oficina/pull/28) | `f49707d706dc61879caa5cd821c78adffaf70bf6` | `feat/admin-stage33-prehomologation` |
| [#29](https://github.com/uaikauaa/oficina/pull/29) | `ba18f6c9791f680c23bc1d8096824e927823c2c7` | `audit/admin-stage34-final` |

Os quatro workflows no **SHA exato do #29** concluíram `success`:

- [CI Pipeline 43129283767](https://github.com/uaikauaa/oficina/actions/runs/43129283767).
- [Validação Complementar 43129284017](https://github.com/uaikauaa/oficina/actions/runs/43129284017).
- [Oracle Readiness 43129283886](https://github.com/uaikauaa/oficina/actions/runs/43129283886).
- [Integração Real 43129284112](https://github.com/uaikauaa/oficina/actions/runs/43129284112).

O #26 continua com três successes e [Integração Real failure 42892478545](https://github.com/uaikauaa/oficina/actions/runs/42892478545). O log do job `130096909581` falhou esperando `Painel Operacional` ficar visível em 5 segundos após 2FA; isso é a localização observada, **não diagnóstico conclusivo de causa**. Não se aumentou timeout nem alterou seletor para ocultar o erro. É branch paralela de governança; o sucesso do #29 não reescreve a evidência do #26. A escolha e revisão dessa branch continuam explícitas antes de integração futura.

## Diferença 857 × 889: contagem, não remoção

Os 99 XMLs preservados em `stage35/backend/target/surefire-reports` totalizam **889 testcases**, 0 falhas, 0 erros, 0 skips. Somar os 99 `.txt` dá **857**. Exatamente dois resumos textuais foram sobrescritos pelo container JUnit de classes aninhadas:

| Suite | `.txt` | XML/casos executados | Diferença |
|---|---:|---:|---:|
| `IpAddressResolverTest` | 0 | 28 | +28 |
| `ProductionOpenApiSecurityTest` | 0 | 4 | +4 |
| Demais suites | 857 | 857 | 0 |
| Total | 857 | 889 | +32 |

O log CI registra separadamente os grupos de 22 + 6 casos do resolvedor e os 4 casos do container OpenAPI, além de seu total final 889. O POM não define profiles Maven alternativos para essa seleção: Surefire ativa `test`, e testes específicos adicionam `prod`. Não houve indicação de seleção menor, skips ou remoção de arquivos. O problema era somar summaries `.txt` que não preservavam os filhos. A contagem foi retificada no relatório 3.5, inclusive seu SHA antigo no rodapé.

Reprodução: `node scripts/summarize-maven-reports.mjs <diretório-surefire>`. O coletor confere atributo `tests` contra número de `<testcase>` e não copia propriedades/credenciais dos XMLs. Evidência com hashes dos arquivos locais: [stage35-junit.json](evidence-stage4a/stage35-junit.json). O novo inventário é [stage4a-junit.json](evidence-stage4a/stage4a-junit.json): 893 = 889 + 3 fluxos operacionais + 1 teste de paridade produção; o diagnóstico temporal substitui um teste anterior, sem alterar sua contagem.

## Correções e testes executados

- Removido o `ThreadLocal` e o setter de “próximo token” de `JwtService`. `AuthService` passa explicitamente o UUID persistido ao emitir access token após 2FA e ao rotacionar refresh. Fixtures que usam token sem sessão permanecem disponíveis para testes legados; os novos testes críticos desabilitam esse bypass.
- `ProductionSessionParityIntegrationTest`: profiles `test,prod`, datasource protegido pelo guard local, cookies Secure, configuração SMTP/CORS de produção e `legacy-sessionless-allowed=false`. Login emite apenas desafio; 2FA válido emite JWT com sessão persistida; replay do desafio é recusado; refresh conserva UUID; JWT sem sessão recebe 401. SMTP é mockado neste teste específico, sem reduzir as políticas efetivas de produção.
- `AccessTokenSessionBindingIntegrationTest`: modo estrito, duas sessões, revogação individual imediata, independência da outra sessão, rotação, revogação global, claim órfão e JWT sem sessão. `AuthServiceTest`, `RefreshReusePersistenceTest` e testes de token_version continuam passando.
- `OperationalCriticalFlowsIntegrationTest`: HTTP via MockMvc com filtros reais, tokens vinculados e PostgreSQL real. SUPER_ADMIN e OPERADOR_GERAL: criação de cliente/máquina/produto/OS; edição; inativação e leitura persistida; baixa de peça; cancelamento/estorno e recusa de segundo estorno; diagnóstico → manutenção → pronta → concluída; total financeiro 85 (40 peças + 50 mão de obra − 5 desconto); data de conclusão; PDFs, relatórios e históricos. Não se trata de teste só de 403/400 com corpo vazio.
- Delegados: GERENTE cria/inativa cliente e não altera configuração; ATENDENTE cadastra cliente/máquina e não cria produto; TECNICO abre/avança OS e não cadastra cliente; ESTOQUISTA movimenta saldo e não abre OS; FINANCEIRO lê relatório e não movimenta estoque; CONSULTA lê cliente/máquina com minimização e não altera estado nem vê relatório financeiro. Todos sem administração de identidades. A matriz ampla já existente e os testes de minimização complementam esses casos representativos.
- Painel Chromium → Next → Spring → PostgreSQL/Mailpit: busca real, duas páginas com fixtures sintéticas, vazio, convite por formulário, 403 real por senha incorreta e recuperação do formulário, aceite de convite, RBAC, auditoria, sessão, recuperação de senha e novo login 2FA. CSV do OPERADOR_GERAL contém o cliente criado; PDFs têm assinatura `%PDF-`. Telas administrativas mantêm verificações de overflow em 320/390/768/1366/1920 px. Erros 500/rede e todos os estados visuais anteriores continuam cobertos na suíte mockada já aprovada; não são reclassificados como falhas reais injetadas nesta etapa.
- Compose passa a encaminhar `APP_PUBLIC_URL` obrigatória, `SUPER_ADMIN_BOOTSTRAP_EMAIL` opcional e contexto de proxy opcional aos serviços apropriados. Workflow de validação Compose recebeu URL pública sintética e TLS `verify-full`. Nenhum serviço de produção foi iniciado por essa alteração.
- O runner da stack recusa `.env` nos caminhos de carregamento do backend e overrides Spring/JVM herdados antes de iniciar Docker/Java; teste negativo confirmou a recusa sem imprimir valores. O modelo de produção deixa `INITIAL_ADMIN_*` vazios para o Neon existente.

| Gate local | Resultado |
|---|---|
| Maven `clean verify`, PostgreSQL 16 recém-criado em loopback, guard TEST_DB_* e manifests sintéticos | **893/893**, 0 falhas/erros/skips; JAR gerado |
| Flyway de produção em bases sintéticas, caminhos vazios/V21/V24–V28/checksums/constraints | 9 testes no gate Maven; não representa restore de dados reais |
| Next build | Passou |
| ESLint e TypeScript E2E | Passaram |
| `npm audit --omit=dev --audit-level=high` | 0 vulnerabilidades de produção; instalação registrou 7 moderadas em ferramentas de desenvolvimento, sem atualização arbitrária |
| TLS/SMTP locais e sanitização do auditor de configuração | 3/3 |
| Baseline V1–V24 e defaults neutros | Passaram |
| Compose com variáveis exclusivamente sintéticas, `config --quiet` | Passou; não sobe serviços |

O ambiente local usa Java 21, Maven Wrapper e Node 24; CI usa Node 22 conforme workflows. Não se repetiram manualmente os 379 testes frontend e 115 mocks intactos só para inflar evidência; o CI continua responsável por seus gates regulares. O teste de reinício e os resultados de CI específicos da nova branch constam no registro final de execução ao final deste documento.

## Recuperação: avaliação estatística e pendência

Protocolo novo: 20 pares de aquecimento descartados, 120 pares medidos, endereços sintéticos novos e IPs RFC-5737 distintos, ordem de caminhos sorteada com seed fixa 42026. Sem bcrypt/setup de fixture dentro da região medida; sem envio SMTP, SQL logging ou worker de outbox durante a medição; limitador zerado somente no PostgreSQL descartável antes do experimento. A criação de um reset por endereço existente é verificada para detectar curto-circuito por limite. Medição abrange serviço transacional + commit local; **não** mede transporte HTTP/WAN, não testa equivalência de latência em produção e não elimina o ruído de outros processos do host.

A medição publicada foi repetida sozinha, após build/suíte completa, sem outros testes/builds iniciados por esta etapa em paralelo. Valores em ms:

| Métrica | Existente | Inexistente |
|---|---:|---:|
| Mediana | 13,835 | 8,6162 |
| P95 | 21,7684 | 13,4667 |

Diferença pareada mediana **5,277 ms**, bootstrap pareado IC95% **[4,9331; 5,5141] ms**; razão de medianas **1,6057**, IC95% **[1,5749; 1,6623]**. Permutação pareada (10.000 reamostragens) p≈**0,0001**; Cliff's delta **0,9163**. [Amostras sem identidades](evidence-stage4a/recovery-timing.csv), [resultado e método](evidence-stage4a/recovery-timing.json), `scripts/analyze-recovery-timing.mjs`.

**Conclusão: diferença detectável, não equivalência.** O caminho existente grava reset/outbox/auditoria; o inexistente encerra antes. O limite anterior `<30x` foi removido como alegação de segurança. Status/corpo genéricos, rate limit e ausência de envio síncrono permanecem, mas não anulam a separação observada. **Bloqueio aberto para homologação definitiva**: definir e implementar mitigação revisada (por exemplo, aceite durável e processamento assíncrono uniforme), medir pelo endpoint real em cenário controlado e aprovar critério de equivalência antes da abertura pública. Não introduzir sleep arbitrário, usuário fictício permanente, migrations ou filas voláteis como correção apressada nesta preparação.

## Configuração privada: presença, política e limites

Inspeção exclusivamente offline: `.env` privado da worktree operacional, configuração dos containers backend/frontend já existentes e ambiente deste processo. [Resultado sanitizado](evidence-stage4a/private-config-presence.json) contém **somente nomes, presença e verificações booleanas**, sem valores, tamanhos, fingerprints, hosts, e-mails ou senhas. Não executou DNS, TLS remoto, JDBC, API Neon, SMTP operacional nem `/actuator/env`. Presença/comprimento de segredo não comprova entropia, exclusividade histórica ou validade da credencial.

| Item | `.env` privado | Container backend preexistente / efeito |
|---|---|---|
| DB_URL, DB_USERNAME, DB_PASSWORD | Presentes; hostname Neon; verify-full declarado | Presentes; hostname Neon; verify-full **não** declarado; divergência bloqueante |
| CA PostgreSQL | Sem `sslrootcert` explícito na URL | Sem CA explícita na URL; truststore/factory/certificado não comprovados |
| JWT_SECRET | Presente; comprimento mínimo atendido | Presente; comprimento mínimo atendido |
| RATE_LIMIT_SECRET | Presente e distinto de JWT | Ausente na configuração do container |
| SERVICE_PROXY_SECRET | Presente; mínimo atendido | Ausente; obrigatório se contexto assinado/Cloud Run IAM for usado |
| INVITE_OUTBOX_KEYS | **Ausente** | **Ausente**; versão atual da aplicação falha sem chave ativa válida |
| INVITE_OUTBOX_ACTIVE_VERSION | Ausente; default do código é 1 | Ausente; default não compensa ausência da chave |
| SMTP | Nomes obrigatórios presentes, auth/STARTTLS declarados | Presentes, auth/STARTTLS declarados; entrega/CA real não testadas |
| APP_PUBLIC_URL | **Ausente** | **Ausente**; deve ser origem pública HTTPS para convite/recuperação |
| SUPER_ADMIN_BOOTSTRAP_EMAIL | **Ausente** | **Ausente**; manter sem preencher até janela futura autorizada |
| SPRING_PROFILES_ACTIVE | Presente, não produção | Produção declarada; não inferir perfil do container pelo `.env` |
| Cookies/CORS | Configuração local não atende políticas HTTPS de produção | Secure declarado e origens HTTPS exatas; domínio público pretendido ainda não comparado oficialmente |
| INITIAL_ADMIN_EMAIL/PASSWORD | Ausentes | Presentes; remover em futura ativação autorizada, sem usar bootstrap de senha inicial |
| Frontend Next | Nenhum `.env*` privado em `frontend` inspecionado | Container tem INTERNAL_BACKEND_URL; sem DB/JWT/SMTP/outbox; não recebeu proxy secret/hops |

A configuração de container é o ambiente armazenado pelo Docker, não uma consulta do `Environment` final de uma JVM desconhecida. Imagem antiga, arquivos montados, system properties ou mecanismos externos podem mudar o resultado; esta etapa não a reiniciou nem atestou correspondência com o código candidato. A checagem de fontes adicionais no JSON indica overrides visíveis, sem imprimir argumentos. A existência de um backend anterior apontando a Neon exige cautela operacional; esta etapa não pode garantir ausência de escritas feitas por outros processos preexistentes.

### Carregamento das variáveis

Backend: `DotenvEnvironmentPostProcessor` ignora arquivos quando `test`, `prod` ou `production` já estão ativos. Fora desses perfis busca o **primeiro** arquivo existente em `.env`, `../.env`, `backend/.env`, relativamente ao diretório de trabalho. Parser simples `KEY=value`, ignora comentários/linhas vazias, remove aspas externas; não é shell nem expande comandos. Só inclui chaves ausentes em `System.getenv`; adiciona essa fonte ao Environment. Em produção as variáveis devem estar injetadas no **processo antes do startup**, inclusive o profile; não usar `.env` como garantia de ativação de profile depois de carregado ConfigData. `test` tem TEST_DB_* separados e guard positivo, sem fallback DB_URL.

Next: recebe `process.env` do launcher/container e carrega `.env*` da raiz **frontend**, não automaticamente o `.env` da raiz do repositório nem o do backend. Ordem documentada localmente: `process.env`, `.env.$NODE_ENV.local`, `.env.local` (exceto test), `.env.$NODE_ENV`, `.env`. Docker Compose lê seu `.env` para interpolação, porém só injeta campos declarados em `environment`; não envia todo o arquivo aos dois processos. Next usa `INTERNAL_BACKEND_URL` no proxy server-side, e `SERVICE_PROXY_SECRET`/`TRUSTED_PROXY_HOPS` quando IAM/contexto assinado estiver habilitado. Secrets nunca devem receber prefixo `NEXT_PUBLIC_`, que pode incorporá-los ao bundle. Configuração deve ser conferida no launcher real de build e runtime, sem startup do candidato no original nesta etapa.

Cookies: access HttpOnly/SameSite=Lax, refresh HttpOnly/SameSite=Strict e caminho `/api/auth`; Secure obrigatório em produção. CSRF ativo para cookies mutáveis, bootstrap em `/api/auth/csrf`, ausência/valor inválido recusado no teste real. CORS com origens exatas, sem wildcard/local em produção. A stack real HTTP local usa dev/Secure=false por isolamento; **não prova HTTPS de produção**. A paridade de sessão foi testada separadamente com propriedades `prod`, e TLS/SMTP local com certificados efêmeros.

## Critérios objetivos GO/NO-GO

| Gate | Critério | Estado nesta etapa |
|---|---|---|
| Revisão técnica isolada | 893 testes sem falhas, build/lint/tipos, operações válidas e negativas, evidências sem segredos | GO para revisão; CI da branch deve continuar obrigatório |
| Sessões | 2FA/refresh com sessão estrita; revogação persiste em nova JVM com mesma chave; independência e replay | **PASS** local, ver registro final |
| Recuperação temporal | IC de equivalência pré-definido e aceito no endpoint real, sem separação material por existência | **NO-GO**, diferença confirmada |
| Configuração produção | Todas as chaves e URLs válidas; fontes efetivas consistentes; JWT/rate/proxy distintos; outbox ativa válida; CA/hostname corretos | **NO-GO**, ausências/divergências |
| Diagnóstico original | Identificadores oficiais + credencial/consultas/janela preenchidos e autorização específica | **Não autorizado/não executado** |
| Backup/restore real | Autorização própria; dump cifrado verificado; restore isolado íntegro; RPO/RTO medidos | **Pendente**, nenhum backup remoto |
| Migrations originais | Ensaio do backup, checksums exatos, invariantes, rollback e autorização distinta | **NO-GO**; só ensaios sintéticos nesta etapa |
| SUPER_ADMIN real | Convite oficial, senha do titular, 2FA, recuperação e auditoria aprovados | **Planejado**, nenhuma conta criada |
| Geisa | ID/senha/ativo/histórico preservados; operações verificadas; novo login após revogação autorizada | **Planejado**, nenhum papel alterado |
| Merge/deploy | Revisão, decisão sobre PRs empilhados/paralelos, todos os gates e autorização | **Não autorizado**; manter draft |

Não transformar o sucesso dos testes em autorização para conectar. Não usar os scripts existentes de backup/preflight como aprovação implícita. O próximo pedido de autorização deve ser o formulário concreto do runbook, já com identidade e credencial conferidas em canal privado.

## Registro final da execução 4A

`node scripts/test-real-stack-local.mjs` concluiu com **3/3 testes Playwright reais**, seguido por:

1. Login + 2FA em duas sessões; revogação A → A=401 e B=200. Após **nova JVM, mesma chave JWT, mesmo PostgreSQL**, A=401 e B=200. Refresh A=401, refresh B=200 com mesmo sessionId; replay do refresh B rotacionado=401 e acesso derivado recusado.
2. Duas JVMs, 12 tentativas concorrentes: orçamento distribuído exato (10 respostas 401, 2 respostas 429), XFF forjado ignorado. Reinício com outra chave JWT manteve o bloqueio de rate limit. Este cenário de rotação de chave é distinto do anterior e não foi usado como prova de revogação de sessão.
3. Convite cifrado pendente sobreviveu ao reinício dos dois workers, produziu uma mensagem no Mailpit e apagou ciphertext após entrega. Não é garantia de exactly-once SMTP sob qualquer falha externa.

Um primeiro ensaio do runner falhou porque o passo novo ainda usava a senha sintética anterior ao teste de recuperação; corrigida a fixture para a senha que o fluxo oficial já havia atualizado. Não houve mudança da aplicação nem relaxamento de assertion por esse motivo. O ensaio completo seguinte passou. No teste operacional inicial também se corrigiu uma fixture com nome de cliente repetido, respeitando o 409 de unicidade.

Os containers/JVMs pertencentes à stack foram removidos pelo `finally`. O PostgreSQL de testes Maven é separado da stack e dos serviços preexistentes. Artefatos resumidos/hashes: [execução local](evidence-stage4a/execution.json). Logs completos permanecem locais/ignorados; não há dump remoto nem credencial no commit. Publicação e CI do head são registrados no PR draft e no anexo de CI deste diretório, quando disponíveis.
