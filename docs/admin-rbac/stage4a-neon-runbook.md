# Etapa 4A — procedimento Neon sujeito a autorização

Data: 12/11/2026 (America/Sao_Paulo). **Plano, não execução.** Nenhum comando deste documento foi executado contra o Neon original. O backend completo não é uma ferramenta de diagnóstico: mesmo sem tráfego pode migrar, criar dados, limpar tokens e enviar e-mails.

## 1. Identificação privada e gate de autorização

O responsável deve preencher um registro **fora do Git**, a partir do painel oficial já autenticado: organização, project ID/nome/região, branch ID/nome e indicação de branch principal, endpoint/compute ID e tipo (read-write/read replica), hostname direto, hostname pooled, banco, PostgreSQL major, role de diagnóstico e referência/versão da credencial no cofre. Não inferir branch pelo nome do banco ou por um hostname antigo.

Comparar localmente esse registro com o `DB_URL` efetivamente injetado no processo, `DB_USERNAME`, configuração do migrador, serviço de backup e, se usado, `NEON_PROJECT_ID`. A comparação deve produzir somente coincidência/divergência por campo no relatório público. Registrar valores e evidências oficiais apenas no registro privado. Não aceitar o `.env` como prova de configuração de um container já criado. Não usar `docker compose up`, reiniciar o backend nem substituir sua conexão para testar a comparação.

**PARADA obrigatória antes de abrir painel/API autenticada Neon, resolver uma conexão diagnóstica, consultar SQL ou exportar dados.** Pedir autorização para uma operação concreta usando este formulário, com os campos privados já conferidos:

> Autoriza exclusivamente o diagnóstico somente leitura no projeto [ID], branch [ID], compute/hostname [ID/host], banco [nome], usando a role existente [nome] e a credencial [referência e versão no cofre, nunca senha]? Serão executados apenas os SELECTs da seção 3: identidade/TLS, catálogo e Flyway, totais/integridade de contas e vínculos. Conexão direta com verify-full, transação READ ONLY, timeouts, sem backend, sem Flyway migrate/repair/baseline, sem DDL/DML, sem login funcional nem envio de e-mail. Resultados privados, resumo apenas agregado. Janela e responsável: [preencher]. Backup e qualquer outra operação ficam excluídos.

Não prosseguir com um formulário incompleto, uma resposta ambígua ou aprovação genérica da Etapa 4A. Se não houver role de leitura já disponível, **não criar uma**: informar o bloqueio e solicitar uma autorização distinta para provisioná-la pelo responsável. Uma conta proprietária não se torna de menor privilégio só porque a transação é read-only. Informar essa diferença e preferir uma credencial dedicada existente. Conexões podem acordar compute e gerar logs/metadados do provedor; a garantia é de nenhuma escrita SQL/aplicacional nos dados, não ausência de efeitos de observabilidade do serviço.

## 2. TLS e sessão isolada

- Usar hostname DNS oficial direto do compute aprovado; não substituir por IP, alias próprio ou hostname pooled no diagnóstico/backup.
- JDBC: `sslmode=verify-full` e CA apropriada. Escolher explicitamente `sslrootcert` com bundle confiável ou `sslfactory=org.postgresql.ssl.DefaultJavaSSLFactory` com truststore Java validado. Confirmar a política da factory usada. Ausência de `sslrootcert` não prova falha se houver truststore/factory adequado; também não comprova confiança.
- libpq/psql: `sslmode=verify-full`, trust root configurado no serviço privado; não presumir que o truststore Java é usado por psql. Nunca habilitar `NonValidatingFactory`, `sslmode=require`, fallback ou validação de hostname desativada.
- Validar recusa por CA e hostname incorretos primeiro no TLS descartável (`node --test scripts/homologation/tls-isolated.test.mjs`). Esses testes não contatam o original. Certificado original, DNS e CA só podem ser confirmados depois da autorização específica.
- Não reutilizar `CheckNeonTls.java` removendo seus guards: ele foi projetado para alvos `*_security_test` e não autoriza o original.

Preparar um `pg_service.conf` privado (alias `neon_diag_aprovado`) e `PGPASSFILE` protegido por ACL do titular. Conter apenas a conexão exata aprovada, CA, `connect_timeout=10`, `application_name=oficina_diagnostico_readonly` e `options=-c default_transaction_read_only=on -c statement_timeout=10000 -c lock_timeout=2000 -c idle_in_transaction_session_timeout=60000`. Não colocar senha na linha de comando, histórico de shell, URI, arquivo de PR ou saída. Não usar shell trace. Executar `psql -X --no-password --set=ON_ERROR_STOP=1 --dbname=service=neon_diag_aprovado` somente depois da aprovação. `-X` evita comandos de um `.psqlrc` pessoal.

## 3. Consultas previstas (leitura)

Executar em blocos pequenos; confirmar a existência de tabelas/colunas antes das consultas específicas. Não fazer `SELECT *` em usuários, tokens, outboxes ou configurações. Não selecionar hashes, códigos 2FA, tokens, ciphertext, senhas nem conteúdo de auditoria com dados pessoais.

```sql
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SHOW transaction_read_only;
SELECT current_database(), current_user, current_setting('server_version'),
       current_setting('transaction_isolation');
SELECT ssl, version FROM pg_stat_ssl WHERE pid = pg_backend_pid();
SELECT rolcanlogin, rolsuper, rolcreatedb, rolcreaterole
  FROM pg_roles WHERE rolname = current_user;
SELECT to_regclass('public.flyway_schema_history'), to_regclass('public.usuarios'),
       to_regclass('public.roles'), to_regclass('public.usuario_roles');
SELECT table_name, column_name, data_type, is_nullable
  FROM information_schema.columns WHERE table_schema='public'
  ORDER BY table_name, ordinal_position;
SELECT conrelid::regclass::text AS tabela, conname, contype, convalidated
  FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY 1,2;
ROLLBACK;
```

Se TLS não constar ativo, `transaction_read_only` não for `on`, identidade divergir, permissões forem inadequadas ou houver erro: fechar imediatamente; não tentar reparar. O handshake verify-full é o que valida hostname/CA; `pg_stat_ssl` sozinho não comprova verify-full.

Após confirmar a estrutura, repetir `BEGIN ... READ ONLY`, timeouts herdados e terminar com `ROLLBACK`:

```sql
SELECT installed_rank, version, description, type, script, checksum, success
  FROM public.flyway_schema_history ORDER BY installed_rank;
SELECT count(*) AS contas,
       count(*) FILTER (WHERE ativo) AS ativas,
       count(*) FILTER (WHERE senha IS NULL OR length(senha)=0) AS senha_ausente,
       count(*) FILTER (WHERE token_version IS NULL OR token_version<0) AS versao_invalida
  FROM public.usuarios;
SELECT count(*) AS emails_duplicados FROM
  (SELECT lower(email) FROM public.usuarios GROUP BY lower(email) HAVING count(*)>1) d;
SELECT count(*) AS vinculos_orfaos FROM public.usuario_roles ur
  LEFT JOIN public.usuarios u ON u.id=ur.usuario_id
  LEFT JOIN public.roles r ON r.id=ur.role_id WHERE u.id IS NULL OR r.id IS NULL;
SELECT count(*) AS contas_sem_papel FROM public.usuarios u
  WHERE NOT EXISTS (SELECT 1 FROM public.usuario_roles ur WHERE ur.usuario_id=u.id);
SELECT r.nome, count(DISTINCT u.id) AS contas_ativas FROM public.roles r
  LEFT JOIN public.usuario_roles ur ON ur.role_id=r.id
  LEFT JOIN public.usuarios u ON u.id=ur.usuario_id AND u.ativo GROUP BY r.nome;
```

A identificação da Geisa deve usar ID e e-mail confirmados pelo titular em parâmetro privado, nunca inferência pelo primeiro registro ou só pelo nome. Fazer consulta direcionada retornando ID/ativo/token_version/papéis para o registro privado, sem senha/hash. Presença de hash não prova login; **não testar senha ou login real**, pois isso escreve desafios, limitadores e auditoria. Validar constraints marcadas `NOT VALID`, índices inválidos (`pg_index.indisvalid`), nulos e referências órfãs de clientes/máquinas/OS/itens/estoque conforme as colunas observadas. Consultas de totais/somas devem respeitar timeouts; não promover um inventário lento a varredura irrestrita sem nova aprovação.

## 4. Backup privado — segunda autorização, separada

Pedir aprovação específica: mesmos identificadores conferidos, role/credencial de backup existente, banco único, tabelas incluídas, destino privado cifrado, custodiante, retenção, janela/carga e limite de tempo/tamanho. Autorizar o diagnóstico **não** autoriza o dump. Sem dump remoto nesta etapa.

1. Confirmar versão do `pg_dump` compatível com o servidor (preferir mesmo major; cliente anterior ao servidor pode recusar). Confirmar permissões de leitura para todas as tabelas/sequences, large objects e ausência de RLS que torne o backup incompleto. Não contornar falta de grants com mudanças remotas implícitas.
2. Verificar no painel, mediante autorização, política vigente de PITR/restore window do projeto. Não presumir retenção por plano. PITR é proteção complementar, não substitui restore testado.
3. Preparar volume local cifrado/restrito fora do repositório; usar serviço privado `neon_backup_aprovado`, conexão **direta**, verify-full e opções read-only. Exemplo de comando após aprovação: `pg_dump --dbname=service=neon_backup_aprovado --format=custom --file=<arquivo-privado> --lock-wait-timeout=5s`. Sem `--verbose` em logs compartilhados e sem senhas em argumentos. Capturar stderr somente no destino privado. Conferir exit code antes de declarar sucesso.
4. O dump usa snapshot consistente dos dados transacionais. DDL concorrente pode interromper a operação; sequences podem avançar fora de MVCC. Para comparação exata de contagens, usar snapshot exportado em uma transação read-only e o mesmo `--snapshot` para dump e consultas, sob aprovação e timeout ajustado explicitamente. Não comparar totais de instantes diferentes como se provassem corrupção. Não pausar escritores remotos sem autorização distinta.
5. Guardar checksum SHA-256, tamanho, timestamps, versões, opções, escopo, identidade do alvo e saída final sanitizada em manifesto privado. Arquivo custom **não é criptografia**: cifrar em repouso e antes de transporte; guardar chave separada. Nunca subir o dump para Git, artefatos CI, chat ou logs.
6. `pg_dump` cobre um banco, não todos os globals/roles do cluster. Registrar grants/owners/extensões necessários à restauração por inventário autorizado; não executar `pg_dumpall` nem copiar credenciais de roles por inferência.

Referências oficiais: [Neon — pg_dump e conexão direta](https://github.com/neondatabase/website/blob/main/content/docs/manage/backup-pg-dump.md), [PostgreSQL — consistência e limites de pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html), [libpq — opções de conexão e verify-full](https://www.postgresql.org/docs/16/libpq-connect.html).

## 5. Restore isolado e integridade

1. Provisionar PostgreSQL da mesma versão major em rede isolada, sem egress para Neon, SMTP real ou serviços externos. Destino vazio com nome exclusivo, labels de propriedade, porta loopback e credenciais novas. Não herdar `.env`, `DB_URL`, `SPRING_APPLICATION_JSON` ou configurações de serviços em operação.
2. Verificar checksum/descriptografar apenas no volume privado. Inspecionar `pg_restore --list` e extensões/objetos antes de restaurar. Dados restaurados continuam sensíveis; não se tornam sintéticos. A restauração executa SQL do arquivo: usar ambiente restrito e roles locais sem superpoderes, conforme necessidade das extensões revisadas.
3. `pg_restore --exit-on-error --single-transaction --no-owner --no-privileges --dbname=service=restore_isolado <arquivo-privado>`. Mapear owners/grants localmente em passo revisado; documentar o que foi omitido. Não usar `--clean` contra um destino reaproveitado. Revalidar destino antes de cada comando.
4. Comparar inventário, tabelas, contagens do mesmo snapshot, PK/FK/UNIQUE/CHECK, índices válidos, enums, extensões, sequences (próximo valor superior aos IDs usados), relacionamentos e soma de quantidades/valores. Registrar invariantes de OS, itens, estornos, movimentações e históricos. `pg_restore` concluído não basta.
5. Comparar contas por ID, hash da senha **somente em comparação privada booleana**, ativo, token_version e papéis; nenhuma recriação, reset de senha ou renumeração. Comparar histórico Flyway/checksums e históricos de negócio. Emitir apenas contagens/deltas, nunca hashes ou dados pessoais, no relatório.
6. Não iniciar aplicação completa sobre a cópia enquanto houver egress ou filas contendo destinatários reais. Bloquear egress primeiro; direcionar SMTP somente ao sink local. Usar uma cópia adicional sanitizada para testes funcionais com contas sintéticas. A cópia de evidência deve permanecer intacta.

## 6. Ensaio V25–V28 na cópia

Usar o artefato e a versão Flyway fixados pelo commit aprovado. Executar Flyway como migrador isolado, **não via startup de Spring**. Configuração do migrador: datasource local conferido, `baselineOnMigrate=false`, `cleanDisabled=true`, `validateOnMigrate=true`, `locations` de produção do artefato. Fazer `info` e `validate`, comparar checksums V1–V24 com o manifesto do repo. Nunca usar `repair`, `baseline`, editar histórico ou ignorar divergência para conseguir prosseguir.

| Versão | Efeito a ensaiar | Invariantes |
|---|---|---|
| V25 | Catálogo RBAC, convites e auditoria administrativa; novos papéis/grants | Usuários, senhas, IDs, estado ativo e vínculos existentes preservados |
| V26 | Reduz somente permissões de CONSULTA | ADMIN/OPERADOR/SUPER_ADMIN conservam operações; contatos sensíveis minimizados pela API |
| V27 | Outbox cifrada de convites | Nenhuma entrega disparada pelo migrador |
| V28 | `refresh_tokens.session_id`, índices e recuperação | Hashes de refresh/revogação preservados; UUID em cada linha existente; não agrupar famílias históricas por suposição |

Se schema estiver em V24, aplicar sucessivamente `target=25`, 26, 27 e 28, coletando tempo, locks, versão/checksum e deltas em cada passo. Se estiver V25–27, ensaiar somente as pendentes. Se estiver abaixo de V24, acima de V28, com migrations falhas ou sem histórico numa base não vazia, parar e propor plano específico. B24 é baseline de **banco vazio**, não deve substituir V1–V24 de uma base existente. Executar `validate` final e `migrate` novamente na cópia: zero pendentes, nenhum delta inesperado.

Os testes `ProductionMigrationPathTest` exercitam esses caminhos com dados sintéticos; não substituem o ensaio sobre o backup real. Os JWTs anteriores sem `sessionId` serão rejeitados pela política nova. Refresh legado válido pode ser rotacionado para obter JWT com sessão; testar essa transição na cópia. Nunca habilitar o bypass `SECURITY_JWT_LEGACY_SESSIONLESS_ALLOWED` em produção para esconder uma regressão.

## 7. Escritas automáticas: inventário do código atual

| Gatilho | Componente | Efeito possível |
|---|---|---|
| Startup | `FlywayConfig` / auto-configuração | `migrate`, criação/alteração de schema, seeds e histórico; não faz repair automático |
| Startup, base vazia e credenciais iniciais presentes | `AdminAccountBootstrap` | Cria ROLE_ADMIN/usuário com senha inicial; proibido para provisionar o titular nesta etapa |
| ApplicationReadyEvent | `NotificacaoService.sincronizarNotificacoesIniciais` | Cria/resolve/atualiza notificações de OS e estoque |
| Timer após `INVITE_OUTBOX_POLL_MS` | `InviteOutbox.poll` | Consome filas de convite e recuperação, envia SMTP, atualiza tentativas/status/ciphertext e auditoria |
| Timer a cada 10s por padrão | `SharedRateLimitService.cleanup` | Apaga budgets expirados |
| Cron 03:00 no timezone da JVM por padrão | `RefreshTokenCleanupScheduler` | Remove refresh tokens conforme política de retenção; conferir timezone explicitamente |
| Primeiro tráfego do limitador | `SharedRateLimitService.ensureKeyGeneration/consume` | Inicializa/atualiza fingerprint e budgets; rotações podem falhar com budgets ativos |
| Login, refresh, logout, 2FA, convite, recuperação e endpoints mutáveis | Serviços de autenticação e domínio | Tokens/desafios/versões/auditoria, contas, estoque e dados operacionais |

`ConfiguracaoOficinaBootstrap` somente valida, não repara/injeta dados; Hibernate está em `ddl-auto=validate`. Os validadores `@PostConstruct` verificam configuração e não gravam por si. Desabilitar Flyway não desabilita os demais escritores. Um healthcheck acompanhado de startup completo não é diagnóstico somente leitura. Não confiar em `spring.task.scheduling.enabled=false` sem comprovar o comportamento de `@EnableScheduling` da aplicação.

## 8. Ativação e rollback futuros

Exigem autorizações separadas: diagnóstico; backup; ensaio com dados restaurados; migrations no original; ativação do serviço; convite real; transição da Geisa. Definir responsável, janela, duração máxima e canal de incidente, RPO/RTO aprovados e gates mensuráveis do relatório antes da execução.

Na candidata da auditoria 4A.1, `PASSWORD_RECOVERY_REQUESTS_ENABLED=false` bloqueia novas solicitações públicas com 503 e o validator proíbe habilitá-las no profile de produção enquanto o risco temporal REC-01 não tiver mitigação validada. A conclusão de links já emitidos permanece disponível. Não remover esse bloqueio como ajuste de configuração na janela; aprovação de diagnóstico/migration não autoriza expor o endpoint vulnerável. Decidir e comunicar o procedimento alternativo de suporte antes de qualquer ativação.

1. Guardar imagem/artefato anterior, versões de secrets e configuração, baseline de dados e backup restaurável. Confirmar acesso operacional atual e recuperação administrativa independente.
2. Conter tráfego/pausar escritores somente na janela autorizada. Uma instância migradora; validar o original antes e depois. Não executar `clean`, `repair`, baseline ou down-migrations improvisadas.
3. Injetar configuração produção conferida; remover credenciais `INITIAL_ADMIN_*`; habilitar bootstrap por convite apenas durante a janela aprovada. Conferir todas as filas pendentes e suas chaves antes de liberar workers SMTP.
4. Ativar revisão candidata, validar health, 2FA, sessão, revogação, permissões, operações e erros. Reabrir tráfego somente com invariantes e SLIs aprovados. Não usar contas reais como testes destrutivos.
5. Falha de configuração/aplicação: interromper tráfego/novos workers e voltar revisão e secrets aprovados, se compatíveis com schema. Não rotacionar JWT para simular revogação individual. Não descartar chaves de outbox ainda necessárias. Reverter RATE_LIMIT_SECRET exige plano de drenagem/expiração de budgets.
6. Falha de dados/schema: preservar evidências e alterações posteriores; restaurar para **novo destino** a partir de backup/PITR validado, comparar e redirecionar somente com autorização. Restore sobre o original e perda de escritas posteriores não são rollback automático aceitável. Nunca prometer perda zero se RPO não foi medido.

## 9. Contas futuras

**SUPER_ADMIN:** confirmar privadamente o destinatário; configurar `SUPER_ADMIN_BOOTSTRAP_EMAIL`, URL HTTPS e SMTP validado. Conta ROLE_ADMIN existente e ativa faz login com 2FA, reautentica com sua própria senha e chama `POST /api/admin/provisionamento/super-admin` com motivo e `PROVISIONAR_SUPER_ADMIN`. O endpoint recusa SUPER_ADMIN ativo ou convite pendente, grava hash do convite e outbox cifrada. O titular aceita o link de uso único, define sua própria senha e entra com 2FA. Não entregar senha inicial, usar SQL direto, reutilizar credenciais da Geisa ou preencher `INITIAL_ADMIN_PASSWORD`. Remover a referência de bootstrap após comprovar login, administração, recuperação e auditoria. Se não houver ROLE_ADMIN apto, parar; não improvisar elevação de papel.

**Geisa:** identificar o registro existente pelo ID confirmado. Somente após SUPER_ADMIN funcional, backup validado e autorização específica, usar `PUT /api/admin/usuarios/{id}/papeis`, motivo, senha do ator e `ALTERAR_PAPEIS`, para atribuir `ROLE_OPERADOR_GERAL`. Preservar ID, senha, ativo, contatos, autoria e histórico; não usar fluxo de nova conta/convite. A operação oficial incrementa `token_version` e revoga refresh sessions: planejar novo login/2FA da Geisa, sem reset de senha. Não prometer continuidade das sessões antigas. Verificar clientes, máquinas, produtos, fornecedores, categorias, estoque, OS completa/cancelada, relatórios, financeiro, CSV/PDF e configuração da oficina. Administração de identidades/infraestrutura continua exclusiva de SUPER_ADMIN; “acesso integral” aqui é a todas as operações da oficina. Havendo permissões personalizadas fora desse escopo, comparar antes e parar para decisão explícita. Rollback de papel pelo mesmo endpoint, sem recriar o usuário, também invalida sessões e fica auditado.
