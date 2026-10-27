# Go-live Oracle ARM64 - Oficina Gestao (2026-10-26)

STATUS: PREPARACAO DE CODIGO; NAO E AUTORIZACAO DE DEPLOY. Backend executa Flyway no startup. Nunca usar docker compose up como simples teste.

## Arquitetura escolhida
Navegador -> Cloudflare HTTPS (Full strict) -> Oracle ARM64 HTTPS 443 -> Docker Nginx -> Next.js e Spring Boot -> Neon PostgreSQL TLS.
Somente a porta 443 fica publicada. A porta interna 8080 do Nginx serve apenas para health. Backend 8080 e frontend 3000 nao estao publicados.

## 1. Criar instancia e rede
- Oracle Console: Ubuntu 24.04 ARM64, VM.Standard.A1.Flex, ate 2 OCPU e 12 GB em Always Free (verificar cota da conta e capacidade da regiao); boot volume >= 47 GB.
- Ativar IPv4 publico e configurar apenas a chave publica SSH. NUNCA publicar chave privada SSH.
- OCI e firewall host: porta 22 limitada ao seu IP; TCP 443 limitada aos IPs oficiais Cloudflare. Nao abrir 80/3000/8080/5432.
- Docker: instalar via repositorio oficial para Ubuntu, incluindo docker-compose-plugin: https://docs.docker.com/engine/install/ubuntu/

## 2. Cloudflare e certificados
- DNS: criar A para app.seudominio.com.br apontando ao IPv4 publico, com proxy ligado (nuvem laranja).
- SSL/TLS: escolher Full (strict), NUNCA Flexible. Criar Origin CA para hostname no painel Cloudflare SSL/TLS -> Origin Server.
- Salvar certificado e chave PEM SOMENTE em /opt/oficina/secrets/nginx/origin.pem e origin.key, respectivamente.
- Permissoes da chave: root:101 e modo 0640; do certificado: modo 0644. Grupo 101 corresponde ao nginx do container; nunca versionar os arquivos.
- Conferir validade, CN/SAN, hostname e correspondente chave; o script de preflight nao comprova hostname nem cadeia Cloudflare.
- Confianca de proxy: nginx/cloudflare-realip.conf lista IPs verificados em https://www.cloudflare.com/ips-v4 e /ips-v6; mantenha atualizada.

## 3. Configurar deploy apos backup e TLS
Clonar repo em /opt/oficina. Copiar .env.production.example para .env.production e substituir todos os valores de exemplo; chmod 600 no arquivo.
Colocar DB_URL jdbc:postgresql://HOST/DB?sslmode=require para branch de producao do Neon, credenciais reais, JWT_SECRET forte, MAIL_* (SMTP 2FA), CORS_ALLOWED_ORIGINS=https://app.seudominio.com.br.
Usar INITIAL_ADMIN_* somente em base vazia; remova depois do bootstrap inicial.
Executar: sudo bash scripts/preflight-oracle.sh .env.production secrets/nginx
ANTES de subir: conferir Flyway V1-V22, backup recente restauravel, segredo JWT, cookie Secure, firewall, Cloudflare Full strict e janela de migrations aprovada.
Somente depois: sudo docker compose --env-file .env.production build
e: sudo docker compose --env-file .env.production up -d --no-build
Conferir: sudo docker compose --env-file .env.production ps e logs --tail=100 backend. Logs podem conter dados privados; nao compartilhar.

## 4. Backup off-site (preparado; ainda NAO executado)
- Criar bucket privado Cloudflare R2 ou S3 com controle IAM minimo, criptografia adicional age e retencao configurada no bucket.
- Gerar chave age fora da Oracle e manter a chave privada OFFLINE. No servidor guardar apenas destinatario publico age.
- Usar scripts/backup.env.example para montar /etc/oficina/backup.env fora do Git, modo 0640 root:oficina-backup; criar usuario tecnico oficina-backup.
- Instalar pg_dump/pg_restore com versao igual ou superior ao PostgreSQL Neon, age e AWS CLI.
- Obrigatorio: URL DIRETA do Neon (sem -pooler), TLS verify-full. O backup criptografado e enviado e validado no bucket.
- Instalar scripts/backup-neon-offsite.sh com chmod 755 em /opt/oficina/scripts; instalar ops/systemd/oficina-backup.service/.timer em /etc/systemd/system e executar systemctl daemon-reload.
- Fazer primeiro backup manual com sudo systemctl start oficina-backup.service; confirmar objeto off-site privado.
- Baixar o objeto, descriptografar FORA do servidor com a chave age privada, restaurar com pg_restore em banco NOVO ISOLADO; validar dados, saldo e historico Flyway.
- Somente apos restore piloto aprovado, ativar systemctl enable --now oficina-backup.timer (02h Sao Paulo). Configurar alertas por falha e politica de retencao.

## 5. Gates publicos
- HTTPS real por URL publica; /api/health HTTP 200; TLS Full strict; cookies Secure/HttpOnly/SameSite.
- Login e 2FA com email real, refresh, logout e protecao CSRF sem falhar na primeira tentativa.
- Fluxo completo: cliente, maquina, produto, entrada/saida de estoque, OS, estorno, PDF e relatorios.
- Verificar que 3000/8080/5432 nao estao acessiveis publicamente; monitorar disponibilidade, armazenamento e backups.
- Registrar SHA/imagens e rollback aprovado. NUNCA flyway repair/clean ou pg_restore --clean em producao como resposta automatica.

Status permanece NO-GO ate comprovar Oracle, DNS, TLS, credenciais, backup restauravel e smoke final.
