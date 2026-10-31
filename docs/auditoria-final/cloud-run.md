# Cloud Run — validação e limites

## O que foi comprovado

| Controle | Evidência local | Limite |
|---|---|---|
| Dois serviços independentes | Duas imagens e contêineres separados; Next → REST Spring → PostgreSQL | Não houve implantação GCP |
| Porta e interface | Backend e frontend responderam 200 em `PORT=8081`, acessíveis por porta publicada; defaults 8080/3000 | Ingress/TLS GCP não testados |
| Encerramento | SIGTERM: backend ~431 ms, frontend ~334 ms; código 143; log Spring confirma graceful shutdown e fechamento Hikari | Sem requisição longa em andamento; fase Spring limitada a 8 s |
| Runtime | Java Temurin 21.0.13; Node 22.23.4; usuários app/nextjs sem root | Tags base ainda móveis; usar digest na promoção |
| Memória | Contêiner limitado a 1 GiB/1 CPU: backend ~408 MiB após startup; frontend limitado a 512 MiB/1 CPU ~44 MiB em smoke | Medida pontual, não benchmark de pico. Execução sem limite chegou a ~883 MiB no backend |
| Persistência | PDF em memória, estado no PostgreSQL; Next assets/cache locais reconstruíveis | Disco Cloud Run efêmero; não armazenar backups nele |
| Inicialização/Flyway | 22 migrations reais aplicadas em banco descartável e validadas em outra inicialização | Não comprova compatibilidade com schema/checksums existentes no Neon |
| PostgreSQL | Reconexão Hikari confirmada após restart do banco local | Não equivale à suspensão serverless/TLS/latência Neon |
| SMTP | 2FA real via Mailpit; teste negativo recusa servidor sem STARTTLS em configuração obrigatória | Mailpit local sem TLS; provedor real não acessado |
| Proxy | Métodos GET/POST/PUT/PATCH/DELETE, cookies/CSRF, dois Set-Cookie, PDF byte a byte e 401/403/404/429/500 preservados | Fixture de erro testa transporte; autorização real testada separadamente |
| Backend direto | APIs sem sessão retornam 401; papéis não ADMIN 403 em testes por rota | Backend público continua atacável diretamente; CORS não é firewall |

O [contrato Cloud Run](https://docs.cloud.google.com/run/docs/container-contract) exige escuta na porta fornecida e tratamento do ciclo de encerramento. A aplicação agora lê `PORT`, com fallback para `SERVER_PORT`; o healthcheck Docker também segue a porta. Cloud Run exige configuração própria de probes, não importa automaticamente o HEALTHCHECK Docker.

## Build versus runtime do frontend

O PR #10 corrige a entrada de `INTERNAL_BACKEND_URL` **durante o build**. O destino fica no manifesto de rewrites do Next. Não é uma variável dinâmica de roteamento.

Nesta auditoria, o runner deixa de declarar um default enganoso. `docker-entrypoint.mjs` lê `.next/routes-manifest.json` e, se a variável existir no runtime e diferir do build, aborta. Sem variável no runtime, usa o manifesto. A variável de build não pode conter usuário/senha, query, fragmento ou caminho adicional. No Cloud Build exige-se HTTPS; HTTP é mantido exclusivamente para Compose/testes locais.

Consequência operacional: cada ambiente/backend diferente requer imagem frontend correspondente. Publicar imagem de homologação com variável de produção não a transforma em imagem de produção; agora essa divergência falha explicitamente. A origem do backend não é segredo, mas nenhum token/credencial deve ser usado como build ARG.

## Backend público e alternativa IAM

O rewrite atual não obtém ID token do Google. Tornar o backend privado sem alterar o proxy resulta em bloqueio da plataforma antes do Spring. Para IAM entre serviços, implementar proxy server-side com credenciais da conta frontend, audience da URL backend e cache/renovação de ID token. Preservar cookie/JWT da aplicação; `X-Serverless-Authorization` permite separar a autenticação de plataforma do header Authorization da aplicação. Conceder `roles/run.invoker` apenas no backend à conta frontend. Essa adaptação **não foi implementada nem validada**. [Documentação oficial](https://docs.cloud.google.com/run/docs/authenticating/service-to-service).

Se optar por backend público, aprovação exige testes diretos, limitação de abuso e controle de ingress. `TRUSTED_PROXIES` vazio impede spoof trivial, mas pode concentrar usuários sob o IP do proxy e provocar lockout coletivo. Não preencher com `0.0.0.0/0` nem aceitar XFF sem cadeia confiável demonstrada. O limitador em memória não acompanha escala a zero/novas instâncias.

## Configuração proposta para homologação

| Item | Frontend | Backend |
|---|---|---|
| CPU / RAM inicial | 1 CPU / 512 MiB | 1 CPU / 1 GiB, medir PDF e cold start |
| Porta | 3000 (ou PORT) | 8080 (ou PORT) |
| Mínimo / máximo | 0 / 1 no piloto | 0 / 1 no piloto |
| Concorrência inicial | 4, medir SSR | 4, coerente com pool inicial |
| Timeout HTTP inicial proposto | 60 s | 60 s; revisar contra duração real de SMTP/PDF |
| Startup probe | /login; tolerância suficiente para cold start | /api/health; tolerância suficiente para Flyway + conexão |
| Liveness | verificar processo sem depender do Neon | não reiniciar em massa só porque banco externo ficou indisponível |
| Dados sensíveis | nenhum segredo DB/SMTP/JWT | Secret Manager por versão; JWT, DB_PASSWORD, MAIL_PASSWORD |

Proposta não é valor configurado nem capacidade garantida. Timeout do Cloud Run não garante cancelamento imediato do trabalho na aplicação; alinhar timeouts de cliente, proxy, SMTP e banco. [Timeouts](https://docs.cloud.google.com/run/docs/configuring/request-timeout).

Usar `SPRING_PROFILES_ACTIVE=prod`, cookies Secure, Swagger/OpenAPI false, logs sem SQL/debug, `HIKARI_MAX_POOL_SIZE=4`, `HIKARI_MIN_IDLE=0`. Orçamento de conexões: pool × instâncias simultâneas × revisões ativas, mais migrations/admin e margem; max-instances não deve ser tratado como prova de teto absoluto durante troca de revisões. Validar o limite contratual do Neon.

## TLS, migrations e backup

O guia do PR #10 indicava `sslmode=require`. No pgJDBC isso cifra a conexão, mas não valida integralmente a identidade do servidor. Para homologação/produção exigir `sslmode=verify-full` e uma cadeia CA confiável; por exemplo, usar `org.postgresql.ssl.DefaultJavaSSLFactory` com truststore Java contendo a CA correta. Confirmar hostname, cadeia e rejeição de certificado incorreto, sem copiar a connection string para logs. [pgJDBC SSL](https://jdbc.postgresql.org/documentation/ssl/).

Nenhuma migration existente foi alterada. Hibernate permanece `ddl-auto=validate`, Flyway sem baseline automático. Antes de conectar ao Neon existente, comparar versões/checksums e revisar diff de schema. Inicializações simultâneas dependem do lock Flyway e podem consumir conexões; testar duas revisões na branch Neon de homologação. O teste local de segundo startup validou migrations já aplicadas, mas não foi um ensaio completo de rollout concorrente na nuvem.

Backup local: `pg_dump -Fc` → banco novo → `pg_restore --exit-on-error`; contagens conferidas para migrations/clientes/máquinas/OS/movimentos: `22|1|1|1|4` no ensaio. Isso valida a mecânica de restauração, não PITR, retenção ou RPO/RTO do Neon. Definir cópia externa criptografada, acesso mínimo, retenção, restauração periódica e evidência de RPO/RTO. Os scripts Oracle/VPS não executam automaticamente no Cloud Run.

## Infraestrutura: não verificada no projeto real

Nenhum estado GCP foi consultado. Os itens seguintes são exigências verificáveis, não resultados positivos:

- Contas distintas para frontend, backend, build e deploy; sem Owner/Editor de projeto para runtime.
- Secret Accessor somente nos segredos necessários ao backend; frontend sem credenciais DB/SMTP.
- Artifact Registry privado, writer só para build, leitores mínimos; scanning e retenção de imagens.
- GitHub OIDC/WIF com condições de repositório, branch/environment e audience; ausência de chave JSON duradoura. Workflows atuais são CI de validação, não deploy GCP.
- Permissões dos workflows `contents: read`, checkout sem persistir credenciais; actions fixadas por SHA nesta auditoria. Regras de branch protection/review do GitHub não foram alteradas.
- Política ingress/public access explícita, domínio HTTPS, egress do backend para Neon/SMTP, alertas de erro/latência/memória e proteção contra abuso.
- Retenção, exclusões e permissões Cloud Logging; não enviar cookies, códigos 2FA, body de login ou JDBC secrets.
- Rotação de secrets, remoção de INITIAL_ADMIN_PASSWORD após bootstrap e plano de rollback por digest/revisão.

## Custos e cotas

Não foi calculado valor mensal: faltam região, tráfego, duração média, plano Neon e volumes de logs/imagens. O dimensionamento deve somar vCPU-segundos, GiB-segundos, requisições, egress, builds, armazenamento/scanning do Registry, operações/versões Secret Manager, logs e custos Neon/SMTP. Escala a zero reduz ociosidade, mas não torna os demais serviços gratuitos. [Preços Cloud Run](https://cloud.google.com/run/pricing).

Configurar orçamento aprovado, alertas por limiares, cotas de build, retenção de imagens e de logs, limites de instâncias e revisão semanal no piloto. Alertas comuns de orçamento não são mecanismo automático de bloqueio de gasto; verificar separadamente a disponibilidade e abrangência de spend caps no projeto/serviços. [Budgets](https://docs.cloud.google.com/billing/docs/how-to/budgets).
