# Etapa 3.3 — configuração privada e retenção

## Variáveis efetivas

Os modelos `.env.example`, `.env.homolog.example` e `.env.production.example` contêm apenas placeholders. O backend lê `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET`, `RATE_LIMIT_SECRET`, `SERVICE_PROXY_SECRET`, `INVITE_OUTBOX_KEYS`, `INVITE_OUTBOX_ACTIVE_VERSION`, `APP_PUBLIC_URL`, `MAIL_*` e `PASSWORD_RECOVERY_EXPIRATION_MINUTES` (5–60; padrão 30). A mesma chave versionada do outbox cifra convites e recuperação com AADs distintos. Guardar versões antigas enquanto houver mensagens pendentes cifradas com elas.

O frontend lê `INTERNAL_BACKEND_URL`, `CLOUD_RUN_IAM`, `SERVICE_PROXY_SECRET` e `TRUSTED_PROXY_HOPS`. `NEXT_PUBLIC_*` não recebe segredos. `NEON_PROJECT_ID`, `NEON_API_KEY`, `GOOGLE_CLOUD_PROJECT_ID` e `GOOGLE_CLOUD_RUN_SERVICE` são opcionais para a tela de infraestrutura; as APIs externas só são usadas se configuradas. Em homologação isolada, deixar IDs/chaves externos vazios até autorizar o ensaio correspondente.

O backend carrega `.env` local somente em desenvolvimento. Os perfis `test`, `prod` e `production` ignoram `.env`; o teste usa `TEST_DB_URL` e guardas de host/porta, com banco descartável. Variáveis do processo prevalecem sobre arquivo local no desenvolvimento. O operador deve verificar a configuração efetiva sem imprimir valores secretos.

## Google Secret Manager

Planejar referências distintas para `DB_PASSWORD`, `JWT_SECRET`, `RATE_LIMIT_SECRET`, `SERVICE_PROXY_SECRET`, `INVITE_OUTBOX_KEYS`, `MAIL_PASSWORD` e senha temporária de bootstrap. Vincular `DB_PASSWORD`, JWT, rate limit, chaves de outbox e SMTP apenas à identidade do backend. Compartilhar somente o segredo de contexto do proxy entre backend e frontend. URLs, nomes de projeto e remetente são configuração comum, mas não devem expor credenciais. Fixar versões durante deploy, testar rotação em homologação e remover a senha bootstrap após criação da conta sintética. Não ativar Secret Manager real nesta etapa.

Para Neon, usar URL JDBC com `sslmode=verify-full`, hostname do certificado e CA confiável. Validar falha com CA/hostname incorretos antes da ativação; `sslmode=require` não atende ao gate. SMTP de produção exige autenticação, STARTTLS obrigatório e verificação do servidor.

## Retenção e segurança da auditoria

`eventos_administrativos` permanece no PostgreSQL sem exclusão automática. Esta é a política efetiva atual: retenção até decisão formal de prazo e arquivo pela operação. Antes de ativar banco real, aprovar prazo, base legal, controle de acesso, exportação cifrada, backup, purga documentada e ensaio de restauração. Não reduzir histórico silenciosamente por um job novo. As telas limitam páginas a 100 eventos, aceitam ordenação somente `asc`/`desc` e usam parâmetros SQL para filtros. Eventos novos de recuperação e encerramento registram IDs/categorias, sem token, senha, JWT, código 2FA ou ciphertext.

O identificador de sessão representa refresh tokens reais e sobrevive à rotação. Não existe coleta de dispositivo, localização ou última atividade. Revogação individual/“outras” bloqueia a renovação imediatamente; access JWT já emitido pode durar até 15 minutos. Revogação geral incrementa `token_version` e invalida access JWT de imediato. Esta limitação deve aparecer na UI e nos procedimentos de incidente.
