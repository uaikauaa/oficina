# Etapa 4A.3 — revisão independente de REC-01 e preparo do diagnóstico Neon

Data: 13/11/2026 (America/Sao_Paulo). Base inicial: PR #32 draft,
`7eb137d7238649f53f6f6d5b7a9bf14f88d9f897`. Esta etapa utilizou apenas
PostgreSQL e identidades sintéticos. Nenhum acesso ao Neon original, ao painel ou
à API Neon; nenhum backup remoto, migration remota, conta real, e-mail real,
merge ou deploy.

## Veredito e revisão independente

Um revisor separado da implementação examinou V29, `PasswordRecoveryService`,
`InviteOutbox`, controller, validação de produção e testes. O caminho público
normaliza o e-mail e grava somente um pedido cifrado; a consulta à conta fica no
worker após a resposta. O pedido e o orçamento de rate limiting usam agora a
mesma transação PostgreSQL. A fila usa AES-256-GCM com nonce, AAD específico e
chaves versionadas independentes. O worker usa `FOR UPDATE SKIP LOCKED`; criação
do verificador, outbox, reemissão e limpeza do payload são transacionais. Os testes
isolados cobrem expiração, falha criptográfica, rollback, concorrência, falha
SMTP, revogação de sessões e uso único. A validação de produção mantém pedidos
públicos desabilitados até decisão operacional separada.

### Achado corrigido nesta etapa

Na V29 inicial, uma fila com 10.000 pedidos pendentes consumia os budgets de IP
e e-mail e respondia 202, embora descartasse o pedido. O teste de regressão
reproduziu o comportamento. A capacidade agora é verificada antes do budget sob
advisory lock de transação; fila cheia responde 503 para qualquer estado da conta,
sem criar pedido nem consumir budgets de recuperação. O controller não promete
aceitação nesse caso, e um contador local produz aviso agregado, sem e-mail ou
payload. A primeira correção ainda podia esgotar o pool: a transação externa
segurava uma conexão e o limitador abria outra com `REQUIRES_NEW`. O novo método
do limitador usa a conexão da transação existente somente neste fluxo; os outros
chamadores conservam a semântica anterior. O teste de 12 chamadas simultâneas
exercita o pool configurado com 10 conexões.

### Limites da aprovação isolada

- SMTP tem entrega *at least once*: uma falha após a aceitação pelo servidor pode
  causar reenvio. A UI e o suporte não devem prometer entrega única.
- Rotação de `INVITE_OUTBOX_KEYS` deve manter as versões ainda referenciadas por
  pedidos e outboxes pendentes; retirar uma chave antes da drenagem faz os jobs
  falharem fechados e exige tratamento operacional.
- A fila rejeita pedidos novos a 10.000 pendentes, mas metadados terminais vivem
  sete dias. Ainda falta um SLO operacional para tamanho, idade e limpeza.
- Falha inesperada repetida de um job pode impedir progresso até intervenção;
  registrar taxa e idade e estabelecer procedimento de triagem antes de habilitar
  a rota pública em produção.
- O contador de saturação é por instância e não equivale a métrica agregada nem a
  alerta central. Não há evidência de alertas ativos para pendentes, idade máxima,
  expirados, falhas criptográficas/transacionais/SMTP, taxa de processamento ou
  espaço. Propor no monitoramento existente: alerta antecipado em 8.000 pendentes,
  crítico em 10.000, backlog envelhecendo, throughput zero com backlog, falha
  criptográfica ou transacional, repetição SMTP e crescimento de tabela. Validar
  os limites conforme capacidade e volume antes da ativação; não contratar serviço.
- A medição sintética não reproduz rede, proxy e carga do destino de produção;
  decisão de liberar a rota requer observabilidade e ensaio operacional próprio.

**REC-01: APROVADO EM ISOLAMENTO pelo revisor independente.** A rota permanece desabilitada em
produção (`PASSWORD_RECOVERY_REQUESTS_ENABLED=false`).

## Medição temporal independente

Endpoint HTTP real em loopback, PostgreSQL descartável, 20 pares de aquecimento,
200 pares medidos por cenário (240 no controle sem processamento), ordem
existente/inexistente randomizada. Worker habilitado nos dois cenários ativos;
no cenário carregado foram enfileirados 2.000
pedidos sintéticos mistos e foi registrada a profundidade da fila antes de cada
par. CSVs são artefatos locais ignorados pelo Git; o CI analisa as distribuições
com intervalo de confiança e AUC. Evidência da execução inicial:

| Cenário | Mediana existente | Mediana inexistente | Diferença pareada, IC 95% | AUC, IC 95% |
|---|---:|---:|---:|---:|
| Controle HTTP, worker sem processamento | 24,868 ms | 24,433 ms | −0,234 ms [−0,492; +0,421] | 0,507 [0,469; 0,545] |
| Worker ativo, normal | 29,533 ms | 29,493 ms | +0,267 ms [−0,456; +0,893] | 0,504 [0,465; 0,539] |
| Worker ativo, fila carregada | 28,776 ms | 28,430 ms | −0,042 ms [−0,625; +0,599] | 0,510 [0,468; 0,551] |

Os intervalos observados são compatíveis com ausência de separação temporal
útil nestas condições; uma única execução não prova segurança absoluta. Na
medição carregada do `clean verify`, os 200 pares ocorreram com backlog positivo
(mínimo 886, máximo 1.894); 176 pares ocorreram com pelo menos 1.000 pedidos
pendentes. Uma execução independente anterior também passou o mesmo critério.

## Configuração privada — auditoria offline

Somente nomes, presença e propriedades booleanas foram lidos; nenhum valor de
segredo, hostname privado ou dado pessoal foi impresso. Nenhuma das duas fontes
inspecionados contém nome de variável pública com padrão de segredo. Nenhuma
URL de banco analisada embute credencial; nenhuma declara CA explícita, o que
exige comprovação do truststore/factory. O `.env` local não é prova do ambiente
de um container criado anteriormente; os metadados do antigo indicam fontes
adicionais possíveis de override, de modo que não comprovam o estado efetivo.

| Grupo | `.env` local | Metadados do container antigo | Pendente |
|---|---|---|---|
| `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` | presentes; URL indica `verify-full` | presentes; URL não indica `verify-full` | confirmar injeção efetiva, CA e hostname aprovado |
| `JWT_SECRET`, `RATE_LIMIT_SECRET`, `SERVICE_PROXY_SECRET` | presentes e distintos | JWT presente; outros ausentes | configurar segredos independentes e rotação |
| `INVITE_OUTBOX_KEYS`, `INVITE_OUTBOX_ACTIVE_VERSION` | ausentes | ausentes | configurar chave versionada e ativa no cofre |
| SMTP | campos de credencial completos; auth e STARTTLS declarados | campos de credencial completos; transporte efetivo não confirmado | validar contra sink antes de e-mail real |
| `APP_PUBLIC_URL` | ausente | ausente | HTTPS público aprovado |
| `SUPER_ADMIN_BOOTSTRAP_EMAIL` | ausente | ausente | confirmar destinatário privadamente, sem criar conta |
| `SPRING_PROFILES_ACTIVE` | não produção | produção | aprovar profile e injeção efetiva |
| Cookies, CSRF, CORS, trusted proxies | flags HTTPS locais incompletas | cookie Secure e CORS HTTPS declarados, trusted proxies presentes | validar combinação efetiva com proxy, domínio e CSRF |
| Next.js `INTERNAL_BACKEND_URL` | presente no `.env` local | ausente nos metadados do backend antigo, que não são o processo Next.js | confirmar variáveis no build e runtime pretendidos |
| Recuperação pública | desabilitada por padrão | desabilitada por padrão | manter desabilitada |

O container antigo declara `INITIAL_ADMIN_PASSWORD` presente: removê-la da
configuração futura aprovada. Não reiniciar, recriar ou alterar o container para
conferir esse estado. Spring lê variáveis do processo; Compose interpola o
`.env` no momento de criar o serviço e injeta explicitamente as variáveis do
backend, fixando o profile `prod`. O processo Next.js recebe
`INTERNAL_BACKEND_URL` e `SERVICE_PROXY_SECRET` pelo ambiente do serviço
Compose; `NEXT_PUBLIC_*`, se usados, podem ser incorporados no build. Fazer a
comparação final com a configuração efetivamente injetada, sem publicar valores. Preparar
um novo manifesto privado aprovado para futura substituição: DB com conexão
direta e verify-full, CA/truststore, SMTP, URL HTTPS, cookies Secure, CORS,
trusted proxies, JWT/refresh, rate limiting, proxy secret, chave/versão de
outbox, profile e flag de recuperação. Não modificar `.env` nesta etapa.

**CONFIGURAÇÃO PRIVADA: PENDENTE.**

## Destino Neon e autorização

Há uma ficha privada fora do Git para conferência no painel oficial. Ela está
vazia: organização, project ID, branch ID/tipo, compute ID, hostname direto,
banco, role/grants existentes, referência e versão da credencial no cofre,
CA/truststore, responsável e janela. Nenhum identificador foi inferido. Sem role
existente de leitura, parar e pedir autorização separada para provisionamento
pelo responsável. Não usar uma role proprietária como se fosse de menor privilégio.

O SQL da [seção 3 do runbook](stage4a-neon-runbook.md) foi executado somente
contra PostgreSQL descartável com role sintética de SELECT, `psql -X`, transação
`REPEATABLE READ READ ONLY`, `ROLLBACK` e timeouts; o teste de TLS isolado aceitou
o hostname confiável e recusou CA/hostname incorretos. A sessão local via socket
não comprova o TLS do Neon. Em qualquer conexão futura: serviço privado sem senha
em argumentos, hostname direto, `sslmode=verify-full`, CA validada,
`connect_timeout=10`, `statement_timeout=10000`, `lock_timeout=2000` e
`idle_in_transaction_session_timeout=60000`. `pg_stat_ssl` confirma TLS ativo,
mas o handshake verify-full comprova CA e hostname. Não iniciar Spring Boot.

**Solicitação exata a apresentar somente após preencher e conferir a ficha:**

> Autoriza exclusivamente o diagnóstico somente leitura no projeto [ID oficial],
> branch [ID e tipo oficiais], compute [ID]/hostname direto [hostname oficial],
> banco [nome], usando a role existente [nome e grants] e a credencial [referência
> e versão no cofre, nunca senha], na janela [início/fim/timezone], sob
> responsabilidade de [nome]? Serão executados exatamente os SELECTs da seção 3
> de `stage4a-neon-runbook.md`: identidade PostgreSQL/TLS/role, catálogo de
> colunas/constraints, histórico Flyway, contagens agregadas de contas/papéis e
> integridade de vínculos. Conexão direta `verify-full`, `psql -X`, transação
> `REPEATABLE READ READ ONLY`, timeouts e `ROLLBACK`. Não haverá backend,
> migration, backup, DDL/DML, login funcional ou e-mail. Resultados completos
> ficam em registro privado; no relatório, apenas agregados. A conexão pode
> acordar o compute e gerar custo/logs no provedor. Parar imediatamente se
> identidade, TLS, role, read-only, estrutura ou limites divergirem, ou houver
> erro. Esperam-se somente inventário de schema/Flyway e indicadores agregados
> de integridade, sem hashes, tokens, ciphertext ou dados pessoais desnecessários.

Esta solicitação não está sendo apresentada como aprovação: faltam os campos
oficiais privados. A aprovação genérica da Etapa 4A.3 não autoriza conexão.
**DIAGNÓSTICO NEON: BLOQUEADO até conferência da ficha e autorização específica.**
**AUTORIZAÇÃO DE CONEXÃO: NÃO CONCEDIDA.**

## Gates posteriores

1. Diagnóstico aprovado e concluído: confirmar identidade, TLS, Flyway e
   integridade; divergência implica parada e plano específico.
2. Backup remoto: autorização distinta com alvo, role, escopo, destino cifrado,
   retenção, custodiante, janela e custo. Restaurar em PostgreSQL isolado e
   comparar snapshot/invariantes antes de qualquer migration. **Não autorizado.**
3. V25–V29: ensaio somente na cópia restaurada, Flyway isolado, `info`,
   `validate`, checksums e invariantes por versão. Migration real exige nova
   autorização. **NO-GO.**
4. SUPER_ADMIN: convite oficial, senha pelo titular e 2FA após gates e
   autorização próprios. **NO-GO.**
5. Geisa: transição do ID existente a OPERADOR_GERAL, preservando senha,
   histórico e estado ativo; revogar sessões e validar novo login/2FA, somente
   após SUPER_ADMIN funcional e autorização própria. **NO-GO.**
6. Produção: configuração efetiva, monitoramento da fila, backup restaurado,
   regressão e aprovação operacional antes de ativar a recuperação pública.
   **NO-GO.** PR #32 permanece draft, sem merge/deploy.

## Regressão e estado do PR

`mvn clean verify`: **910/910** testes, zero falhas/erros/skips no PostgreSQL
descartável. Os nove cenários de `ProductionMigrationPathTest` passaram, incluindo
V29 em schema vazio e upgrade sintético; integridade real depende do diagnóstico
e da restauração autorizados. Testes de recuperação, outbox, SMTP,
JWT/2FA/sessões, concorrência de 12 requisições, última vaga da fila e três
cenários temporais HTTP passaram. `node --test` TLS isolado: 2/2; auditor
offline sem divulgação: 1/1. Frontend: 379/379 unitários, TypeScript, ESLint e
build Next.js aprovados; Playwright mockado 115/115. `npm audit
--audit-level=high`: zero avisos altos/críticos, sete moderados em dependências
de desenvolvimento. O verificador do bundle aprovou 43 arquivos.

Playwright integrado com backend real isolado: **3/3**. O script também confirmou
revogação imediata e persistida após reinício, refresh com `sessionId`, bloqueio
de replay, orçamento compartilhado entre duas JVMs, convite cifrado pendente
entregue uma vez após reinício e recuperação cifrada pendente entregue uma vez
por dois workers; somente Mailpit sintético recebeu mensagens. O scan de
segredos e os quatro workflows do SHA final terão seus
links e resultados registrados no mesmo PR após a conclusão do CI. PR #32
permanece draft, sem merge/deploy.
