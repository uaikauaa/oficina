# Preparação para homologação Google Cloud Run

**Estado:** somente planejamento; nenhum deploy realizado. Produção NO-GO. Use este documento com o [roteiro de homologação de segurança](security-hardening/homologacao.md) e o [registro da release](release-pre-homologacao/README.md).

## Arquitetura atual

O monorepo produz duas imagens. O serviço **frontend** (Next.js 16, Node 22, porta 3000) pode ser público em HTTPS. O serviço **backend** (Spring Boot 4, Java 21, porta 8080) deve exigir IAM; conceda `roles/run.invoker` apenas à identidade de execução do frontend. O navegador chama `/api/*` na origem do frontend. O route handler Next obtém um ID token do metadata server com audience da URL do backend e o envia em `X-Serverless-Authorization`. O JWT da aplicação, cookies, CSRF e streaming PDF/CSV passam separadamente. O navegador não recebe o token IAM nem acessa o Neon diretamente.

O backend usa PostgreSQL **Neon de homologação isolado**. A URL JDBC deve usar `sslmode=verify-full` com CA confiável e hostname validado. O 2FA exige SMTP de homologação. Segredos devem existir como referências separadas no Secret Manager: `JWT_SECRET`, `RATE_LIMIT_SECRET`, `SERVICE_PROXY_SECRET`, `DB_PASSWORD` e `MAIL_PASSWORD`.

## Antes de publicar uma revisão de homologação

1. Confirmar os quatro workflows verdes no SHA exato aprovado; conferir V1–V24 preservadas, a baseline neutra B24 para bancos novos e `clean verify`. Seguir a [remediação e publicação por digest](homologacao-gcp-20261104/remediacao.md); não aplicar os seeds históricos V11/V12 em um banco novo de homologação.
2. Criar projeto, faturamento, orçamento e alertas; limitar instâncias e conexões PostgreSQL de acordo com a capacidade medida. Alertas não interrompem cobrança.
3. Criar banco Neon e SMTP exclusivos para homologação. Planejar backup, restauração e rollback em ambiente isolado; não conectar à branch de produção.
4. Definir identidade do frontend com `roles/run.invoker` no backend. Testar negação de invocação anônima e por identidade sem permissão. Não tornar o backend público para contornar um 401.
5. Distribuir variáveis conforme [.env.homolog.example](../.env.homolog.example). O backend recebe DB, JWT, rate limiter e SMTP; o frontend recebe apenas `INTERNAL_BACKEND_URL`, `SERVICE_PROXY_SECRET` e `TRUSTED_PROXY_HOPS` depois de medir a cadeia real do ingresso.
6. Validar TLS/hostname Neon, STARTTLS/identidade SMTP, cookies Secure, CORS exato, CSP nonce, proxy, CSRF, 2FA, PWA, PDF/CSV, estoque/OS, rate limiting entre réplicas e observabilidade.
7. Ensaiar rotação coordenada dos três segredos. Para `RATE_LIMIT_SECRET`, drenar escritores antigos e aguardar a maior janela ativa antes da troca; a V24 impede que gerações divergentes dividam o orçamento.

Os scripts em `scripts/homologation/` auxiliam as verificações. Resultados locais com certificados efêmeros não aprovam IAM, ingresso, Neon ou SMTP reais. O deploy e a homologação efetiva são tarefas separadas.

Nginx, Docker Compose, backup off-site e o workflow Oracle permanecem no repositório como infraestrutura legada/contingência e validação de scripts; não fazem parte dos dois serviços Cloud Run.
