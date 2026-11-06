# Homologação Google Cloud, Neon, Firebase e domínio

06/11/2026. Base confirmada por Git: `main`, `9dd035e0bad1309c9512cc3e1150b3997d5e2425` (PR #17 integrado). Branch: `chore/finalize-homologation`. O PR vincula o commit final e o CI.

**Autorização vigente:** continuar auditoria, correções, preparação e testes locais; aguardar rotação e confirmação de isolamento antes de autenticar no Neon. Sem migrations remotas, alterações de dados remotos ou deploy. Nenhum projeto Neon, serviço Cloud Run, segredo/versão, site, DNS ou recurso pago foi criado.

## Auditoria e correções

Foram revisados os roteiros Neon/GCP/security-hardening/remediação, exemplos homolog, parser/CLI/JDBC/segredos/verificador Cloud Run/build de release, guarda Flyway, profiles Spring, Dockerfiles, Next/proxy/IAM e workflows.

- Verificador GCP: substituída aceitação genérica `*-security-test` por ID `oficinagestao-homologacao`, número `193690344577`, região `us-central1`, isolamento e labels `app=oficina-gestao,environment=homologation`. Mantidos testes IAM, audience, TLS, segredos e proxy; acrescentadas identidades exatas, versões numéricas e proibição de DB_* no frontend.
- Neon: exige conexão direta em sa-east-1, channel_binding=require explícito, rotação e confirmação de isolamento no arquivo privado. O carregador desta etapa exige exatamente oficina_security_test / oficina_security_test_owner. Branch production no projeto oficina-homologacao não prova isolamento nem uso produtivo por si só.
- Firebase remove cookies de entrada, exceto `__session`: rewrite simples perderia JWT/refresh/CSRF. Foi adicionado adaptador opt-in com AES-256-GCM, nonce aleatório e segredo independente, sem dependência nova. Spring mantém validação dos tokens, 2FA, CSRF e revogação. [Regra oficial](https://firebase.google.com/docs/hosting/manage-cache#using_cookies).
- `.firebaserc`/`firebase.json`: todas as rotas ao Next SSR no frontend Cloud Run, pinTag=true e no-store. Sem exportação estática/index.html. Predeploy exige aprovação pública, projeto/número, metadata segura, digest frontend esperado e última revisão pronta. Hosting limita requisições a 60s; proxy aguarda backend por no máximo 30s. [Integração oficial](https://firebase.google.com/docs/hosting/cloud-run).

Nenhuma migration V1–V24/B24, profile de segurança ou regra de domínio foi reescrita. Arquivos privados existentes preservados; somente gates ausentes foram acrescentados ao `.env.homolog.local`, com valores bloqueantes. A auditoria encontrou placeholders e isolamento falso. Não houve tentativa de autenticação PostgreSQL nem cópia da senha da imagem.

## Arquivos e comandos

| Área | Entrega |
| --- | --- |
| Neon | `.env.homolog.local.example`, neon-hml.mjs, CheckNeonTls.java, guarda Java e testes: região/conexão direta, rotação e isolamento |
| GCP | cloud-target.mjs, check-cloud-run.mjs, inspect-cloud-hml.mjs, deployment-plan.mjs, prepare-deployment.mjs e testes |
| Sessão | frontend/src/server/firebaseSession.ts, backendProxy.ts, docker-entrypoint.mjs e firebaseSession.test.ts |
| Hosting | .firebaserc, firebase.json, firebase-public/.gitkeep, hosting-config.mjs e hosting-predeploy.mjs |
| Templates | .env.cloud.homolog.local.example, .env.cloud.backend.local.example, .env.cloud.frontend.local.example, .env.smtp.homolog.local.example e homolog existentes |
| Evidência | inspect-dns.mjs, test-firebase-session-local.mjs e workflows CI/integração |

### Neon e Flyway

Após redefinir a senha da role no Neon, preencher **somente o arquivo privado** com a URL nova, percent-encoding, hostname direto confirmado e TLS verify-full/channel binding. Não enviar a senha no chat nem preenchê-la a partir de imagens. Não alterar `.env`/`backend/.env`.

Confirmar NEON_HML_CREDENTIAL_ROTATED=true, NEON_HML_PROJECT=oficina-homologacao e NEON_HML_BRANCH=production. NEON_HML_PROJECT_ISOLATED=true e NEON_HML_ISOLATED=true somente depois de auditar projeto/branch e ausência de dados operacionais. Nenhum terceiro projeto será criado.

```powershell
node --env-file=.env.homolog.local scripts/homologation/configure-neon-hml.mjs --check
# Somente depois de rotação/confirmação: JDBC estritamente somente leitura.
node --env-file=.env.homolog.local scripts/homologation/configure-neon-hml.mjs --inspect
node --env-file=.env.homolog.local scripts/homologation/configure-neon-hml.mjs --prepare
```

O JDBC valida CA/hostname/TLS 1.2–1.3/channel binding, identidade SQL e banco sem objetos de usuário. Não executa Flyway. DNS/TCP/certificado Neon reais: **NÃO TESTADOS**, aguardando configuração elegível/confirmação.

Manter HML_MIGRATIONS_APPROVED=false. Antes de autorizar o destino exato: isolamento, credencial nova, inspeção JDBC, banco vazio, recovery/backup revisado, checksums V1–V24 e plano somente B24. Após autorização explícita, usar estratégia existente com prod e segredos separados; confirmar SQL_BASELINE B24/24, validate Flyway/Hibernate, constraints/índices/sequências/relacionamentos e ausência de dados reais. Sem clean, repair, baseline administrativo, DROP/TRUNCATE ou checksum manual. Backup/PITR e ensaio de restore remoto: **NÃO TESTADOS**.

### Google Cloud, IAM e Secret Manager

ID/número/região estão fixados no código, mas não foram confirmados por API nesta sessão: gcloud/Firebase CLI indisponíveis no PATH e nenhuma conexão autenticada confirmada dos plugins. Foram encontrados plugins Neon/Firebase disponíveis; a conexão depende do usuário. O script de metadados foi exercitado e recusou acesso sem alterar recursos.

Copiar o modelo cloud apenas se o arquivo privado ainda não existir, revisar gates e executar:

```powershell
node --env-file=.env.cloud.homolog.local scripts/homologation/inspect-cloud-hml.mjs --metadata
```

Não depende do Neon. Lê projeto/número, contas exatas frontend/backend/denied, IAM de projeto/segredo, versões habilitadas, serviços/repositórios existentes e metadados Firebase/Hosting. Não lê payloads. Se os domínios já estiverem no site correto, coleta requiredDnsUpdates da API; 404 vira pendência, sem criar domínio. Relatório sanitizado: `logs/homologation/cloud-metadata.json`, ignorado.

IAM herdado de pasta/organização, condições, permissões efetivas por impersonação e consumo/faturamento ainda exigem auditoria autenticada. O check-cloud-run conserva negativas anônima/denied/audience e teste frontend→backend; execução remota **NÃO TESTADA**.

| Segredo | Identidades permitidas no segredo |
| --- | --- |
| DB_PASSWORD, MAIL_PASSWORD, JWT_SECRET, RATE_LIMIT_SECRET | backend |
| SERVICE_PROXY_SECRET | backend e frontend, mesma versão aprovada |
| FIREBASE_SESSION_SECRET, novo | somente frontend |
| INITIAL_ADMIN_PASSWORD, opcional | backend somente no bootstrap sintético |

A chave Firebase independente é necessária para cifrar o cookie único sem reutilizar chaves JWT/proxy. Gerar 32 bytes aleatórios em base64 por mecanismo privado; sem valor padrão. Não foi criada nesta entrega.

Consultar existência/versões antes de criar. Enviar apenas a senha extraída ao DB_PASSWORD por stdin de `gcloud secrets versions add ... --data-file=-`; nunca URL/.env/argumento/log. Versão adicional existente exige aprovação. Fixar números, accessor por segredo e auditar herança. Denied sem acesso; sem Owner/Editor/accessor global.

### SMTP sandbox

Preencher `.env.smtp.homolog.local`: HML_SMTP_HOST, PORT, USERNAME, PASSWORD, ISOLATED e MAIL_FROM a partir do modelo. Usar sandbox como Mailtrap, remetente sintético e nenhum cliente real. Não substituir por conta pessoal.

```powershell
node --env-file=.env.smtp.homolog.local scripts/homologation/check-smtp.mjs
```

Exige autenticação depois de STARTTLS e certificado/hostname confiáveis; checker não envia mensagem. Mapear MAIL_HOST/PORT/USERNAME/FROM; senha via Secret Manager; AUTH/STARTTLS=true. Profile prod conserva starttls.required/checkserveridentity.

SMTP externo e fluxo 2FA em Cloud Run: **NÃO TESTADOS**, aguardando credenciais privadas. Localmente houve entrega real a Mailpit, 2FA e testes backend de expiração/reenvio/tentativas/abuso. Isso não aprova o provedor externo.

### Sessão e Hosting

Frontend: FIREBASE_HOSTING_MODE=true e FIREBASE_SESSION_SECRET via Secret Manager. Backend recebe cookies reconstruídos, sem a chave Firebase. ID token IAM fica separado do JWT, em X-Serverless-Authorization.

Envelope host-only, Path=/, HttpOnly/Secure/SameSite=Strict; access fica mais restritivo, refresh/CSRF continuam Strict. Proxy impõe path /api/auth do refresh e expiração de cada entrada. Sem lembrar: sessão do navegador. Com lembrar: persistência acompanha autenticação. CSRF passa a compartilhar o ciclo físico do envelope, mantendo HttpOnly/Strict, header e validação Spring; não foi desativado.

Sem Set-Cookie, leituras concorrentes não reemitem snapshot antigo. Single-flight de refresh do cliente preservado. Navegação externa inicial não envia Strict; recuperação ocorre por chamadas da própria origem. Conteúdo autenticado no-store; PDF/CSV continuam streaming. Adulteração/chave errada/tamanho excessivo falham sem revelar conteúdo.

Rotação da chave encerra envelopes antigos: coordenar revisão/versão e sessões no rollout/rollback. Ingresso real, cookies no domínio final, concorrência e deadlines Hosting: **NÃO TESTADOS**. Teste local não substitui provedor.

### Imagens e plano de deploy, sem execução

Manter `build-release-images.mjs --verify-reproducible`, commit limpo, semente privada BuildKit e insumos fixados. Promover OCI aprovados preservando digests conforme remediação existente; sem reconstruir por tag. Reutilizar Artifact Registry existente; criação/push/deploy dependem de acesso, revisão de custos e autorização posterior.

Os modelos backend/frontend cloud são JSON para --env-vars-file, sem senhas; copiar para nomes sem .example somente se não existirem. Completar backend com --prepare Neon, CORS exato e SMTP. Frontend: backend HTTPS canônico, IAM=true, hops medidos e modo Firebase, nenhum DB_*.

Após preencher digests e versões numéricas aprovados na configuração cloud privada:

```powershell
node scripts/homologation/prepare-deployment.mjs --plan
```

Gera `.env.cloud.deploy-plan.local`, sem executar comandos. Duas contas/serviços exatos, portas 8080/3000, mínimo 0 e **máximo do serviço 1** (`--min=0 --max=1`), CPU 1, memória backend 1Gi/frontend 512Mi, concorrência inicial 2/4, CPU sob demanda, timeout 60s e Hikari 5/0. Valores iniciais, não ensaio de capacidade. [Escala por serviço/revisão](https://cloud.google.com/run/docs/configuring/max-instances).

CPU sob demanda/mínimo zero não garantem execução das purgas agendadas no ocioso. Expiração JWT/refresh/rate é validada no uso; monitorar retenção das tabelas. Rotina externa/instâncias ativas exigem avaliação separada, sem habilitação automática.

Após criação autorizada, conceder run.invoker somente no backend à conta frontend; nunca allUsers no backend. Frontend público HTTPS também conserva endpoint run.app e precisa dos controles de aplicação. O hook Hosting exige aceite público, GCLOUD_PROJECT da CLI, projeto/número, metadata, digest/revisão prontos antes de pinTag. Sem publicação, inclusive preview, nesta entrega.

## DNS e HTTPS: leitura real

Consulta pública em 06/11/2026, 02h57 BRT: `node scripts/homologation/inspect-dns.mjs`. Evidência ignorada em logs/homologation/dns.json.

| Nome/tipo | Observado |
| --- | --- |
| Raiz NS | a.auto.dns.br / b.auto.dns.br |
| Raiz A/AAAA/CNAME | ENODATA |
| Raiz MX | prioridade 0, destino vazio, null MX |
| Raiz TXT | v=spf1 -all |
| www | ENOTFOUND nas consultas |

Nenhum registro/nameserver alterado. Não substitui auditoria autenticada da zona. Preservar MX/TXT e serviços existentes. Certificado/HTTPS final: **NÃO TESTADOS**, sem A/AAAA observado.

1. Confirmar site no projeto/número correto; nunca usar oficinagestao-homologaca-4848f.
2. Obter TXT/A/AAAA/CNAME exatos da API/console Firebase; o inspector exporta apenas exigências recebidas, nunca valores presumidos.
3. Reconciliar conflitos no Registro.br mantendo DNS gratuito e MX/TXT. Aplicar somente após aprovação pública.
4. Escolher raiz canônica; redirecionar www depois de confirmar domínio/certificado. Sem redirect antecipado no repositório.
5. Validar propagação, certificado ACTIVE, HTTPS, CSP/no-store, cookies e login/2FA/refresh/logout/downloads; CORS com origem exata.

Não houve resposta autenticada Firebase nesta sessão; não há registros de destino/verificação legítimos para aplicar manualmente. [Procedimento oficial](https://firebase.google.com/docs/hosting/custom-domain).

## Custos e contenção

Zero recursos cloud criados. Orçamento R$20/alertas é informação do operador, não relida por API, e não limita gastos. Sem faturamento/consumo autenticado, não é possível confirmar créditos/franquias ou estimar em reais.

| Serviço | Referência consultada e risco |
| --- | --- |
| Cloud Run request-based/us-central1 | Franquia agregada por billing account: 180.000 vCPU-s, 360.000 GiB-s, 2 milhões de requisições/mês; excedentes/cold starts/rede cobram. Min 0/max 1 não garante zero. [Preço](https://cloud.google.com/run/pricing) |
| Hosting clássico | 10 GB armazenamento e 10 GB/mês transferência; Blaze excedente $0,026/GB armazenamento e $0,15/GB transferido. Run separado. [Preço](https://firebase.google.com/docs/hosting/usage-quotas-pricing) |
| Artifact Registry | 0,5 GiB-mês agregado sem custo; medir imagens/retenção e tráfego. [Preço](https://cloud.google.com/artifact-registry/pricing) |
| Secret Manager | 6 versões ativas/10.000 acessos por mês agregados; Enabled/Disabled contam. Seis segredos permanentes só cabem se não houver outras versões consumindo franquia; bootstrap/rotação pode exceder, versão extra $0,06/mês. [Preço](https://cloud.google.com/secret-manager/pricing) |
| Logging | Primeiros 50 GiB/projeto/mês no padrão; excedentes/retenção adicional cobram. Sem segredos/códigos/corpos nos logs. [Preço](https://cloud.google.com/logging/pricing) |

Sem Cloud Build remoto, balanceador, Cloud SQL, Cloud DNS ou Scheduler. GitHub Actions tem custos/franquia próprios. Run us-central1 e Neon sa-east-1 implicam latência e possível tráfego externo: medir antes de estimar mensalidade.

Em consumo inesperado: preservar evidências/configurações; retirar Hosting com disable aprovado, remover acesso público do frontend para cessar novas invocações, confirmar mínimo zero/requisições terminadas e revisar SKUs. Não apagar banco/segredos/backups. Remoção definitiva de serviços/imagens exige autorização e artefatos de rollback. Não há teto automático pelo orçamento.

## Rollback e evidências

Capturar antes da publicação: revisão/digest, versões dos segredos, env/IAM e release Hosting anteriores. Rollback direciona tráfego à revisão aprovada e restaura release Hosting fixada; conferir chave do envelope/schema. Sem SQL destrutivo. Recuperação de dados depende de backup/PITR comprovado.

- Backend clean verify: **845 testes**, zero falhas/erros/skips, PostgreSQL 16 descartável; B24/compatibilidade, Spring/Hibernate, segurança e negócio.
- Frontend: **384 testes**, lint, TypeScript app/E2E, build e três testes de chaves de build aprovados.
- Infra local: **18 testes** de parsing/rotação/isolamento/TLS/SMTP/GCP/Hosting/plano aprovados.
- Chromium: **119 cenários** aprovados na porta alternativa 3100, sem backend operacional.
- test-firebase-session-local.mjs: Next standalone → Spring → PostgreSQL novo/B24 + SMTP Mailpit reais locais; 2FA entregue, envelope protegido, CSRF negativo, cadastro/OS sintéticos, PDF, refresh/logout aprovados. Containers/volumes exclusivos removidos ao terminar.
- B24/V1–V24/defaults/bundle aprovados. Arquivos privados ignorados e excluídos dos contextos Docker; sem senha obtida da imagem/chat. CI inclui nova integração.

IAM/negativas remotas, segredos efetivos, Neon TLS real, SMTP externo, Hosting real, certificado, backup/restore, capacidade e custos reais: **NÃO TESTADOS** por acesso/rotação/isolamento/autorização. Local não aprova infraestrutura.

## Veredito

| Item | Estado |
| --- | --- |
| NEON | BLOQUEADO — rotação/configuração elegível/isolamento |
| FLYWAY | AGUARDANDO AUTORIZAÇÃO — B24 aprovada somente localmente |
| BACKEND CLOUD RUN | PENDENTE — código/configuração preparados; acesso/segredos/Neon/SMTP remotos |
| FRONTEND CLOUD RUN | PENDENTE — código/configuração preparados; digest/segredos/ingresso/IAM remotos |
| FIREBASE HOSTING | PENDENTE — configuração/adaptação aprovadas localmente; site/reescrita remotos |
| DNS E HTTPS | PENDENTE — DNS lido; registros Firebase e publicação não autorizados |
| HOMOLOGAÇÃO GERAL | NO-GO |
| PRODUÇÃO | NO-GO |
