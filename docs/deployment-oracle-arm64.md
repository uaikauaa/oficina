# Deploy Oracle Cloud ARM64

## Arquitetura

O host publica somente o Nginx. Frontend e backend permanecem na rede Docker
`172.28.0.0/24`, sem portas publicadas. O Nginx usa o IP fixo `172.28.0.10` e o
backend aceita forwarded headers somente desse endereço via `TRUSTED_PROXIES`.

O browser acessa `/api/*` em mesma origem e o Nginx encaminha diretamente para
`backend:8080`. O Next usa `INTERNAL_BACKEND_URL=http://backend:8080` apenas para
requisições server-side/rewrites; `NEXT_PUBLIC_API_URL` não é necessário.

## Ambiente de produção

1. Copie `.env.production.example` para `.env.production` fora do Git.
2. Substitua todos os placeholders por secrets da Oracle.
3. Use obrigatoriamente uma URL Neon no formato
   `jdbc:postgresql://HOST/DB?sslmode=require`.
4. Execute `docker compose --env-file .env.production up -d --build`.

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

## Flyway

O startup executa somente `migrate()`. `repair` é uma operação administrativa
manual. `baseline-on-migrate=false` permite bases novas vazias e bases já
gerenciadas pelo Flyway, recusando corretamente schemas não vazios sem histórico.
