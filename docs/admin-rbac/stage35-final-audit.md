# Etapa 3.5 — fechamento das pendências críticas

> Retificação da Etapa 4A (12/11/2026): o SHA final do PR #29 é `ba18f6c9791f680c23bc1d8096824e927823c2c7`. O total correto dos XMLs locais é **889**, igual ao CI. A soma de 857 veio dos resumos `.txt`, que registraram zero para os containers de testes aninhados `IpAddressResolverTest` (28 casos no XML) e `ProductionOpenApiSecurityTest` (4 casos no XML). Não houve remoção de testes. O SHA no rodapé e a contagem abaixo são registros históricos incorretos, substituídos por esta retificação. Evidências e estado atual: [relatório 4A](stage4a-prehomologation.md).

Data: 11/11/2026. Branch: `audit/admin-stage35-final`. Base isolada: PR #28, `f49707d706dc61879caa5cd821c78adffaf70bf6`. Este relatório registra somente evidências reproduzidas em ambiente sintético local. Nenhuma conexão, migration, bootstrap, conta, papel, e-mail, merge ou deploy foi executado no Neon original.

## Resultado executivo

A pendência de revogação individual foi fechada no código: tokens de acesso emitidos por login/refresh carregam o `sessionId` persistido no refresh token; o filtro consulta uma sessão ativa antes de construir a autenticação. A revogação de uma sessão invalida imediatamente o access JWT correspondente, rejeita seu refresh e mantém outras sessões ativas. A rotação preserva o mesmo identificador e a revogação global invalida todas.

O veredito global permanece **NO-GO para pré-homologação definitiva**. A branch tem evidência forte para a segurança de sessão, matriz HTTP sintética, recuperação e painel mockado, mas ainda não demonstra a matriz integral de mutações válidas por papel e todos os estados do painel contra uma stack real. O trabalho não autoriza qualquer operação no Neon original.

## Mudanças implementadas

- `JwtService`: claim opcional `sessionId`, extração validada como UUID e vínculo transitório usado pelos caminhos reais de login/refresh, preservando fixtures unitários legados.
- `JwtAuthenticationFilter`: em ambiente normal, access JWT com `sessionId` só autentica quando há refresh token não revogado e não expirado para o usuário e a sessão; JWT sem claim é rejeitado por padrão. `security.jwt.legacy-sessionless-allowed=true` existe somente no profile de testes para fixtures antigas.
- `RefreshTokenRepository`: consulta de sessão ativa e identificação de revogação explícita da sessão. O replay de token rotacionado mantém a revogação da família; uma revogação deliberada no painel não derruba sessões independentes.
- `AuthService`: login 2FA e refresh emitem o access token depois de persistir a sessão, mantendo o `sessionId` durante a rotação.
- Dois testes de integração novos cobrem duas sessões, revogação individual/global, refresh rejeitado, rotação preservada e claim órfão rejeitado. Um teste novo mede recuperação existente vs. inexistente.

## Sessões e revogação — evidência

`AccessTokenSessionBindingIntegrationTest`: 2 testes, 0 falhas. Cada access JWT foi verificado em `/api/auth/me`; antes da revogação A e B retornaram 200, após revogar A A retornou 401 imediatamente e B continuou 200. O refresh A foi rejeitado sem derrubar B; o refresh B rotacionou e conservou o mesmo UUID. A revogação global invalidou os dois access JWTs. `AuthServiceTest` (50 testes) e `RefreshReusePersistenceTest` (3 testes) também passaram, preservando a defesa de replay.

Mudanças de papel e `token_version` continuam cobertas por `AdminUserLifecycleIntegrationTest`, `CustomRoleRevocationIntegrationTest` e `AuthLifecycleAuditIntegrationTest`. Reinício de JVM e o fluxo HTTP real de sessão não foram executados nesta branch; devem ser repetidos no CI isolado antes de qualquer promoção.

## Matriz de autorização e operações

Executados no PostgreSQL descartável `127.0.0.1:5433/oficina_gestao_test`, com migrations sintéticas hash-checkadas:

| Evidência | Resultado |
|---|---:|
| `RoleMatrixRouteIntegrationTest` | 1/1 |
| `ConsultaPermissionIntegrationTest` | 4/4 |
| `AdminUserLifecycleIntegrationTest` | 1/1 |
| `CustomRoleRevocationIntegrationTest` | 1/1 |
| `SessionControllerIntegrationTest` | 2/2 |
| `AuthLifecycleAuditIntegrationTest` | 7/7 |
| `PasswordRecoveryIntegrationTest` | 7/7 |
| `RefreshReusePersistenceTest` | 3/3 |

Os testes comprovam positivos/negativos de rota, grants persistidos, isolamento por objeto, papéis delegados/personalizados, proteção do último superadmin e revogações. A lacuna restante é executar, para cada papel operacional, todas as mutações válidas (editar, inativar, cancelar, concluir, estornar, CSV e configuração) com dados sintéticos representativos, além de repetir a mesma matriz em navegador real.

## Painel administrativo e estados críticos

`npm run test:e2e`: 115/115 testes Playwright mockados passaram, com cinco viewports (320, 390, 768, 1366 e 1920 px). A suíte cobriu administração, busca/filtro/paginação, formulários, acesso negado, sessão expirada, estado vazio/carregando/erro, respostas 400/401/403/404/500, falha de rede, reenvio, teclado/foco, CSP e overflow.

Limite: a evidência acima intercepta a API. Não foi declarada como prova de operações persistentes reais do painel; a execução real deve repetir esses estados com Next → Spring → PostgreSQL descartável e registrar os resultados por rota.

## Recuperação de senha e tempo de resposta

`PasswordRecoveryTimingIntegrationTest` amostrou 20 endereços existentes e 20 inexistentes com IPs RFC-5737 distintos, sem e-mail real. Medição observada:

| Caminho | Mediana | P95 |
|---|---:|---:|
| endereço existente | 13,3 ms | 16,7 ms |
| endereço inexistente | 7,6 ms | 9,8 ms |

Razão das medianas: 1,76. O teste aplica envelope diagnóstico amplo (<30x), e a implementação mantém resposta genérica, limite por IP/e-mail e ausência de envio síncrono. Não houve diferença de status/corpo na cobertura existente. A medição não é benchmark de produção; repetir com carga controlada antes de abrir a homologação.

## PR #26 e dependências

PR #26 (`docs/governance-stage33`, `c5caa53b7b9db330c9af13835cace2b09e6e71c6`) continua draft, aberto e mergeable, baseado no PR #25. Os workflows observados no head foram: CI Pipeline **success**, Flyway/E2E complementar **success**, Oracle Readiness **success** e Integração Real **failure**. A falha permanece um bloqueio de evidência do PR paralelo; não foi alterado timeout, seletor ou dependência nesta etapa.

`npm ci --ignore-scripts` registrou 7 vulnerabilidades moderadas, todas transitivas de desenvolvimento (`typescript-eslint`/`minimatch`); `npm audit --omit=dev` retornou 0 vulnerabilidades de produção. Nenhum `npm audit fix` ou atualização arbitrária foi aplicada.

## Gates executados

- Maven `clean verify` com guard de banco e PostgreSQL 16 descartável: 857 testes reportados, 0 falhas, 0 erros, 0 skips; JAR gerado.
- Frontend unitário: 379/379.
- Next build: concluído, TypeScript concluído e 27 páginas geradas.
- Playwright mockado: 115/115.
- Flyway sintético: 28 migrations aplicadas/validadas no banco de teste; nenhum usuário operacional.
- `git diff --check`: passou.

Os PNGs de revisão visual e previews gerados automaticamente pelos testes permanecem fora do commit desta branch; não fazem parte do escopo da auditoria.

## Decisões finais separadas

| Decisão | Veredito | Motivo |
|---|---|---|
| Preparação técnica isolada | **GO** | Código de sessão corrigido, testes backend/frontend e guard sintético passaram. O GO é restrito à preparação e não à homologação definitiva. |
| Migrations no Neon original | **NO-GO** | Não autorizadas nem executadas; requerem identidade confirmada, backup/restauração e ensaio separado. |
| Conta real `kauagustavo1511@gmail.com` / SUPER_ADMIN | **NO-GO** | Nenhuma conta real foi criada ou alterada; `.env` não foi usado para bootstrap operacional. |
| Produção/deploy/merge | **NO-GO** | PR deve permanecer draft; faltam matriz real integral, painel real completo e revisão do PR #26. |

## Próximo gate seguro

Executar apenas em ambiente descartável: stack real com Mailpit, matriz completa por papel e por objeto, estados do painel em cinco viewports, novo processo JVM para validar revogação após restart e repetição da Integração Real do PR #26. Depois, produzir plano separado para Neon com confirmação de projeto/branch/banco/role, backup cifrado restaurável, `verify-full`, ensaio das migrations e autorização explícita por operação. Até lá, não conectar o sistema ao Neon original, não criar a conta real e não fazer merge/deploy.
Commit auditado: `c5d45f401c75101afa8a4b8ebbee50c6c797f7eb`.
