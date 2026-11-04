# Pré-verificação e plano de homologação Google Cloud

Data: **04/11/2026**, America/Sao_Paulo. Escopo executado: **FASE 1 e planejamento da FASE 2**. Nenhum projeto, conta, segredo, banco, serviço, orçamento ou faturamento foi criado/alterado na nuvem. Nenhum teste foi dirigido à produção. Este documento não é uma aprovação de deploy.

**Resultado:** código integrado com quatro workflows verdes, mas **implantação bloqueada** pela presença de dados reais nos seeds/padrões, ausência de imagens publicadas por digest e pré-requisitos operacionais ainda pendentes. A aprovação de custos não dispensa a resolução desses bloqueios.

| Veredito solicitado | Estado nesta etapa |
| --- | --- |
| SEGURANÇA DA INFRAESTRUTURA | **INCONCLUSIVA** — infraestrutura não provisionada nem testada |
| HOMOLOGAÇÃO FUNCIONAL | **INCONCLUSIVA** — CI/local não substituem os testes no provedor |
| PRODUÇÃO | **NO-GO** |

## 1. Referência e evidências de CI

`origin/main`, confirmado por fetch e API GitHub: **d54087d440243610a7e281e594a5e6e3b6ae6c18**, igual ao SHA solicitado. Checkout isolado em branch `docs/homologacao-planejamento-20261104`; a branch original e suas duas imagens não versionadas foram preservadas.

Foram lidos integralmente o [registro de release](../release-pre-homologacao/README.md), [guia Cloud Run](../deployment-google-cloud-run.md), [roteiro de segurança](../security-hardening/homologacao.md), [.env.homolog.example](../../.env.homolog.example), os cinco arquivos de `scripts/homologation/`, os quatro workflows, Dockerfiles e configurações relevantes do backend/proxy.

| Workflow de push na main | Resultado no SHA exato | Evidência |
| --- | --- | --- |
| CI Pipeline | success | [41752904542](https://github.com/uaikauaa/oficina/actions/runs/41752904542) |
| Validacao Complementar - Flyway Real e E2E | success | [41752904392](https://github.com/uaikauaa/oficina/actions/runs/41752904392) |
| Integracao Real - Frontend Backend PostgreSQL 2FA | success | [41752904398](https://github.com/uaikauaa/oficina/actions/runs/41752904398) |
| Oracle Readiness - TLS e Backup | success | [41752904531](https://github.com/uaikauaa/oficina/actions/runs/41752904531) |

Os sete jobs também estão `success`, inclusive `image-audit` e Flyway real. O [snapshot GitHub](evidencias/github.json) registra SHA, consultas e nomes dos jobs. O workflow Oracle verifica a infraestrutura legada; seu sucesso **não comprova backup ou TLS no Google Cloud**. Não foram disparados novos workflows nesta etapa.

### Proteção da main

API pública: `protected=false`, enforcement de checks desligado, contexts vazios; endpoints de regras aplicáveis e rulesets retornaram listas vazias. O endpoint administrativo `/branches/main/protection` retornou **401**, e `gh` não possui sessão autenticada. Não se afirma ter inspecionado configurações administrativas ocultas. A integração GitHub foi usada para jobs e artefatos; consultas públicas REST complementaram funcionalidades não expostas pelo conector (workflows de push/proteções).

Regras ausentes na evidência disponível: PR obrigatório, pelo menos uma revisão humana, descarte de aprovações após mudanças, resolução de conversas, checks obrigatórios e atualização em relação à main, proibição de force push/exclusão e restrição de bypass. Configurar e verificar com acesso administrativo antes do deploy; nenhuma regra foi modificada nesta tarefa. Exigir os **sete jobs**, com seus nomes exatos no snapshot, e não somente os quatro nomes de workflows. Não aceitar merge com checks de outro SHA.

## 2. Versões, imagens e migrations

| Componente | Versão observada |
| --- | --- |
| Java / Spring Boot / Spring Security | Java 21 / 4.0.9 / 7.0.8 |
| Spring Framework / Tomcat | 7.0.10 / 11.0.27 |
| PostgreSQL JDBC / Flyway | 42.7.12 / 11.14.1 |
| Next.js / React / Zod | 16.4.1 / 19.2.8 / 4.6.6 |
| Backend build/runtime | `maven:3.9.11-eclipse-temurin-21-alpine` / `eclipse-temurin:21-jre-alpine` |
| Frontend build/runtime | `node:22-alpine`; aplicação 0.1.0 |
| Backend JAR | `backend-0.0.1-SNAPSHOT.jar` |

As bases usam tags mutáveis; o backend também executa `apk upgrade`. Reconstruir o mesmo SHA não garante os mesmos bytes. As duas imagens executam com usuário sem root. A CI constrói `oficina-backend:pr` e `oficina-frontend:pr`, sem publicação em registry nem preservação do tar das imagens.

IDs locais das imagens examinadas pela CI (não são digests de manifest para deploy):

- Backend: `sha256:de73c8550ee2e2c1960033b7cc444d594d444cb63b04d4b99066d864dfd94ce7`.
- Frontend: `sha256:fbf7d01bbaad22a995d47b9761b7cb2e8d40558af1e03f52ecbcefcf47c74247`.

`RepoDigests` está ausente nos relatórios. **Imagens implantáveis do SHA: não confirmadas.** Após liberação, construir a partir do SHA finalmente aprovado, registrar bases resolvidas e revisão OCI, gerar SBOM/scan de novo, publicar em Artifact Registry e implantar `.../backend@sha256:...` e `.../frontend@sha256:...`. Tags de SHA são auxiliares; não usar `latest`. Se houver correção de código, exigir novo SHA integrado e os quatro workflows verdes antes de implantar.

Existem **24 migrations oficiais, V1–V24 sem lacunas**, inventariadas com SHA-256 em [migrations.json](evidencias/migrations.json). V23 cria os limitadores persistentes; V24 controla a geração da chave. Flyway real `migrate` e `validate` passaram na CI. Hibernate está em `ddl-auto=validate`, Flyway habilitado, `baseline-on-migrate=false`, `validate-on-migrate=true`.

### Bloqueio de dados reais

As migrations **V11/V12** contêm dados cadastrais da oficina. Há identificação/contato também em defaults de `ConfiguracaoOficina`, `PdfService`, `frontend/src/lib/oficina.ts` e outros pontos de apresentação. `AdminAccountBootstrap` tem nome real padrão. Os valores não são reproduzidos neste relatório. Um banco Neon novo, sozinho, **não** atende à exigência de usar somente dados sintéticos.

Antes de provisionar: definir e revisar uma estratégia que impeça a inserção de dados reais desde a primeira migration e elimine defaults reais usados nos testes/PDFs. Não alterar V1–V24 já aplicadas, trocar silenciosamente por migrations sintéticas de teste, nem aplicar dados reais para apagá-los depois. Uma correção pode exigir um caminho explícito de inicialização sintética com Flyway e testes de equivalência de schema, além de novo SHA; esse desenho ainda precisa ser concluído em tarefa de código. V25 de limpeza isoladamente não impediria a inserção anterior. Não há autorização implícita para contrariar o requisito de dados sintéticos para manter o SHA antigo.

O modelo de ambiente também não inclui o bootstrap inicial. Planejar `INITIAL_ADMIN_NAME=Administrador Sintetico`, email exclusivo do sandbox e senha aleatória independente via Secret Manager, removendo a referência de bootstrap após criar a conta. O código atual insere essa conta via ApplicationRunner; testar esse fluxo com dados sintéticos, sem SQL ad hoc ou perfil inseguro. Mudanças de schema e de migrations permanecem sujeitas ao Flyway.

## 3. Dependências e scanners

| Verificação | Resultado | Limite da evidência |
| --- | --- | --- |
| `npm audit --omit=dev --json --ignore-scripts` | **0** vulnerabilidades | Lockfile atual, consulta em 04/11 |
| `npm audit --json --ignore-scripts` | **8 moderadas**, 0 altas/críticas | Ferramentas ESLint/typescript-eslint/minimatch; não equivale a zero alertas |
| Maven `dependency:tree` | Executado com sucesso | Inventário, não é scanner de CVEs |
| Trivy 0.74.0, duas imagens/SBOMs e segredos no checkout | CI **aprovada**, relatórios examinados | CVEs filtradas HIGH/CRITICAL; inventário offline |
| Gitleaks 8.30.1, histórico local `--all` | **exit 1**, 9 ocorrências | Triagem conclusiva pendente; valores omitidos |
| TLS/SMTP isolados com certificados efêmeros | **2 testes aprovados agora** | Não acessam Neon/SMTP/GCP |
| Build/testes completos locais e novo scan de containers | Não executados nesta etapa | Docker daemon indisponível; CI do SHA fornece evidência existente |
| DAST/SAST dedicado, licenças e scan Maven online completo | Não executados/revalidados | Não declarar aprovação desses escopos |

Os oito avisos npm afetam `@typescript-eslint/eslint-plugin`, `parser`, `type-utils`, `typescript-estree`, `utils`, `typescript-eslint`, `eslint-config-next` e `minimatch`. O resultado anterior de 16 alertas é histórico; o novo resultado não decorre de alteração no lockfile. Não aplicar `npm audit fix --force`: a sugestão inclui regressão de versão de `eslint-config-next`. Evidências: [completo](evidencias/npm-audit-all.json), [runtime](evidencias/npm-audit-runtime.json) e [árvore Maven](evidencias/dependency-tree.txt).

Artefato CI `13286202741`, SHA-256 `e304964acfcdb1382fba0bb0a889ee3d8e09bd738261263a46b563c8be04e193`: baixado e checksum conferido. SBOM backend com 191 componentes e frontend com 43; relatórios de vulnerabilidade filtrados sem achados e três relatórios de segredos sem achados. [Resumo verificável](evidencias/image-audit-summary.json) e [cópia do artefato original](evidencias/image-audit-d54087d.zip). O original no GitHub expira em 11/11/2026 UTC. A análise offline evita HTTP 429 do Maven Central, mas pode omitir dependências cujo POM não estava disponível. Zero HIGH/CRITICAL não prova ausência de vulnerabilidades médias/baixas ou desconhecidas.

Gitleaks foi baixado da [release oficial 8.30.1](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1), com checksum do ZIP conferido. Foram reportados 169 commits examinados, em clone não shallow com 187 commits alcançáveis pelas refs locais. Os nove achados `generic-api-key` estão em dois exemplos `.env`, um workflow, cinco ocorrências em testes e uma documentação de API. Contextos sugerem fixtures/placeholders; **nenhum segredo ativo foi confirmado**, e não se encerra a triagem apenas pelo caminho do arquivo. [Metadados sem valores](evidencias/gitleaks-summary.json). O scan não cobre refs remotas não buscadas, commits inalcançáveis, logs de terceiros ou sistemas externos. Não foi criada allowlist nem suprimido alerta.

Ambiente local: Node 24.21.0/npm 11.19.0, Java 21; CI e imagem frontend usam Node 22. A suíte TLS local passou em Node 24 e também consta aprovada na CI Node 22. A primeira invocação Maven falhou por parsing de argumento no PowerShell; repetida com argumento entre aspas, concluiu com sucesso. Nenhum teste de backend foi iniciado contra banco não identificado.

## 4. Revisão dos verificadores e configuração

| Arquivo | O que verifica | Complemento necessário na FASE 4 |
| --- | --- | --- |
| `check-cloud-run.mjs` | Guard de projeto isolado, labels, identidade frontend, URL canônica HTTPS, referências distintas dos três segredos, mesma versão do proxy, hops, IAM do serviço; chamadas anônima, permitida, identidade negada e audience incorreta; proxy/401/HSTS/HTTP | Políticas herdadas de projeto/pasta/organização, outros papéis com `run.routes.invoke`, invoker check ativo, ingress, revisões/tag URLs, versões/imagens, grants Secret Manager e ausência de envs indevidas. O script não comprova orçamento, CSP, login ou carga. |
| `CheckNeonTls.java` | Guard de host/banco/usuário de teste; `verify-full` com `DefaultJavaSSLFactory`, truststore Java, conexão read-only, TLS 1.2/1.3 via `pg_stat_ssl` | Mesmo driver/JRE/truststore/configuração da imagem; negativos CA/hostname; grants, Flyway, capacidade, PITR/restore. Read-only não significa conexão sem custo. |
| `check-smtp.mjs` | Guard de host sandbox e credenciais sintéticas; delega o teste de transporte | Nome contendo sandbox é guard de operador, não prova de isolamento da conta. Não testa entrega de email. |
| `smtp.mjs` | STARTTLS obrigatório, validação de CA/hostname, mínimo TLS 1.2, AUTH apenas após TLS, QUIT sem email, timeouts | Validar JavaMail real, política TLS, entrega/expiração/uso único 2FA e quotas do provedor. |
| `tls-isolated.test.mjs` | CA confiável, CA desconhecida, hostname errado, AUTH após TLS e recusa sem STARTTLS | Certificados locais efêmeros não comprovam serviços externos. |

`check-cloud-run.mjs` só grava seu JSON ao passar tudo; uma execução falha pode deixar arquivo de uma execução anterior. Para evidências, usar diretório/run ID novo, capturar exit code e timestamp e vincular todos os resultados a projeto, região, revisão e digest. Não reutilizar um arquivo antigo como aprovação. Nenhum dos três verificadores externos foi executado aqui, pois não há ambiente autorizado.

Controles encontrados no código: chaves JWT/rate/proxy distintas validadas pelo backend; proxy server-side com ID token em `X-Serverless-Authorization`; audience igual à URL canônica; allowlist de headers; contexto de IP assinado com HMAC; rate limiting PostgreSQL com transação própria e geração V24; CSP nonce por request, HSTS e `no-store`; CSRF por header; cookies access `HttpOnly/Secure/SameSite=Lax`, refresh `HttpOnly/Secure/SameSite=Strict` e CSRF `HttpOnly/Secure/Strict`; Swagger/API docs desligados e Actuator somente health sem detalhes. 2FA por email permanece obrigatório. CSP permite estilos inline de atributo, mas não scripts inline sem nonce em produção; registrar essa exceção sem chamar a CSP de irrestrita.

O frontend **servidor** precisa de `SERVICE_PROXY_SECRET`; isso é diferente de expor credenciais ao navegador. DB/JWT/rate/SMTP não devem existir no serviço frontend nem no bundle público. Verificar bundle/source maps e respostas sem revelar valores. Falhas SMTP no AuthService registram tipo de exceção, sem corpo do provedor; logs de autenticação ainda contêm email/IP. Usar apenas dados sintéticos e conferir logs efetivos, sem declarar ausência de vazamento com base apenas na leitura do código. O token CSRF entregue ao cliente é parte do protocolo; o que não pode aparecer em JSON/logs é código 2FA, senha, JWT/refresh ou token IAM.

Lacuna TLS: `.env.homolog.example` traz `sslmode=verify-full`, mas não define a fonte de CA usada pelo checker Java. A aplicação não contém um guard específico de `sslmode`. Proposta de URL, sem credenciais: `jdbc:postgresql://<host-neon-isolado>:5432/oficina_security_test?sslmode=verify-full&sslfactory=org.postgresql.ssl.DefaultJavaSSLFactory`. Conferir truststore da imagem final e recusa de CA/hostname incorretos. Alternativa exige CA confiável montada e `sslrootcert`; nunca usar fábrica não validante ou `sslmode=require` para contornar falha. [Referência pgJDBC](https://jdbc.postgresql.org/documentation/ssl/).

## 5. Arquitetura proposta — ainda não provisionada

Projeto/ID proposto: **`oficina-261104-security-test`** (28 caracteres, disponibilidade global não verificada). Região GCP: **`us-central1`**, somente dados sintéticos; localização nos EUA precisa integrar o aceite. Labels: `environment=security-test`, `application=oficina`, `expires=2026-11-11` se iniciado em 04/11; se iniciado depois, recalcular prazo de sete dias e renovar a cotação. Labels não executam expiração automática.

```text
Browser de teste
  └─ HTTPS → Cloud Run oficina-frontend-hml [público durante a janela]
               └─ HTTPS + ID token IAM → oficina-backend-hml [IAM obrigatório]
                                           ├─ JDBC verify-full → Neon isolado
                                           └─ STARTTLS validado → SMTP sandbox
Secret Manager → apenas as identidades autorizadas de cada serviço
Cloud Logging / Monitoring / Billing → evidências e alertas
Artifact Registry → duas imagens fixadas por digest
```

O backend é privado **por autenticação IAM**, com endpoint HTTPS alcançável pela rede. A proposta usa ingress `all` com verificação IAM habilitada, sem `allUsers`/`allAuthenticatedUsers` no backend e sem permissões herdadas equivalentes. Não confundir isso com isolamento de rede. Ingress `internal` exigiria desenho de VPC/roteamento e nova estimativa; não será ativado sem validar o caminho frontend → backend. Não há Load Balancer, Cloud Armor, NAT, domínio definitivo ou Cloud SQL neste plano.

### Identidades e permissões

| Identidade | Permissão proposta e escopo |
| --- | --- |
| `oficina-frontend-hml@<projeto>.iam.gserviceaccount.com` | `roles/run.invoker` **somente no backend**; `roles/secretmanager.secretAccessor` somente no segredo de proxy |
| `oficina-backend-hml@<projeto>.iam.gserviceaccount.com` | Secret Accessor apenas em JWT, rate, proxy, senha DB, senha SMTP e bootstrap temporário; nenhuma permissão administrativa GCP |
| `oficina-denied-hml@<projeto>.iam.gserviceaccount.com` | Nenhum invoker nem acesso a segredos; identidade para teste negativo |
| Operador de ensaio | Run Viewer/configuração/IAM legível, logs/monitoramento legíveis; emissão temporária de ID tokens nas duas contas de teste, no menor escopo necessário, removida ao final |
| Operador de provisionamento | Permissões temporárias para recursos aprovados, IAM específico e vinculação à conta de faturamento aprovada; separar das identidades runtime |
| Processo de build/publicação | Escrita apenas no repositório Artifact Registry de homologação; sem segredos de aplicação no build; autenticação curta via operador/WIF, sem chave JSON |

Frontend público via binding `allUsers` de invoker apenas nesse serviço, com teste de login obrigatório para dados de negócio. Inspecionar grants herdados e identidades de deploy/serviço do Google; os papéis administrativos podem conceder invocação e precisam ser justificados. Não conceder Editor/Owner às contas runtime, Token Creator em projeto inteiro ou Secret Accessor global. Confirmar política organizacional que permita frontend público sem enfraquecer controles da organização. [Autenticação entre serviços](https://docs.cloud.google.com/run/docs/authenticating/service-to-service).

### Recursos e limites

| Recurso | Proposta inicial |
| --- | --- |
| Frontend | 1 vCPU, 512 MiB, porta 3000, min 0/max 2 instâncias por serviço e limite por revisão, concorrência 4, timeout 60 s |
| Backend | 1 vCPU, 1 GiB, porta 8080, min 0/max 2, concorrência 4, timeout 60 s; proxy interno mantém limite de 30 s |
| Cobrança | Por request, sem instâncias mínimas; sem aumento automático de quotas, CPU boost inicialmente desabilitado |
| Pool backend | `HIKARI_MAX_POOL_SIZE=10`, `HIKARI_MIN_IDLE=0`; 20 conexões em regime, reservar ao menos 40 + administração para sobreposição de revisões |
| Neon | **Projeto novo**, nunca clone/branch de produção; PostgreSQL 16 para alinhar CI; região `aws-us-east-2`, se disponível; Free, compute 0.25 CU fixo, storage operacional ≤250 MiB, uso ≤10 CU-h e transferência ≤1 GiB nesta campanha |
| SMTP | Mailtrap **Email Sandbox Free**, host sandbox/porta 587, sem encaminhamento a caixas reais; até 40 emails na campanha, espaçados pelo menos 10 s; sem upgrade automático |
| Artifact Registry | Repositório regional privado, duas imagens e candidatos de rollback; alvo ≤2 GiB, cleanup de não referenciadas após revisão, preservar digests do rollback |
| Backup | Snapshot/PITR Neon e restore sintético; bucket GCS opcional **incluído no plano** para dump cifrado, mesma região, acesso uniforme e prevenção de acesso público, ≤5 GiB, retenção curta sem lock irreversível |
| Logs | Alvo ≤1 GiB/campanha, retenção 30 dias no bucket de aplicação; logs obrigatórios seguem retenção do provedor |

A região Neon proposta é diferente da região GCP e envolve tráfego entre provedores; medir latência/egress e não inferir capacidade para produção no Brasil. [Regiões Neon](https://neon.com/docs/introduction/regions). Disponibilidade de PostgreSQL 16 e 0.25 CU deve ser confirmada na conta antes de criar; nenhuma substituição paga automática.

Cloud Run pode manter revisões sobrepostas; máximos não são uma garantia de teto financeiro instantâneo. Pools e réplicas precisam ser medidos. As tarefas `@Scheduled` de limpeza não têm execução contínua garantida com CPU por request/scale-to-zero: os limitadores conferem expiração no SQL durante requests, mas limpeza/retensão precisam de teste. Não migrar para CPU sempre alocada nem adicionar Scheduler/Jobs sem reestimar.

### Segredos e variáveis

Criar valores aleatórios independentes de pelo menos 32 bytes para `hml-jwt`, `hml-rate` e `hml-proxy`; segredos separados `hml-db-password`, `hml-mail-password`, `hml-bootstrap-password`. Máximo planejado de 12 versões ativas durante rotação. Fixar números de versão no deploy, nunca `latest`. Frontend e backend usam **a mesma versão** de `hml-proxy`, apenas eles têm acesso a ela. Comparação de valores em memória, sem imprimir segredos ou hashes derivados para comprovar distinção.

Backend: `SPRING_PROFILES_ACTIVE=prod`, `SECURITY_COOKIE_SECURE=true`, JDBC conforme seção TLS, usuário sintético, CORS com URL HTTPS exata do frontend, `MAIL_SMTP_AUTH=true`, `MAIL_SMTP_STARTTLS=true`, remetente sintético `mailer@security-test.invalid`, docs desabilitados. `prod` ativa os controles rigorosos; não significa implantação em produção. Manter STARTTLS required e validação de identidade do profile. Definir mínimo TLS 1.2/1.3 efetivo no JavaMail/JRE e comprová-lo.

Frontend: `NODE_ENV=production`, `INTERNAL_BACKEND_URL=<URL canônica HTTPS>`, `CLOUD_RUN_IAM=true`, segredo proxy e `TRUSTED_PROXY_HOPS` **a determinar por medição**. Não atribuir arbitrariamente um valor para fazer o checker passar. Fazer primeiro uma sonda efêmera isolada de ingresso sem dados de negócio, dentro da mesma quota/janela aprovada, para medir sufixo XFF de duas origens conhecidas; depois liberar aplicação para testes. Rejeitar falsificações de XFF, Forwarded, X-Real-IP, CF-Connecting-IP, Host, identidade Google e contexto assinado. Um resultado inconclusivo bloqueia abertura dos fluxos de negócio.

Usuário Neon runtime sem papel de proprietário/neon_superuser: CONNECT/USAGE, DML/sequence estritamente necessários, inclusive limitadores. Migrações com identidade distinta, grants definidos por migration versionada e conta removida do runtime depois; iniciar Flyway com procedimento revisado e `SPRING_FLYWAY_ENABLED=false` somente no runtime que já recebeu e validou as migrations. Isso exige validar o processo e não equivale a desligar validação de schema. Credenciais de migração/restore só no operador isolado, nunca no frontend. Não executar esse procedimento antes de resolver o seed sintético.

## 6. Custos e contenção propostos

Estimativa em **USD**, preços públicos consultados em 04/11/2026, sem impostos/câmbio. Campanha de **sete dias**, até quatro sessões supervisionadas e sem serviço público deixado indefinidamente aberto. Não depende de créditos promocionais ou de franquias compartilhadas ainda disponíveis.

Hipótese conservadora de consumo agregado: **20 vCPU-h, 15 GiB-h e 40 mil requests Cloud Run** (frontend + backend), egress ≤1 GiB, registry ≤2 GiB, até 12 versões de segredo, logs ≤1 GiB. Inclui folga de cold start/ensaios; medir tempo faturável real. Build local/runner já disponível, sem Cloud Build pago neste plano.

| Item | Estimativa da campanha |
| --- | ---: |
| Cloud Run antes de franquias: 72.000 × 0,000024 + 54.000 × 0,0000025 + 0,04 × 0,40 | **US$ 1,879** |
| Registry, versões/acessos a segredos e armazenamento pequeno de backup | Reserva **US$ 0,50** |
| Rede, logs/monitoramento e margem de operação | Reserva **US$ 3,00** |
| Neon Free e Mailtrap Sandbox Free dentro das quotas | **US$ 0** |
| Faixa esperada, arredondada | **US$ 2–6** |

Fontes: [Cloud Run](https://cloud.google.com/run/pricing), [Artifact Registry](https://cloud.google.com/artifact-registry/pricing), [Secret Manager](https://cloud.google.com/secret-manager/pricing), [Observability](https://cloud.google.com/products/observability/pricing), [Neon](https://neon.com/pricing) e [Mailtrap Sandbox](https://mailtrap.io/pricing/). As reservas são hipóteses de engenharia, não cotações fixas de rede/armazenamento. API de análise automática paga de imagens não será habilitada: usar Trivy no runner, contabilizado separadamente se deixar de ser gratuito.

Neon Free oferece atualmente 100 CU-h/mês por projeto e 1 GiB; PITR de seis horas/até 1 GiB de alterações. Isso permite ensaio curto de restauração, **não** aprova retenção de produção. Mailtrap Free: 50 emails/mês, um usuário/sandbox, somente dez emails retidos e um envio por dez segundos. Capturar evidência sanitizada antes de FIFO remover mensagens. Não comprar plano pago para contornar quota. [Detalhes Neon](https://neon.com/docs/introduction/plans).

**Aprovação financeira proposta:** orçamento total de **US$ 20 para o projeto/campanha**, alertas de gasto real em 25/50/75/90/100% e previsão de atingir 100%; **spend cap mensal Cloud Run de US$ 10**, se elegível na conta. A documentação atual inclui Cloud Run como serviço elegível; o bloqueio é por projeto/serviço, usa estimativa bruta e não é instantâneo. Não cobre Registry, armazenamento, Neon ou SMTP. [Limites de spend caps](https://docs.cloud.google.com/billing/docs/how-to/budgets-spend-caps). Se indisponível, não substituir silenciosamente por alertas: registrar e obter aceite do controle alternativo antes de iniciar.

Parar novos testes ao chegar a US$ 10 totais observados, exceder hipóteses de consumo ou projetar ultrapassar US$ 20; custos reportados podem atrasar, por isso acompanhar também requests, bytes e tempo faturável. Retirar frontend do acesso anônimo fora das janelas e no encerramento; manter backend privado. Isso exige implementação do procedimento de encerramento na FASE 4, não confiar em labels ou min=0. Preservar evidências e remover recursos descartáveis conforme o aceite. Alertas simples de orçamento não interrompem cobrança.

Como cenário de risco, quatro instâncias continuamente ocupadas (2 frontend + 2 backend) por 720 horas custariam aproximadamente **US$ 268/mês só em CPU/RAM**, antes de créditos, requests e rede. Máximo de duas instâncias não promete gasto ≤US$ 20. Interromper imediatamente se houver vazamento, backend anônimo, segredo no cliente ou risco de exceder o orçamento, sem continuar carga para completar o relatório.

## 7. Observabilidade, ensaios e recuperação planejados

Logs de requests e aplicação com correlação por request ID/revisão, sem payloads de autenticação, cookies, Authorization, contexto assinado, códigos ou credenciais. Sem debug SMTP/SQL em homologação. Habilitar auditoria de alterações IAM/Cloud Run/Secret Manager e leitura de segredos no escopo necessário, revisar ingestão. Acesso humano mínimo a logs. Alertas propostos: qualquer mudança pública no backend, 5xx >1% por cinco minutos com volume mínimo de 20 requests, p95 >2 s por cinco minutos, memória >80%, instâncias no máximo por cinco minutos, erros de pool/DB e falhas repetidas SMTP. Notificar canal do proprietário a definir; nenhum email/mensagem foi enviado nesta fase. Validar a entrega de cada alerta no ensaio.

| Ensaio futuro | Critério mínimo / evidência |
| --- | --- |
| IAM/TLS/Neon/SMTP | Executar os três checkers com identidade de homologação; registrar configuração redigida, projeto/região, timestamps, SHA/digests e negativos. Executar JDBC também com JRE/truststore da imagem. |
| Login e 2FA | Usuário sintético, código capturado somente no sandbox, expiração, consumo único, tentativa incorreta, lockout, replay, logout/refresh; nenhum código em respostas/logs. |
| CSRF/cookies/rotas | Requests sem CSRF e com token incorreto negados, rotação/stale token, flags/path dos cookies, acesso entre usuários/papéis, docs/Actuator sensíveis negados, nonce diferente a cada HTML. |
| PDF/CSV/estoque/OS | Downloads autorizados e streaming, CSV injection, PDF sem dados reais, operações concorrentes idempotentes/consistentes, invariantes do estoque, permissões por papel. |
| Limites entre réplicas | Duas réplicas efetivamente observadas, IPs/headers falsificados sem alterar budget, reinício sem reset; não apagar contadores para passar. |
| Carga | Rampas 1 → 2 → 4 → 8 usuários virtuais, até 2 requests/s agregados e 15 min por ensaio, no máximo quatro ensaios/20 mil requests externos e ≤1 GiB. Logins fora da carga, ≤40 emails/10 s entre envios. Não exceder quotas para forçar segunda réplica; usar janela supervisionada de min=2 por até 15 min, dentro das horas aprovadas, se necessário. |
| Rotação JWT | Novo valor não zera budgets de rate; sessões antigas e refresh conforme política observada, novo login 2FA. Não prometer continuidade de sessão com chave única. |
| Rotação proxy | Corte coordenado e janela de manutenção; versões divergentes devem falhar fechadas. Rollback em ambos os serviços com versões compatíveis. |
| Rotação rate/V24 | Drenar todos os escritores antigos e esperar maior expiração ativa; validar geração antiga/nova e rejeição em rollout misto. Rollback também exige drenagem/expiração quando houver mudança de geração. |
| Backup/restauração | Snapshot/PITR dentro das seis horas; dump cifrado para bucket privado, hash e restore em banco/branch descartável, sem sobrescrever origem; comparar schema Flyway e invariantes sintéticas. Meta de ensaio RPO ≤1 h/RTO ≤30 min, a medir, não garantida. |
| Rollback | Digests e versões de segredos anteriores registrados; compatibilidade de schema; sem down migration destrutiva. Uma revisão antiga não reverte banco. Se incompatível, corrigir para frente ou restaurar ambiente separado. |

Testes que exigem limiar maior de carga, plano SMTP pago, mais banco, VPC ou duração maior exigem nova aprovação de custo/limites. Não usar as 830/376/119 contagens de relatórios antigos como contagens de testes reexecutados nesta tarefa.

## 8. Pré-requisitos e aceite pendente

Antes de qualquer recurso na nuvem:

1. Aceite explícito do projeto `oficina-261104-security-test`, região `us-central1`, dados sintéticos nos EUA, Neon `aws-us-east-2`, campanha de sete dias, estimativa US$ 2–6, orçamento US$ 20, cap Cloud Run US$ 10 e limites deste documento.
2. Resolver o caminho de dados sintéticos desde a inicialização, defaults/frontend/PDF e bootstrap; se mudar código, integrar e aprovar novo SHA com os quatro workflows. Resolver/aceitar formalmente triagem Gitleaks e riscos de scanner offline; habilitar proteção da main.
3. Operador GCP autenticado por sessão curta, projeto/conta de faturamento aprovados e políticas organizacionais compatíveis; `gcloud` não está disponível neste ambiente local. Usar runner Linux/Cloud Shell e não compartilhar tokens ou chaves no chat.
4. Contas novas/isoladas Neon e Mailtrap, saldo de quotas, capacidade/conexões e isolamento confirmados; nenhum endpoint operacional herdado. Destinatário de alertas e responsável pela interrupção definidos.
5. Plano de build/publish por digest, inventário de APIs (`run`, `artifactregistry`, `secretmanager`, `iam`, `iamcredentials`, logging/monitoring/billing budgets e storage), IAM mínimo, grants de migration, backup e teardown revisados. Só habilitar APIs após autorização.

Mesmo após aceite financeiro, só avançar ao deploy quando os bloqueios técnicos estiverem resolvidos. Na FASE 5, preencher os campos hoje **não executados**: projeto/região efetivos, digests/revisões, IAM, TLS real, login/2FA, segurança de rotas, acesso, capacidade/custos reais, restore/alertas e riscos residuais. Produção, domínio definitivo e migração de dados reais continuam fora do escopo.
