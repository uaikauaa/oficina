# Homologação isolada — roteiro executável, ainda sem aprovação do provedor

Não houve deploy nesta tarefa. Os comandos abaixo são verificações de leitura para um ambiente descartável já provisionado. Não usam valores de produção e não criam/alteram IAM, serviços, usuários ou bancos. Evidência remota só existe depois de os comandos realmente completarem.

## Cloud Run, TLS público e IAM

Além do roteiro abaixo, configurar RATE_LIMIT_SECRET por referência exclusiva no Secret Manager, diferente de JWT_SECRET e SERVICE_PROXY_SECRET. O verificador agora exige três referências distintas. Não imprimir valores para compará-los. Testar a rotação coordenada descrita na [auditoria independente](../auditoria-independente-20261103/README.md): JWT não pode zerar budgets; a chave RATE exige drenagem e expiração das janelas antes da troca; contexto IP exige corte coordenado entre Next e API. A transição V24 sobre contadores legados ativos falha fechada até expirarem. Não apagar contadores para obter aprovação.

Preparar projeto exclusivo com nome terminado em `-security-test`, serviços com label `environment=security-test`, duas contas de serviço de teste distintas e backend sem invoker público. Frontend deve usar a conta esperada e conter INTERNAL_BACKEND_URL HTTPS da URL canônica do backend, TRUSTED_PROXY_HOPS verificado e SERVICE_PROXY_SECRET via Secret Manager. Backend usa a mesma versão desse segredo, com JWT_SECRET separado. Não gerar arquivos de chave de conta de serviço.

Variáveis não secretas necessárias: HML_ISOLATED=true, HML_PROJECT, HML_REGION, HML_FRONTEND_SERVICE, HML_BACKEND_SERVICE, HML_FRONTEND_SERVICE_ACCOUNT, HML_DENIED_SERVICE_ACCOUNT e HML_EXPECTED_PROXY_HOPS. A identidade que executa o ensaio precisa poder ler a configuração e emitir tokens de teste por impersonação das duas contas. O script não imprime os tokens. Cloud Shell/Linux é o runner recomendado para gcloud; nenhuma credencial de produção deve estar nessa sessão.

Executar `node scripts/homologation/check-cloud-run.mjs`. O script verifica labels/URLs, conta do frontend, política invoker sem allUsers, backend anônimo negado, chamador permitido, audience errada negada, conta não permitida negada, chamada pelo frontend, HSTS e recusa/redirecionamento de HTTP público. Certificados HTTPS são validados pelo cliente. Resultado real é salvo em `cloud-run-homologation.json` apenas se todos os checks passarem; o arquivo não existe como evidência nesta revisão.

Validar a cadeia de proxies antes de aprovar TRUSTED_PROXY_HOPS: gerar tráfego sintético de duas origens conhecidas, confirmar o sufixo acrescentado pela infraestrutura, enviar prefixos XFF falsificados e confirmar que eles não alteram o IP assinado/contador. Não confiar em posição de header sem esse experimento. Repetir login com duas réplicas, reiniciar uma delas e confirmar que o bloqueio persiste. Usar concorrência inicialmente baixa (por exemplo 4 requisições por instância, pool de 10 conexões) e medir aquisição de conexão, latência, 429 e 503 antes de aumentar os limites. A transação de login pode manter uma conexão enquanto grava o contador em transação própria; não configurar concorrência arbitrária acima da capacidade do pool.

## Neon PostgreSQL de teste

Preparar projeto/branch Neon descartável, banco vazio com sufixo `_security_test` e usuário de teste contendo `security_test` no nome. O fluxo recomendado de arquivo privado, checks offline e inspeção está em [Neon exclusivo de homologação](../neon-homologacao-segura.md). Não informar URL nem credenciais operacionais. Para invocação direta do Java, configurar somente na sessão local HML_NEON_ISOLATED=true, HML_DB_HOST (hostname `ep-*.neon.tech` isolado), HML_EXPECTED_HOST (confirmação independente do hostname), HML_DB_NAME, HML_DB_USER e HML_DB_PASSWORD. Se o banco não for `oficina_security_test`, aprovar seu nome exato em HML_APPROVED_DATABASE. Esses valores não devem ser colocados em arquivos versionados nem em argumentos de comando.

Executar com Java 21 e o driver PostgreSQL já resolvido pelo Maven:

```powershell
java --class-path "$env:USERPROFILE/.m2/repository/org/postgresql/postgresql/42.7.12/postgresql-42.7.12.jar" scripts/homologation/CheckNeonTls.java
```

O programa abre transação read-only com `sslmode=verify-full` e channel binding obrigatório, usa a trust store Java, exige TLS 1.2/1.3 e consulta o estado TLS da própria conexão em `pg_stat_ssl`, a identidade SQL e catálogos para comprovar banco vazio. Não lê tabelas de negócio, não executa Flyway nem cria dados. Um banco já inicializado é recusado por este preflight. Falhas não imprimem a URL ou senha. Em seguida ensaiar CA/hostname inválidos no ambiente descartável e confirmar rejeição. Os testes locais com certificados efêmeros comprovam o mecanismo do cliente, sem substituir a conexão real Neon.

## SMTP sandbox

Usar host sandbox isolado (o guard exige hostname contendo `sandbox` ou terminado em `.test`), conta descartável e HML_SMTP_ISOLATED=true. Configurar HML_SMTP_HOST, HML_SMTP_PORT=587, HML_SMTP_USERNAME e HML_SMTP_PASSWORD na sessão. Executar `node scripts/homologation/check-smtp.mjs`. Ele exige STARTTLS, TLS >=1.2, valida CA e hostname e só então envia AUTH. Executa QUIT sem enviar e-mail. Não imprime credenciais ou corpo de resposta.

Para o fluxo 2FA completo, usar um destinatário sintético no sandbox e registrar entrega, expiração, consumo único e ausência de código em respostas/logs. A suíte local já faz essa entrega com Mailpit, sem credenciais ou serviços públicos.

## Reproduzir as evidências locais

- `node --test scripts/homologation/tls-isolated.test.mjs`: OpenSSL gera chave/certificado efêmeros no diretório temporário; testa CA e hostname negativos e STARTTLS obrigatório; apaga os arquivos ao terminar.
- Após Maven package e build Next: `node scripts/test-proxy-runtime.mjs` inicia fixture local e standalone, valida transporte e encerra ambos.
- `node scripts/test-real-stack-local.mjs` cria containers novos com label exclusiva por execução, aplica o caminho oficial B24 neutro num banco vazio e executa Playwright real. Depois testa duas JVMs, tentativas concorrentes e reinicialização. Remove somente seus containers/volumes ao terminar. Usa portas locais 15433, 1025, 8025, 8080, 8082 e 3000; não modifica containers operacionais.

Não há aprovação automática de criptografia de backup, Secret Manager, ingress, WAF ou orçamento de custos. Registrar os resultados desses controles no ambiente isolado antes de solicitar retirada do draft ou liberação de produção.
