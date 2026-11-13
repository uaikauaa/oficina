# Etapa 4A.2 — recuperação, configuração e gate Neon

Data: 13/11/2026 (America/Sao_Paulo). Base: PR #31, SHA
`43eec391b3ce8c1bd4505103fbdec50558e2ed56`. Trabalho em
`feat/admin-stage4a2-recovery`; PR draft separado, empilhado sobre o PR #31,
que permanece aberto e draft. O relatório retrospectivo dos PRs #17–#30 continua em
[auditoria 4A.1](../auditoria-geral/pr17-ate-atual/README.md); PRs paralelos
não foram integrados (incluindo #18 e #26). `SECURITY.md` não integra o HEAD do PR #31; sua cópia
no trabalho paralelo de governança foi consultada sem incorporação.

## REC-01: causa e alteração

Antes, `PasswordRecoveryService.request` consultava e bloqueava `usuarios`,
revogava pedidos anteriores, inseria verificador, outbox e auditoria somente
para conta ativa, tudo antes do HTTP 202. A diferença de commit e gravações
permitia a distinção temporal mesmo com status/corpo uniformes.

V29 acrescenta `password_recovery_request_jobs`. A rota pública, após
normalização e limites por IP/e-mail, consulta apenas o volume da fila e grava
um UUID e e-mail cifrado com AES-256-GCM, chave versionada da outbox e AAD
distinto. Não consulta `usuarios`, não gera token e não ramifica por existência
de conta. Fila pendente limitada a 10.000 com advisory lock transacional
compartilhado entre instâncias; saturação responde 202. Cada
instância drena no máximo 50 pedidos por ciclo com `FOR UPDATE SKIP LOCKED`.
Na mesma transação o worker consulta e bloqueia a conta, revoga reset anterior,
gera hash de token e outbox cifrada para conta ativa, audita sem e-mail/token e
apaga nonce/ciphertext do pedido. Conta inexistente/inativa não gera reset,
e-mail ou auditoria pessoal. Pedido expirado após uma hora é descartado; linhas
terminais são eliminadas após sete dias. Erro transacional deixa o pedido
pendente cifrado para retry; falha SMTP segue a política da outbox existente.
As chaves antigas devem permanecer disponíveis enquanto houver pedidos
pendentes. Nenhum token recuperável é gravado em claro.

O limite de 10.000 cobre pendências, não o volume de linhas terminais em sete
dias; monitorar crescimento, drenagem e espaço em disco antes da ativação.
Perda de chave ainda necessária esgota e apaga o pedido sem emitir link.

O controlador conserva `PASSWORD_RECOVERY_REQUESTS_ENABLED=false` por padrão.
O validator de produção continua recusando `true` até revisão independente e
autorização operacional. Conclusão de links emitidos continua disponível.
Nenhum serviço real foi habilitado.

## Evidência de testes

- PostgreSQL 16 descartável próprio na porta de teste guardada, sem herdar
  `DB_URL` operacional. O guard recusou inicialmente porta 15435; a instância
  desta etapa foi recriada na porta 5432 e nome de banco exigidos. Containers
  operacionais preexistentes não foram iniciados, reiniciados ou alterados.
- `mvnw clean verify`: **903 testes, zero falhas/erros/skips**. Testes de recuperação cobrem conta ativa/inexistente/inativa, duplicidade,
  limite por identidade, concorrência entre workers, expiração, rollback do
  pedido e do worker, SMTP 550/falha temporária, uso único, revogação de sessões
  e alteração de senha. A suíte de login/2FA/JWT/refresh e permissões integra
  a regressão Maven. V29 foi aplicada tanto no caminho histórico sintético
  quanto no B24 de produção; V1–V28 e B24 não foram modificadas.
- Ensaio HTTP loopback com servidor Spring real, CSRF, validação, rate limiter,
  transação e commit: 20 pares de aquecimento e 240 pares medidos, ordem
  aleatória reprodutível, budgets sintéticos limpos entre pares fora da janela
  medida, sem SMTP/worker no trecho medido. Conta ativa e inexistente
  retornaram HTTP 202 e corpo vazio; e-mail malformado retorna 400.
  Na execução final com trava de capacidade, medianas: 25,650 ms e 25,743 ms.
  Diferença mediana pareada: −0,083 ms, IC bootstrap 95%
  [−0,494; 0,216] ms. AUC de requisição única:
  0,480, IC bootstrap 95% [0,448; 0,513]. A execução anterior de
  `clean verify` também passou. Critério fixado para análise:
  IC da diferença mediana inteiramente em ±2 ms e IC da AUC inteiramente
  em [0,40; 0,60]; passou. O script
  `scripts/analyze-recovery-http-timing.mjs` reproduz a análise sobre
  `backend/target/recovery-http-timing.csv`.
  Essa medição local não cobre proxy público, variação de rede, carga real
  ou revisão independente. Ausência de significância isoladamente não foi
  usada como prova de equivalência.
- Frontend: **379/379** testes unitários, ESLint, TypeScript e build Next passaram;
  Playwright mockado: **115/115**. Testes offline TLS/SMTP: **2/2**;
  teste de não divulgação do auditor privado: **1/1**.
  `npm audit --audit-level=high` passou, com sete avisos moderados em
  dependências de desenvolvimento; `npm audit --omit=dev` não apontou
  vulnerabilidades no conjunto de produção.
- Stack real isolada Next/Spring/PostgreSQL/Mailpit: **3/3** cenários de
  navegador. Duas JVMs confirmaram revogação persistente, replay de refresh,
  limitador compartilhado, entrega única de convite e de pedido cifrado de
  recuperação após reinicialização. Essa prova demonstra uma entrega em
  operação saudável; SMTP externo continua sendo um efeito ao menos uma vez
  se aceitar mensagem e a transação de confirmação falhar.

## Auditoria offline de configuração

Fonte: `scripts/audit-private-config.mjs`, arquivo `.env` local existente,
metadados `docker inspect` do backend preexistente e ambiente do processo de
auditoria. O script não imprimiu valores, hostnames privados, endereços,
comprimentos/fingerprints de segredos ou credenciais. Nenhuma resolução DNS,
JDBC, handshake TLS ou API Neon foi invocada. Metadados de container não
comprovam seu ambiente efetivo após startup ou overrides externos.

| Campo/política | `.env` local | container preexistente | Compose declarado |
|---|---|---|---|
| `DB_URL`, usuário e senha | presentes; URL com `verify-full` | presentes; URL sem `verify-full` | obrigatórios |
| `JWT_SECRET` | presente, formato mínimo | presente, formato mínimo | obrigatório |
| `RATE_LIMIT_SECRET` | presente, independente | ausente nos metadados | obrigatório |
| `SERVICE_PROXY_SECRET` | presente | ausente nos metadados | opcional em Compose; obrigatório no modo Cloud Run |
| `INVITE_OUTBOX_KEYS` e versão | ausentes/inválidos | ausentes/inválidos | chave obrigatória; versão com default 1 |
| SMTP, auth e STARTTLS | presentes/ativados | presentes/ativados | declarados obrigatórios |
| `APP_PUBLIC_URL` | ausente | ausente | obrigatório |
| `SUPER_ADMIN_BOOTSTRAP_EMAIL` | ausente/desabilitado | ausente/desabilitado | vazio por padrão |
| profile | não produção | produção | produção |
| cookie Secure e CORS HTTPS exato | não comprovados | cookie Secure; CORS compatível no metadado | cookie Secure; CORS externo obrigatório |
| trusted proxies | não declarados | declarado no metadado | proxy interno declarado |
| recuperação pública | ausente: default bloqueado | imagem antiga, estado não comprovado | não declarada: default bloqueado |

O `DotenvEnvironmentPostProcessor` lê o primeiro arquivo existente em
`.env`, `../.env` ou `backend/.env` relativo ao diretório do processo,
somente fora de `test`/`prod`/`production`. Ele ignora chaves já presentes
no ambiente do sistema e adiciona as demais como fonte Spring prioritária.
O arquivo auditado está em outro worktree e não é automaticamente carregado
pela branch isolada. Compose substitui variáveis ao criar o container;
alterar `.env` não altera um container existente. Next.js recebe
`INTERNAL_BACKEND_URL` e `SERVICE_PROXY_SECRET` no processo server-side via
Compose; o navegador usa `/api` na mesma origem. Não se encontrou exposição
de segredos via `NEXT_PUBLIC_` no ambiente auditado. A configuração de
Google Secret Manager é plano de injeção futuro, não integração runtime
verificada nesta etapa; nenhum recurso Google foi consultado ou modificado.
TLS `verify-full` e cadeia de CA/hostname do alvo só podem ser comprovados
após autorização específica. `sslrootcert` ausente não invalida por si uma
truststore Java confiável; tal caminho ainda precisa comprovação.

**Ações privadas futuras por nome:** fornecer e validar
`INVITE_OUTBOX_KEYS`, `INVITE_OUTBOX_ACTIVE_VERSION`, `APP_PUBLIC_URL`,
profile/cookie/CORS de produção, role/credencial de leitura e CA/truststore;
comparar `DB_URL` efetivo do processo e metadados oficiais. Não sobrescrever
o `.env` real, rotacionar segredos ou recriar containers nesta etapa.
`INITIAL_ADMIN_PASSWORD` do container preexistente exige retirada planejada
antes da futura ativação; não usá-lo para o titular.

## Diagnóstico Neon e etapas posteriores

O [runbook](stage4a-neon-runbook.md) fixa o registro privado de organização,
project ID, branch ID, compute ID, hostname direto, banco, role existente de
leitura, referência/versão da credencial, responsável e janela. Sem esses
campos conferidos com o painel oficial, a solicitação não tem alvo exato e
permanece NO-GO. Não inferir branch pelo hostname.

**Ficha privada a preencher antes do pedido:** organização [ID], projeto [ID],
branch [ID e classificação], compute [ID], hostname direto [identificador],
banco [nome], role existente [nome e grants], credencial [referência e versão
no cofre], CA/truststore [referência], responsável [nome] e janela [início/fim].
Comparar cada identificador com o painel oficial e com a configuração
efetivamente injetada, registrando no relatório público só coincide/diverge.
Não incluir os campos preenchidos em Git, PR ou chat público.

**Texto de autorização específica, após preencher a ficha:** “Autorizo
exclusivamente uma sessão diagnóstica somente leitura no alvo, role e janela
da ficha privada conferida. Serão executados apenas os dois blocos de SELECTs
da seção 3 do runbook para identidade/TLS, catálogo, Flyway, contagens e integridade
de contas, sem hashes, tokens, senhas ou conteúdo pessoal; conexão direta
`verify-full` com CA e hostname validados, `psql -X`, transação
`REPEATABLE READ READ ONLY`, timeouts 10s/10s/2s/60s e `ROLLBACK`.
Parar ao primeiro desvio de identidade, TLS, grants, schema ou timeout.
Resultado esperado: inventário agregado e decisão para pedir autorização
separada de backup. A conexão pode acordar compute e gerar observabilidade
e custo do provedor; a role deve ter menor privilégio. Esta autorização não
inclui backup, DML/DDL, Flyway, backend, migração nem contas.” Sem ficha
completa e concordância inequívoca, não conectar.

Após autorização **separada e inequívoca**, usar conexão direta com TLS
`verify-full`, CA/hostname validados, role existente de menor privilégio,
`psql -X`, `REPEATABLE READ READ ONLY`, connect timeout 10s, statement
timeout 10s, lock timeout 2s e idle timeout 60s. Executar somente os SELECTs
limitados do runbook: identidade/TLS, catálogo/constraints, Flyway, totais de
contas, papéis e integridade, encerrando com `ROLLBACK`. Não consultar
senhas/hashes/tokens/ciphertext/PII desnecessária. Parar em divergência de
identidade, grants, TLS ou schema. Uma sessão pode acordar compute e gerar
logs/custo do provedor apesar de não escrever dados SQL.

Sequência de autorizações futuras: diagnóstico; depois backup privado cifrado
com checksum; depois restore isolado e comparação de constraints, históricos,
contas e dados; depois ensaio V25–V29 na cópia; somente posteriormente
migrations/ativação no original. Nenhum backup, restore de dados reais,
migration ou alteração no banco original ocorreu. O startup completo é
inadequado para diagnóstico: Flyway, bootstrap, sincronização de notificações,
limpeza de rate limits/tokens, filas de convite/recuperação e tráfego podem
escrever. O plano de ativação/rollback está no runbook. SUPER_ADMIN futuro
segue convite, senha definida pelo titular e 2FA; Geisa mantém ID, hash,
estado e histórico na transição oficial para OPERADOR_GERAL, com revogação
de sessões antigas e novo login. Nenhuma conta real foi alterada.

## Decisões independentes

| Gate | Decisão 4A.2 |
|---|---|
| Recuperação de senha | **PARCIAL** — arquitetura e ensaio local aprovados; revisão independente e ativação futura pendentes |
| Segurança de autenticação | **APROVADO no isolamento** — regressão de sessão/2FA/outbox; não equivale a produção |
| Configuração operacional | **PENDENTE** — divergências e variáveis ausentes acima |
| Prontidão para solicitar diagnóstico Neon | **NO-GO** até preencher e conferir alvo/role/referência privada |
| Autorização para conectar ao Neon | **NÃO CONCEDIDA** |
| Migrations reais | **NO-GO** |
| SUPER_ADMIN real | **NO-GO** |
| Alterar Geisa | **NO-GO** |
| Produção | **NO-GO** |

PR draft, sem merge ou deploy. O SHA exato do head e os checks por workflow
são registrados na descrição do PR e na entrega; o hash não é
auto-referenciado neste arquivo versionado.
