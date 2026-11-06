# Neon exclusivo de homologação — preparação segura

Data: 06/11/2026. Base auditada: `main`, `fb64a44f1171b4320c439ac608fbfdd8411efd94`.
Projeto alvo: `oficinagestao-homologacao`. Não há criação de recursos cloud, migrations remotas ou deploy nesta entrega.

## Estado

| Verificação | Resultado |
| --- | --- |
| CONEXÃO NEON | NÃO TESTADA — aguarda preenchimento do arquivo privado com destino elegível |
| ISOLAMENTO DO BANCO | INCONCLUSIVO — projeto/branch remoto ainda não inspecionado |
| FLYWAY B24 | BLOQUEADO remotamente; baseline e compatibilidade aprovadas em PostgreSQL descartável local |
| BACKEND PREPARADO PARA CLOUD RUN | SIM — configuração e trava preparadas; SMTP, IAM real e deploy pendentes |
| PRODUÇÃO | NO-GO ATÉ HOMOLOGAÇÃO REAL |

A URL da solicitação não foi copiada para arquivos: banco padrão e TLS `require` não atendem aos critérios. O exemplo contém somente placeholders. Não houve conexão com esse destino. `.env` e `backend/.env` existentes foram preservados. Nenhuma migration histórica foi alterada.

## Auditoria antes das alterações

| Área | Configuração/dependências encontradas |
| --- | --- |
| Datasource | `backend/src/main/resources/application.properties`: DB_URL/DB_USERNAME/DB_PASSWORD, PostgreSQL JDBC, Hibernate `validate`, Flyway habilitado e sem baseline administrativa automática |
| Profiles | `application-dev.properties`: fallback JWT apenas em dev. `application-prod.properties`: segredos, CORS HTTPS, cookies Secure e SMTP autenticado com STARTTLS obrigatório e identidade validada |
| Dotenv | `DotenvEnvironmentPostProcessor` lê o primeiro `.env` encontrado e respeita variáveis de processo. Não passa a ler homologação; conexão local preservada |
| Pool | Hikari máximo 10, mínimo 2, conexão 20s, lifetime 600s, idle 300s e keepalive 120s. Arquivo gerado propõe máximo 5 e mínimo 0; dimensionar instâncias conforme limite Neon |
| Dependências | Java 21, Boot 4.0.9, Hibernate via JPA/Boot, Flyway 11.14.1 core/PostgreSQL, pgJDBC 42.7.12. Nenhuma dependência adicionada |
| Histórico | B24 neutra presente; `scripts/legacy-migrations-v24.json` fixa SHA-256 de V1–V24; checker compara a baseline reconstruída sem executar SQL |
| Testes | `ProductionMigrationPathTest`: banco novo somente B24, equivalência de schema, upgrade V21, preservação V24 e recusa de banco não versionado com dados |
| Templates | `.env.example`, `.env.homolog.example`, `.env.production.example`: separação backend/frontend. Homologação já usa JDBC `verify-full` e truststore Java |
| Consumidores DB_* | Datasource Spring; Compose legado; `scripts/test-real-stack-local.mjs` com valores sintéticos próprios; workflows de teste com TEST_DB_* ou credenciais descartáveis. Backup possui configuração separada em `scripts/backup.env.example` / `backup-neon-offsite.sh`. Frontend não consome DB_* |
| Docker | Backend copia pom/src/main e executa jar sem root. Frontend copia fontes no próprio contexto, com `.dockerignore`. Arquivos privados fora de ambos; build de release usa `git archive` do commit |
| Cloud Run | `docs/deployment-google-cloud-run.md`, `scripts/build-release-images.mjs` e roteiro de remediação: imagens por digest; frontend público → backend privado por IAM. O antigo `check-cloud-run.mjs` exige projeto `*-security-test`; não foi executado nem flexibilizado para este projeto |

JWT, 2FA, CSRF, CSP, rate limiting e validações `prod` são preservados. O frontend continua comunicando somente com a API REST por proxy server-side.

## Arquivos da entrega

- `.env.homolog.local.example`: campo privado NEON_HML_URL, hostname esperado e declaração de isolamento.
- `.env.homolog.example`: vincula o modelo remoto ao gate de homologação, mantendo migrations bloqueadas por padrão.
- `.gitignore` e `.dockerignore`: proteção do arquivo real e de arquivos privados aninhados.
- `scripts/homologation/neon-hml.mjs`: parsing, conversão JDBC sem senha e bloqueio de endpoints operacionais locais, incluindo alias pooler.
- `configure-neon-hml.mjs`: checks offline, preparação privada sem senha e inspeção JDBC opcional sem migrations.
- `CheckNeonTls.java`: transação somente leitura, certificado/hostname, TLS, identidade SQL e ausência de objetos de usuário.
- `prepare-neon-secrets.mjs`: plano por metadados do Secret Manager, sem alterar recursos/versões/IAM.
- `HomologationDatabaseGuard.java` / `FlywayConfig.java`: trava anterior a migrate() em APP_ENVIRONMENT=homologation.
- Testes Node/Java e CI; testes antigos da estratégia recebem somente o parâmetro Environment.
- Este roteiro e referência no guia de deploy existente.

## Preencher o arquivo privado

Pré-requisitos: projeto/branch Neon novos e exclusivos; banco **vazio** `oficina_security_test`; role exclusiva contendo `security_test`; senha forte; cadeia de certificados reconhecida por Java 21. Não reutilize o papel proprietário operacional. Confirme no console Neon a exclusividade do projeto/branch: endpoint diferente não comprova isolamento por si só.

```powershell
Copy-Item .env.homolog.local.example .env.homolog.local
# Edite o arquivo privado em um editor local, sem colar a URL no terminal.
```

Preencha NEON_HML_URL com o novo destino, `sslmode=verify-full` e `channel_binding=require`. Codifique caracteres especiais de usuário/senha com percent-encoding. Preencha NEON_HML_EXPECTED_HOST com o hostname confirmado. Só após confirmar projeto/branch exclusivos, defina NEON_HML_ISOLATED=true. Outro banco deve terminar em `_security_test` e constar exatamente em NEON_HML_APPROVED_DATABASE.

Não use neondb, postgres, endpoints operacionais, placeholders ou TLS disable/allow/prefer/require/verify-ca. São permitidos somente sslmode e channel_binding, sem parâmetros duplicados/arbitrários. Revise os privilégios da role antes de autorizar inicialização.

Node 22+; executar na raiz:

```powershell
node --env-file=.env.homolog.local scripts/homologation/configure-neon-hml.mjs --check
node --env-file=.env.homolog.local scripts/homologation/configure-neon-hml.mjs --prepare
node --env-file=.env.homolog.local scripts/homologation/configure-neon-hml.mjs --inspect
```

`--check` é offline: inclui B24/V1–V24 e proteção Git. `--prepare` cria `.env.homolog.backend.local` em JSON, sem senha, sem sobrescrever arquivo existente. Serve como base para `--env-vars-file` do gcloud após completar CORS/SMTP; não é um dotenv. Nenhum comando modifica `.env` ou `backend/.env`.

`--inspect` usa o JDBC fixado no pom, no cache Maven padrão. Se faltar, execute `backend/mvnw dependency:go-offline`. Senha somente pelo ambiente Java; nenhum segredo em argv. Overrides JVM são recusados. Verifica CA, hostname, channel binding, TLS 1.2/1.3, banco/usuário SQL e banco vazio. Timeouts de conexão/socket 10s e statement 5s. Saída sanitizada informa protocolo TLS sem identificadores ou stacktrace JDBC. Não há modo que aceite TLS não validado.

Sem arquivo, `node scripts/homologation/configure-neon-hml.mjs --check` explica onde preencher. Com --env-file, o próprio Node verifica a existência antes de iniciar o script. Banco não vazio falha na inspeção; não será limpo nem reparado.

## Flyway: autorização posterior obrigatória

Não iniciar uma aplicação contra o novo banco nesta etapa. Não usar clean, repair, baseline administrativo ou alterar checksums.

Após preenchimento, revisar evidências de --inspect, projeto/branch, role dedicada, banco vazio e `node scripts/check-flyway-baseline.mjs`. Solicitar autorização explícita **para inicializar aquele destino exato**. Esta entrega não executa essa inicialização.

O arquivo gerado mantém HML_MIGRATIONS_APPROVED=false. Somente depois da autorização, o operador poderá ajustar esse valor na configuração privada e iniciar o backend aprovado com:

- SPRING_PROFILES_ACTIVE=prod e APP_ENVIRONMENT=homologation;
- DB_URL/DB_USERNAME gerados e DB_PASSWORD via Secret Manager;
- HML_NEON_ISOLATED=true, HML_DB_HOST/HML_DB_NAME/HML_DB_USER e HML_APPROVED_DATABASE quando aplicável;
- JWT, rate, proxy, CORS HTTPS e SMTP/2FA de homologação com todas as validações prod.

A estratégia exige aprovação antes de interagir com Flyway. Depois verifica URL efetiva exata, identidade SQL, TLS, Hibernate validate, locations e ausência de baseline administrativa. Banco novo exige ausência de relações, tipos e rotinas em todos os schemas não sistêmicos e plano somente B24 pendente, sem V11/V12. Não chama validate() isoladamente antes da primeira migration, pois Flyway rejeita migrations ainda pendentes; migrate() mantém sua validação normal. Reinicialização exige histórico B24 bem-sucedido, sem versões anteriores/falhas; checksums continuam validados normalmente.

A primeira execução deve registrar somente B24__neutral_initial_schema.sql, SQL_BASELINE, versão 24. V11/V12 ficam abaixo dessa baseline. Isso é uma **baseline migration**, diferente do comando administrativo baseline: [documentação Flyway](https://documentation.red-gate.com/flyway/flyway-concepts/migrations/baseline-migrations).

Após inicialização autorizada, comprovar flyway.validate(), Hibernate validate, histórico sem falhas e ausência de dados operacionais. B24 insere configuração neutra, role e seis categorias; não cria usuários/clientes/OS. Bootstrap sintético somente quando solicitado. Constraints, índices, sequências e relacionamentos são comparados integralmente ao schema histórico nos testes locais; confirmar schema remoto no ensaio real.

## Secret Manager e deploy posterior por digest

```powershell
node --env-file=.env.homolog.local scripts/homologation/prepare-neon-secrets.mjs --plan
```

Exige gcloud, login e leitura de metadados em oficinagestao-homologacao. Verifica existência e versões de DB_PASSWORD, MAIL_PASSWORD e INITIAL_ADMIN_PASSWORD; não lê conteúdos existentes. Sem arquivo privado, não chama gcloud.

Não há criação paga nesta fase. Procedimento futuro sujeito à autorização correspondente:

1. Inspecionar metadados antes de criar segredos. Se já houver versões, preservá-las; adicionar versão somente após aprovação explícita.
2. Para DB_PASSWORD, extrair apenas config.password com loadPrivateConfiguration, nunca a URL completa. Enviar bytes diretamente ao stdin de `gcloud secrets versions add DB_PASSWORD --data-file=- --project=oficinagestao-homologacao`, capturando stdout/stderr e sanitizando erros. Não usar echo, senha em argumento ou pipeline de log.
3. MAIL_PASSWORD vem exclusivamente do SMTP de homologação. INITIAL_ADMIN_PASSWORD é opcional para bootstrap sintético; remover referência após criação.
4. Conceder roles/secretmanager.secretAccessor **no segredo DB_PASSWORD** somente a oficina-backend-hml@oficinagestao-homologacao.iam.gserviceaccount.com. Auditar IAM herdado de projeto/pasta/organização; política do segredo sozinha não comprova exclusividade. Frontend e denied não podem receber acesso. Não conceder acesso global.
5. Após gates e autorização de deploy, usar `REGION-docker.pkg.dev/PROJECT/REPOSITORY/backend@sha256:DIGEST`. Seguir `docs/homologacao-gcp-20261104/remediacao.md` para promover artefatos reprodutíveis sem reconstruir por tag.
6. Preparar gcloud run deploy com projeto explícito, digest, `--service-account=oficina-backend-hml@oficinagestao-homologacao.iam.gserviceaccount.com`, `--no-allow-unauthenticated`, arquivo privado de variáveis e `--set-secrets=DB_PASSWORD=DB_PASSWORD:VERSION,JWT_SECRET=JWT_SECRET:VERSION,RATE_LIMIT_SECRET=RATE_LIMIT_SECRET:VERSION,SERVICE_PROXY_SECRET=SERVICE_PROXY_SECRET:VERSION,MAIL_PASSWORD=MAIL_PASSWORD:VERSION`. Fixar versões numéricas aprovadas; completar região, serviço, CORS, SMTP e limites. Esta entrega não executa o comando.
7. Conceder invocação somente à identidade frontend; testar negações anônima/denied/audience incorreta. Frontend recebe só URL interna, segredo de contexto do proxy e hops validados; nenhum DB_*.

Fontes: [Secret Manager: stdin para versões](https://cloud.google.com/secret-manager/docs/add-secret-version), [pgJDBC: validação de CA e hostname](https://jdbc.postgresql.org/documentation/ssl/), [Neon: conexão segura](https://neon.com/docs/connect/connect-securely).

## Evidências e pendências

- Backend: `mvnw.cmd -B -ntp clean verify` final aprovado com 845 testes, zero falhas/erros/skips. PostgreSQL 16 descartável em loopback:5433, credenciais sintéticas; inclui Spring sintético, B24 e compatibilidade V21/V24. Os 7 testes focados da estratégia/trava também passaram.
- Node: 13 testes aprovados de parsing de caracteres especiais, isolamento, downgrade, parâmetros duplicados, ausência de vazamento, arquivo obrigatório, CLI e geração privada sem senha. TLS local comprova hostname correto, rejeição de hostname incorreto/CA desconhecida e SMTP sem downgrade. Isso não aprova Neon remoto.
- Frontend: 378 testes, lint, TypeScript app/E2E e build aprovados. Chromium: 109 passaram inicialmente; 10 de logout recusaram a origem porque E2E_BASE_URL não acompanhava a porta alternativa 3100. Os 10 passaram após fornecer E2E_BASE_URL=http://localhost:3100, sem alteração de código ou controles.
- Docker: três builds sintéticos FROM scratch com exportação de filesystem e regras da raiz/backend/frontend confirmaram arquivo privado excluído e controle público presente. Git exclui os privados; release usa git archive.
- check-flyway-baseline.mjs/check-neutral-defaults.mjs aprovados; CI roda os checks sem credenciais Neon.

Nenhum recurso Google Cloud configurado nesta entrega: arquivo privado ausente e gcloud indisponível no ambiente. APIs, contas IAM e três segredos informados pelo solicitante não foram revalidados. Nenhuma versão criada ou sobrescrita.

Pendências: preencher destino elegível, confirmar projeto/branch e privilégios, comprovar JDBC/certificado remoto, autorizar B24 isolada, configurar SMTP/2FA/segredos/IAM e, em tarefa posterior, publicar por digest e ensaiar restauração/capacidade. A declaração local não prova exclusividade do projeto. A trava depende de manter APP_ENVIRONMENT=homologation no deploy revisado. Produção permanece NO-GO.
