# Deploy Oracle Cloud ARM64

## Arquitetura

O host publica somente o Nginx. Frontend e backend permanecem na rede Docker
`172.28.0.0/24`, sem portas publicadas. O Nginx usa o IP fixo `172.28.0.10` e o
backend aceita forwarded headers somente desse endereço via `TRUSTED_PROXIES`.

O browser acessa `/api/*` em mesma origem e o Nginx encaminha diretamente para
`backend:8080`. O Next usa `INTERNAL_BACKEND_URL=http://backend:8080` apenas para
requisições server-side/rewrites; `NEXT_PUBLIC_API_URL` não é necessário.

## Ambiente de produção

O estado atual esta preparado para validacao na CI; nao constitui autorizacao de
deploy. O `docs/release.md` registra uma homologacao historica e nao comprova esta
revisao. Antes de iniciar o backend, verificar backup recuperavel do Neon, revisar
o historico e as migrations V1-V22 aplicaveis e aprovar a execucao de producao.
O startup executa Flyway automaticamente: nao usar `up` como teste de conectividade.

1. Copie `.env.production.example` para `.env.production` fora do Git.
2. Substitua todos os placeholders por secrets da Oracle.
3. Use obrigatoriamente uma URL Neon no formato
   `jdbc:postgresql://HOST/DB?sslmode=require`.
4. Concluir os gates de CI, backup/recuperacao, TLS e aprovacao de deploy abaixo.
5. Somente depois dessa aprovacao, executar
   `docker compose --env-file .env.production up -d --build`.

As opções abaixo ficam fixas no Compose e não devem ser flexibilizadas:

- `SPRING_PROFILES_ACTIVE=prod`
- `SECURITY_COOKIE_SECURE=true`
- `MAIL_SMTP_AUTH=true`
- `MAIL_SMTP_STARTTLS=true`
- `SWAGGER_ENABLED=false`
- `API_DOCS_ENABLED=false`
- `TRUSTED_PROXIES=172.28.0.10`

`INITIAL_ADMIN_NAME`, `INITIAL_ADMIN_EMAIL` e `INITIAL_ADMIN_PASSWORD` são
utilizados somente para o seed de uma base vazia. Remova-os do ambiente após o
primeiro bootstrap bem-sucedido; a aplicação não sincroniza senhas depois disso.

## Cloudflare e TLS

Antes de ativar a Cloudflare, obtenha as faixas oficiais atuais e adicione somente
essas redes como `set_real_ip_from` em `nginx/cloudflare-realip.conf`. Nunca use
`0.0.0.0/0` ou `::/0`. O Nginx então valida `CF-Connecting-IP`, transforma
`$remote_addr` no IP do cliente e sobrescreve todos os forwarded headers enviados
ao backend.

O certificado de origem e a chave privada serão instalados apenas na Oracle. A
configuração HTTP atual permite smoke local sem certificados. Após Cloudflare e
TLS estarem ativos, restrinja 80/443 no firewall Oracle às faixas oficiais da
Cloudflare e restrinja SSH ao IP administrativo sempre que possível.

Bloqueador atual de publicacao: o Compose publica apenas HTTP e `default.conf`
nao possui listener TLS. Antes de usar Full (strict), configurar HTTPS no Nginx
de origem com certificado valido para o dominio (CA publica ou Cloudflare Origin
CA), montar chave/certificado fora do Git e publicar 443. Validar `nginx -t`,
cadeia/hostname/validade do certificado e os headers encaminhados antes de expor
o dominio. Nao resolver esse bloqueio usando Flexible ou desativando cookies Secure.

Os healthchecks existentes verificam backend+banco em `/api/health`, frontend em
`/` e Nginx em `/nginx-health`; a validacao HTTPS externa continua obrigatoria.

## Flyway

O startup executa somente `migrate()`. `repair` é uma operação administrativa
manual. `baseline-on-migrate=false` permite bases novas vazias e bases já
gerenciadas pelo Flyway, recusando corretamente schemas não vazios sem histórico.

## Envio direto para a CI existente

O workflow `.github/workflows/ci.yml` executa `clean verify` em Java 21 contra o
service descartavel PostgreSQL 16, loopback:5432, banco `oficina_gestao_test`.
Nao usa secrets do GitHub nem configuracao Neon. SG-01 continua obrigatorio.

`TEST_FLYWAY_LOCATION` aponta explicitamente para a pasta absoluta
`backend/src/test/resources/db/synthetic-migration`. Os 22 arquivos vieram do
pacote PRE-ORACLE-02G-A auditado. A CI verifica os 22 nomes, versoes e SHA-256
antes de executar Maven ou criar qualquer contexto Spring. A verificacao e
repetida antes dos beans de conexao, e a localizacao efetiva do bean Flyway e conferida antes do
initializer de migrations. As tres instancias diretas do teste de schema vazio
usam a mesma validacao. Ausencia, classpath, mistura, links ou hashes divergentes
interrompem os testes. `.gitattributes` preserva os bytes SQL entre Windows/Linux.

Somente recursos e classes de teste usam essa politica; nao entram no JAR nem
no build Docker backend, que copia apenas `src/main`. As migrations oficiais
permanecem intactas. O cron de purga fica desativado no perfil de teste, mantendo
os testes da purga explicita e da retencao de sete dias.

Depois da revisao e autorizacao para commit/push:

1. Criar uma branch de release a partir do estado local atual, preservando todas
   as alteracoes; nao executar pull/reset/clean sobre o trabalho pendente.
2. Conferir `git diff --check`, revisar arquivos novos e alterados e verificar
   que `.env`, credenciais, outputs de build e pacote externo nao serao incluidos.
3. Adicionar somente os caminhos revisados, incluindo `.gitattributes`, o workflow,
   as correcoes anteriores, fixtures, classes e recursos sinteticos de teste.
4. Fazer commit, push da branch e abrir PR para `main`, que dispara a CI existente.
5. Exigir ambos os jobs verdes, inclusive testes integrados A2/retencao/R01/R06,
   autenticacao, Flyway V1-V22 e frontend. O JAR e gerado por `verify`.
6. Liberar deploy apenas apos revisar o resultado da CI, comprovar recuperacao
   do backup Neon, configurar a Oracle/TLS/secrets e aprovar a janela de migrations.

As imagens referenciadas nos Dockerfiles possuem manifestos `linux/arm64`,
confirmados no registro publico na preparacao RELEASE EXPRESS 01. Isso nao
substitui build e smoke nativos na Oracle Ubuntu 24.04 ARM64. Nenhum container,
recurso Oracle ou conexao Neon e necessario para preparar este PR.

## Smoke e rollback da publicacao futura

Na janela autorizada, registrar SHA e imagens implantadas, manter a versao anterior
disponivel e verificar primeiro `/api/health`, `/`, `/nginx-health` e HTTPS externo.
Validar login/2FA, refresh/logout, cookies HttpOnly/Secure/SameSite, CSRF,
permissoes administrativas e geracao de PDF. Usar somente registros sinteticos
identificados no smoke, sem alterar cadastros reais ou disparar cargas de teste.

Antes de qualquer migration de producao, comprovar backup recente, procedimento
de restauracao e recuperacao testada, alem de revisar o historico Flyway. Um
snapshot citado em documentacao historica nao comprova recuperacao atual.

Em falha, interromper a publicacao e restringir acesso. Reverter imagens somente
se a versao anterior for compativel com o schema resultante; migrations nao sao
desfeitas por rollback do container. Se a restauracao de banco for necessaria,
executa-la apenas por procedimento previamente aprovado, com preservacao das
evidencias e avaliacao dos dados gravados apos o backup. Nao executar `clean`,
`repair` ou editar historico Flyway como tentativa automatica de recuperacao.
