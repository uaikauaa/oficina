# Etapa 3.4 — auditoria funcional isolada

Data: 11/11/2026. Base funcional: PR #27, `69ef399ff665548d47acfd03f3de5d001efebd50`. Branch: `audit/admin-stage34-final`. Este relatório descreve apenas verificações observadas; o SHA final e o CI desta branch devem ser conferidos no PR draft.

## Estado Git e governança

Os PRs #21–#27 estão abertos. A cadeia funcional de bases é #21 (`main`) → #22 → #23 → #24 → #25 → #27. O PR #26 é uma ramificação paralela de #25 para `AGENTS.md` e `SECURITY.md`; seu head é `c5caa53b7b9db330c9af13835cace2b09e6e71c6`. O PR #27 e o PR #26 são mergeable segundo o GitHub, mas isso não constitui autorização de merge. O diff da governança contra a base #25 contém somente aqueles dois arquivos. O checkout funcional original tinha mudanças locais preexistentes em `AGENTS.md`, imagens e arquivos não rastreados; não foram incorporadas à branch 3.4.

Os quatro workflows do SHA de referência #27 concluíram com sucesso: CI Pipeline, Flyway/E2E complementar, integração real e Oracle Readiness. No SHA do #26, três passaram e a integração real falhou. O artefato da falha mostra navegação a `/dashboard` após resposta 200 do 2FA, porém a captura ficou em `Verificando sessão`: o GET `/api/auth/me` pós-2FA ainda estava pendente quando a asserção visual terminou após 5 s. Recursos Next responderam 200 e o log Spring não contém erro correspondente. Logo, não há evidência de seletor incorreto ou exceção de backend; uma espera curta pelo estabelecimento da sessão é hipótese plausível, ainda sem reprodução independente. A mesma asserção passou na integração real do SHA #27 e no ensaio local 3.4. Não houve alteração de timeout nem remoção de asserção. Antes de integrar #26, repetir seu workflow e, se falhar, correlacionar trace e tempo do `/api/auth/me`.

## Matriz e jornadas observadas

`RoleMatrixRouteIntegrationTest` percorreu o catálogo HTTP com JWT real e grants persistidos para `ROLE_SUPER_ADMIN`, `ROLE_OPERADOR_GERAL`, `ROLE_ADMIN`, `ROLE_GERENTE`, `ROLE_ATENDENTE`, `ROLE_TECNICO`, `ROLE_ESTOQUISTA`, `ROLE_FINANCEIRO` e `ROLE_CONSULTA`. Cada rota negada exige 403; cada rota concedida rejeita 401/403/5xx. Isso verifica a autorização de entrada, mas uma resposta 400/404 a payload/ID sintético não demonstra sucesso de operação. Os testes existentes de integração cobrem objetos, papéis personalizados, revogação, último SUPER_ADMIN, recuperação e minimização de CONSULTA. Os três testes Playwright reais cobrem login/2FA, cliente, máquina, produto, estoque, OS, PDFs/relatório; provisionamento, convite, papel personalizado e telas administrativas; recuperação, replay e novo login 2FA. O ensaio percorre cinco viewports administrativos. O papel operacional sintético executou operações persistentes selecionadas; CONSULTA teve negativas reais de API.

| Papel | Comprovado nesta auditoria | Lacuna para fechamento integral |
|---|---|---|
| SUPER_ADMIN | Catálogo de rotas, provisionamento e administração sintética, convite, papéis, auditoria, sessões | Todas as mutações/estados do painel em browser e infraestrutura sob falhas |
| OPERADOR_GERAL | Catálogo, negativas administrativas, cadastros, estoque, OS, PDFs e relatórios reais | Ciclo completo de cancelamento/conclusão/inativação, financeiro e CSV sob todos os estados |
| ADMIN legado | Catálogo e bootstrap sintético | Jornada browser própria |
| GERENTE, ATENDENTE, TECNICO, ESTOQUISTA, FINANCEIRO | Positivos/negativos HTTP sobre grants persistidos | Operações válidas persistentes por papel e jornada browser representativa |
| CONSULTA | Leituras permitidas, negativas administrativas/financeiras e minimização | Revisão com dados representativos e jornada browser |
| Personalizado | Criação, edição e atribuição sintéticas | Combinações de grants e fronteiras por objeto |

Não foi executada a matriz integral de operações válidas por papel. Não foi verificada a cobertura visual completa de busca, filtros, paginação, estados vazios, carregamento, rede instável, reenvio, teclado/foco e overflow nas cinco larguras com a stack real. Logo, o painel ainda não pode ser declarado plenamente testado.

## SMTP 550 real

Dois testes novos usam servidor SMTP em loopback que retorna `550 5.1.1` a `RCPT TO`, `JavaMailSenderImpl` e o `InviteOutbox` real contra PostgreSQL descartável. Um percorre convite confirmado → outbox → worker → transporte de rede → 550 → persistência. O outro repete o caminho para recuperação. Ambos verificam uma tentativa SMTP, ausência de nova seleção para retry, `EXHAUSTED`, categoria `SMTP_PERMANENT`, nonce/ciphertext nulos e evento de auditoria associado ao ID sem token. O serviço de transporte, o banco e o worker são reais nesses testes; a solicitação é feita pelo service Spring, não por Chromium. O Playwright real com Mailpit comprova o caminho HTTP e de envio bem-sucedido separadamente. Assim, a combinação HTTP → 550 no mesmo ensaio de navegador ainda não foi executada. O 2FA real continuou funcional no ensaio de integração após esses testes.

## Sessões, recuperação, auditoria e configuração

Sessões: os testes existentes cobrem inventário, sessão atual, revogação individual/das demais/geral, bloqueio de IDs de terceiros, rotação do refresh e invalidação após recuperação e mudança de privilégios. A revogação individual bloqueia refresh imediatamente, porém o access JWT já emitido pode continuar por até 15 minutos. Para perfis administrativos, isso deixa uma janela de acesso após uma ação explícita de revogação. Proposta antes da homologação: incluir `session_id` no access JWT e consultar estado de revogação no filtro de autenticação para as rotas administrativas, preservando `token_version` e o fluxo de refresh. Regressão necessária: duas sessões reais, revogar uma, provar 401 imediato para seu access JWT e continuidade da outra, inclusive após rotação de refresh. Esta mudança ainda não foi implementada.

Recuperação: uso único, expiração, replay, 2FA e invalidação de sessões têm testes de integração e browser real. A solicitação para e-mails existentes e inexistentes retorna o mesmo status/corpo previsto; a diferença estatística de tempo de resposta não foi medida. Não há base para afirmar ausência de enumeração temporal.

Auditoria: filtros, ordenação, paginação, permissão e ausência de segredo em eventos novos têm testes. A política efetiva permanece sem exclusão automática. Antes de ativar dados reais, definir prazo, base legal, volume esperado, arquivo cifrado, acesso e procedimento de purga/restauração. Estimar armazenamento pela taxa observada de eventos e tamanho médio de linha após carga representativa; não há amostra operacional autorizada para um número confiável agora.

Configuração: as fontes declaradas são variáveis do processo/Secret Manager; `.env` local só em desenvolvimento e é ignorado em `test`, `prod` e `production`. Backend exige `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET`, `RATE_LIMIT_SECRET`, `SERVICE_PROXY_SECRET`, `INVITE_OUTBOX_KEYS`, `INVITE_OUTBOX_ACTIVE_VERSION`, `APP_PUBLIC_URL`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_FROM`, `MAIL_USERNAME`, `MAIL_PASSWORD` e controles SMTP/TLS. Frontend exige `INTERNAL_BACKEND_URL`, `SERVICE_PROXY_SECRET`, `CLOUD_RUN_IAM`, `TRUSTED_PROXY_HOPS` conforme o destino. `PASSWORD_RECOVERY_EXPIRATION_MINUTES`, `SECURITY_COOKIE_SECURE`, `CORS_ALLOWED_ORIGINS` e `SPRING_PROFILES_ACTIVE` devem ser fixados por ambiente. `NEON_PROJECT_ID`, `NEON_API_KEY`, `GOOGLE_CLOUD_PROJECT_ID` e `GOOGLE_CLOUD_RUN_SERVICE` são opcionais para fontes de infraestrutura. Confirmar nomes e obrigatoriedade finais com `application.properties`, `next.config.ts` e modelos `.env.*.example` antes da primeira inicialização. Nenhum valor operacional foi inspecionado ou alterado. TLS Neon exige `verify-full`; SMTP produtivo exige STARTTLS e validação do servidor.

| Fonte privada prevista | Nomes exatos |
|---|---|
| Secret Manager → backend | `DB_PASSWORD`, `JWT_SECRET`, `RATE_LIMIT_SECRET`, `INVITE_OUTBOX_KEYS`, `MAIL_PASSWORD`; `INITIAL_ADMIN_PASSWORD` apenas no provisionamento controlado |
| Secret Manager → backend e frontend, mesma versão | `SERVICE_PROXY_SECRET` |
| Configuração de ambiente → backend | `SPRING_PROFILES_ACTIVE`, `DB_URL`, `DB_USERNAME`, `APP_PUBLIC_URL`, `INVITE_OUTBOX_ACTIVE_VERSION`, `PASSWORD_RECOVERY_EXPIRATION_MINUTES`, `SECURITY_COOKIE_SECURE`, `CORS_ALLOWED_ORIGINS`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_FROM`, `MAIL_SMTP_AUTH`, `MAIL_SMTP_STARTTLS`, `TRUSTED_PROXIES` |
| Configuração de ambiente → frontend | `INTERNAL_BACKEND_URL`, `CLOUD_RUN_IAM`, `TRUSTED_PROXY_HOPS` |
| Opcionais de infraestrutura | `NEON_PROJECT_ID`, `NEON_API_KEY`, `GOOGLE_CLOUD_PROJECT_ID`, `GOOGLE_CLOUD_RUN_SERVICE`, `INFRA_DATABASE_PROVIDER`, `INFRA_CACHE_TTL_SECONDS` |

## Regressão executada e limites

| Gate | Resultado local |
|---|---|
| Maven `clean verify` no SHA base, guard `TEST_DB_*`, PostgreSQL 16 descartável | 884 testes; 0 falhas, erros ou skips |
| Maven `clean verify` após o diff 3.4, mesmo banco descartável | 886 testes; 0 falhas, erros ou skips; JAR gerado |
| Frontend unitário, ESLint, TypeScript, Next build | 379 testes; demais comandos passaram |
| Flyway oficial em banco novo descartável | B24 → V25–V28 aplicado; `validate` passou; 0 usuários criados |
| Caminhos V1–V28 sintéticos/upgrade | Cobertos pela suíte Maven; sem alteração de migrations |
| Playwright integrado, Next → Spring → PostgreSQL → Mailpit | 3 cenários passaram; duas JVMs, rate limit compartilhado, reinício e entrega pendente única passaram |
| SMTP 550 por rede com PostgreSQL e worker | Convite: 14 testes focados; recuperação: 7 testes focados; 0 falhas/skips |
| Playwright mockado | 115 passaram; 0 falhas/skips |
| Verificação de segredos no SHA funcional 3.4 | Gitleaks, Trivy e SBOM passaram no CI; sem scanner local instalado |
| CI do SHA funcional 3.4 `3463f75945c69d647252183bc18b1ed6eee389bf` | 4/4 workflows passaram: CI Pipeline, Flyway/E2E complementar, integração real e Oracle Readiness |

Houve uma invocação Maven intermediária inválida por interpretação PowerShell do parâmetro `-D`; a execução corrigida passou. O `npm ci` registrou sete alertas moderados de dependências; sem avaliação de explorabilidade nesta etapa.

## Veredito e handoff

**NO-GO para declarar a pré-homologação técnica definitivamente encerrada ou iniciar operações no Neon original.** Há evidência forte para os fluxos centrais isolados e a falha SMTP 550, porém a matriz de mutações por papel, os estados completos do painel, a política de revogação administrativa e a medição temporal da recuperação permanecem abertos. O CI do commit documental final deve ser reconferido no PR. Um futuro **GO para preparar a homologação** permitiria apenas diagnóstico controlado e preparação do backup, sem autorizar migrations, startup no Neon original, contas, papéis, merge ou deploy.

Etapa 4, em ordem e mediante autorização específica para cada operação real: (1) confirmar identidade do projeto/branch/banco/role Neon; (2) preparar credenciais privadas e segregadas; (3) validar TLS `verify-full`; (4) criar backup cifrado; (5) restaurá-lo e comparar integridade; (6) ensaiar V25–V28 na cópia; (7) auditar efeitos de startup; (8) preparar identidade e provisionamento do SUPER_ADMIN; (9) preparar transição reversível da Geisa; (10) definir parada e rollback; (11) solicitar autorização explícita para cada ação no destino original. Nenhum desses passos foi executado nesta etapa.
