# Histórico individual dos PRs #17–#30

Consulta GitHub e histórico local em 12/11/2026. O [inventário JSON](inventario-prs.json) contém título, refs, SHAs e **todos os nomes de arquivos**; [checks-prs.json](checks-prs.json) guarda os quatro workflows por SHA. A [matriz por arquivo](matriz-rastreabilidade.md) classifica cada caminho na árvore candidata. `main` não contém o RBAC/admin ainda: #22–#30 formam cadeia draft; #18 e #26 são paralelos.

## PR #17 — Prepara Neon isolado de homologação com TLS e gate de migrations

Estado: **merged**. Base `main` (`fb64a44f1171b4320c439ac608fbfdd8411efd94`); origem `chore/neon-hml-safe-configuration`; final `f020be0da4acaf317e2ba63c4fc36375d1e57e39`. Commits (1): `f020be0da4acaf317e2ba63c4fc36375d1e57e39`. Arquivos alterados: 19, listados nominalmente no JSON e na matriz.
Mudança funcional/segurança/infraestrutura: Guard Neon de homologação, TLS, Flyway e scripts; integralmente revertido pelo #19 na main.
CI do SHA final: CI Pipeline: **success** ([run](https://github.com/uaikauaa/oficina/actions/runs/42165149327)); Integracao Real - Frontend Backend PostgreSQL 2FA: **success** ([run](https://github.com/uaikauaa/oficina/actions/runs/42165149448)); Oracle Readiness - TLS e Backup: **success** ([run](https://github.com/uaikauaa/oficina/actions/runs/42165149342)); Validacao Complementar - Flyway Real e E2E: **success** ([run](https://github.com/uaikauaa/oficina/actions/runs/42165149271)).
Estado efetivo e dependência: revertido na main pelo #19.

## PR #18 — Prepara Firebase Hosting, sessão segura e homologação Cloud Run

Estado: **open**. Base `main` (`9dd035e0bad1309c9512cc3e1150b3997d5e2425`); origem `chore/finalize-homologation`; final `dc8823d9fc75dd5ee78d2b62592694d188ea5c98`. Commits (1): `dc8823d9fc75dd5ee78d2b62592694d188ea5c98`. Arquivos alterados: 35, listados nominalmente no JSON e na matriz.
Mudança funcional/segurança/infraestrutura: Firebase Hosting/Cloud Run, adaptador de sessão cifrada e rewrites; branch paralela, fora da candidata.
CI do SHA final: Integracao Real - Frontend Backend PostgreSQL 2FA: **success** ([run](https://github.com/uaikauaa/oficina/actions/runs/42173152903)); Validacao Complementar - Flyway Real e E2E: **success** ([run](https://github.com/uaikauaa/oficina/actions/runs/42173152880)); Oracle Readiness - TLS e Backup: **success** ([run](https://github.com/uaikauaa/oficina/actions/runs/42173152884)); CI Pipeline: **success** ([run](https://github.com/uaikauaa/oficina/actions/runs/42173152940)).
Estado efetivo e dependência: fora da candidata; integração exige decisão separada.

## PR #19 — Reverter PR #17 e restaurar a main ao estado anterior

Estado: **merged**. Base `main` (`9dd035e0bad1309c9512cc3e1150b3997d5e2425`); origem `revert/pr17-restore-pre-neon-hml`; final `80faf0eea0fc7273dfd6dc22ed867cf267b9cd24`. Commits (1): `80faf0eea0fc7273dfd6dc22ed867cf267b9cd24`. Arquivos alterados: 19, listados nominalmente no JSON e na matriz.
Mudança funcional/segurança/infraestrutura: Reverte as mudanças do #17; main volta exatamente à árvore anterior ao #17.
CI do SHA final: Integracao Real - Frontend Backend PostgreSQL 2FA: **success** ([run](https://github.com/uaikauaa/oficina/actions/runs/42174782216)); Validacao Complementar - Flyway Real e E2E: **success** ([run](https://github.com/uaikauaa/oficina/actions/runs/42174782229)); Oracle Readiness - TLS e Backup: **success** ([run](https://github.com/uaikauaa/oficina/actions/runs/42174782157)); CI Pipeline: **success** ([run](https://github.com/uaikauaa/oficina/actions/runs/42174782198)).
Estado efetivo e dependência: merge da main preserva a árvore pré-#17.

## PR #20 — Audita a main restaurada e consolida documentação e evidências redundantes

Estado: **open**. Base `main` (`62e8f62d4166f5f9695c49e6588897e31777b038`); origem `chore/repository-audit-cleanup`; final `67e15deccf943ae6b14ba6b46e1c9e703e4843f7`. Commits (2): `c5d26bcde682eb4cf36384c006d8d85c6fe8761c`, `67e15deccf943ae6b14ba6b46e1c9e703e4843f7`. Arquivos alterados: 12, listados nominalmente no JSON e na matriz.
Mudança funcional/segurança/infraestrutura: Auditoria da main restaurada, limpeza e documentação.
CI do SHA final: Oracle Readiness - TLS e Backup: **success** ([run](https://github.com/uaikauaa/oficina/actions/runs/42495236430)); CI Pipeline: **success** ([run](https://github.com/uaikauaa/oficina/actions/runs/42495236417)); Integracao Real - Frontend Backend PostgreSQL 2FA: **success** ([run](https://github.com/uaikauaa/oficina/actions/runs/42495236409)); Validacao Complementar - Flyway Real e E2E: **success** ([run](https://github.com/uaikauaa/oficina/actions/runs/42495236459)).
Estado efetivo e dependência: incorporado na cadeia candidata, com arquivos evoluídos conforme matriz.

## PR #21 — Consolida documentação e evidências de auditoria com integração validada

Estado: **open**. Base `main` (`62e8f62d4166f5f9695c49e6588897e31777b038`); origem `chore/full-repository-security-cleanup`; final `5a9beb1816e10dd6c20d592f3dd04305eb476f51`. Commits (4): `91eceea781b4eba858ac02c7ee3863050c51e814`, `626bf34037e5031ad8a405370d65e49e7a04da52`, `aaa3c451cf38a9472c5e0ac01b551568e1e75a36`, `5a9beb1816e10dd6c20d592f3dd04305eb476f51`. Arquivos alterados: 18, listados nominalmente no JSON e na matriz.
Mudança funcional/segurança/infraestrutura: Consolida evidências e ajustes documentais após #20.
CI do SHA final: Oracle Readiness - TLS e Backup: **success** ([run](https://github.com/uaikauaa/oficina/actions/runs/42550956624)); CI Pipeline: **success** ([run](https://github.com/uaikauaa/oficina/actions/runs/42550956332)); Integracao Real - Frontend Backend PostgreSQL 2FA: **success** ([run](https://github.com/uaikauaa/oficina/actions/runs/42550956403)); Validacao Complementar - Flyway Real e E2E: **success** ([run](https://github.com/uaikauaa/oficina/actions/runs/42550956329)).
Estado efetivo e dependência: incorporado na cadeia candidata, com arquivos evoluídos conforme matriz.

## PR #22 — Audita conexão Neon e prepara matriz de acesso para a etapa 2

Estado: **open, draft**. Base `chore/full-repository-security-cleanup` (`5a9beb1816e10dd6c20d592f3dd04305eb476f51`); origem `chore/neon-connection-admin-readiness-audit`; final `ada7332e5fc6a93df712b6505ebdf1af421828a4`. Commits (1): `ada7332e5fc6a93df712b6505ebdf1af421828a4`. Arquivos alterados: 4, listados nominalmente no JSON e na matriz.
Mudança funcional/segurança/infraestrutura: Inventário Neon e matriz de permissões; sem leitura remota autorizada.
CI do SHA final: Oracle Readiness - TLS e Backup: **success** ([run](https://github.com/uaikauaa/oficina/actions/runs/42564615237)); CI Pipeline: **success** ([run](https://github.com/uaikauaa/oficina/actions/runs/42564615272)); Integracao Real - Frontend Backend PostgreSQL 2FA: **success** ([run](https://github.com/uaikauaa/oficina/actions/runs/42564615348)); Validacao Complementar - Flyway Real e E2E: **success** ([run](https://github.com/uaikauaa/oficina/actions/runs/42564615243)).
Estado efetivo e dependência: presente na cadeia #22–#30; arquivos podem ter sido evoluídos por PRs posteriores.

## PR #23 — Etapa 2: RBAC, administração e monitoramento isolado

Estado: **open, draft**. Base `chore/neon-connection-admin-readiness-audit` (`ada7332e5fc6a93df712b6505ebdf1af421828a4`); origem `feat/admin-rbac-users-infrastructure`; final `9842bda1fef3969ddb6fc176f9a34306b1707ab0`. Commits (2): `1715aaa44e3e8e10794b712df870e8b5689df606`, `9842bda1fef3969ddb6fc176f9a34306b1707ab0`. Arquivos alterados: 70, listados nominalmente no JSON e na matriz.
Mudança funcional/segurança/infraestrutura: RBAC/admin, V25, gestão de usuários, papéis e painel.
CI do SHA final: Integracao Real - Frontend Backend PostgreSQL 2FA: **success** ([run](https://github.com/uaikauaa/oficina/actions/runs/42678195469)); CI Pipeline: **success** ([run](https://github.com/uaikauaa/oficina/actions/runs/42678195086)); Oracle Readiness - TLS e Backup: **success** ([run](https://github.com/uaikauaa/oficina/actions/runs/42678194922)); Validacao Complementar - Flyway Real e E2E: **success** ([run](https://github.com/uaikauaa/oficina/actions/runs/42678195203)).
Estado efetivo e dependência: presente na cadeia #22–#30; arquivos podem ter sido evoluídos por PRs posteriores.

## PR #24 — Etapa 3.1: corrige RBAC de consulta e valida stack isolada

Estado: **open, draft**. Base `feat/admin-rbac-users-infrastructure` (`9842bda1fef3969ddb6fc176f9a34306b1707ab0`); origem `audit/admin-rbac-security-validation`; final `09728bf6feffd8d50bf60994680e2162bee7a6c4`. Commits (1): `09728bf6feffd8d50bf60994680e2162bee7a6c4`. Arquivos alterados: 21, listados nominalmente no JSON e na matriz.
Mudança funcional/segurança/infraestrutura: Restrições CONSULTA, V26 e testes de segurança/stack.
CI do SHA final: CI Pipeline: **success** ([run](https://github.com/uaikauaa/oficina/actions/runs/42728674984)); Oracle Readiness - TLS e Backup: **success** ([run](https://github.com/uaikauaa/oficina/actions/runs/42728674970)); Integracao Real - Frontend Backend PostgreSQL 2FA: **success** ([run](https://github.com/uaikauaa/oficina/actions/runs/42728674715)); Validacao Complementar - Flyway Real e E2E: **success** ([run](https://github.com/uaikauaa/oficina/actions/runs/42728674722)).
Estado efetivo e dependência: presente na cadeia #22–#30; arquivos podem ter sido evoluídos por PRs posteriores.

## PR #25 — Etapa 3.2: outbox criptografada de convites e validação isolada

Estado: **open, draft**. Base `audit/admin-rbac-security-validation` (`09728bf6feffd8d50bf60994680e2162bee7a6c4`); origem `fix/admin-invite-outbox-stage32`; final `bae5104d08d85ae1671284cdf814226ba2462ccb`. Commits (3): `023b7b189e204ad4c465e9bafbd4a01a388c37df`, `2cba9e0bfca1e5bf250fa2a24cad48b6820f2bf9`, `bae5104d08d85ae1671284cdf814226ba2462ccb`. Arquivos alterados: 29, listados nominalmente no JSON e na matriz.
Mudança funcional/segurança/infraestrutura: Outbox cifrada de convites V27 e testes de retomada/SMTP.
CI do SHA final: Oracle Readiness - TLS e Backup: **success** ([run](https://github.com/uaikauaa/oficina/actions/runs/42865245191)); CI Pipeline: **success** ([run](https://github.com/uaikauaa/oficina/actions/runs/42865244519)); Integracao Real - Frontend Backend PostgreSQL 2FA: **success** ([run](https://github.com/uaikauaa/oficina/actions/runs/42865245329)); Validacao Complementar - Flyway Real e E2E: **success** ([run](https://github.com/uaikauaa/oficina/actions/runs/42865244580)).
Estado efetivo e dependência: presente na cadeia #22–#30; arquivos podem ter sido evoluídos por PRs posteriores.

## PR #26 — docs: governança de segurança separada da Etapa 3.3

Estado: **open, draft**. Base `fix/admin-invite-outbox-stage32` (`bae5104d08d85ae1671284cdf814226ba2462ccb`); origem `docs/governance-stage33`; final `c5caa53b7b9db330c9af13835cace2b09e6e71c6`. Commits (1): `c5caa53b7b9db330c9af13835cace2b09e6e71c6`. Arquivos alterados: 2, listados nominalmente no JSON e na matriz.
Mudança funcional/segurança/infraestrutura: AGENTS.md e SECURITY.md; governança paralela e Integração Real falhou.
CI do SHA final: Oracle Readiness - TLS e Backup: **success** ([run](https://github.com/uaikauaa/oficina/actions/runs/42892478541)); CI Pipeline: **success** ([run](https://github.com/uaikauaa/oficina/actions/runs/42892478602)); Validacao Complementar - Flyway Real e E2E: **success** ([run](https://github.com/uaikauaa/oficina/actions/runs/42892478575)); Integracao Real - Frontend Backend PostgreSQL 2FA: **failure** ([run](https://github.com/uaikauaa/oficina/actions/runs/42892478545)).
Estado efetivo e dependência: fora da candidata; integração exige decisão separada.

## PR #27 — Etapa 3.3: recuperação, sessões e auditoria em pré-homologação

Estado: **open, draft**. Base `fix/admin-invite-outbox-stage32` (`bae5104d08d85ae1671284cdf814226ba2462ccb`); origem `feat/admin-stage33-prehomologation`; final `69ef399ff665548d47acfd03f3de5d001efebd50`. Commits (3): `a177516b3a0b15c071721fccb7b4c3acd9f8fac2`, `dac77588001683846cbbdb483fc9589e6cb5371b`, `69ef399ff665548d47acfd03f3de5d001efebd50`. Arquivos alterados: 56, listados nominalmente no JSON e na matriz.
Mudança funcional/segurança/infraestrutura: V28 recuperação, sessões, auditoria e telas; integra #25, não #26.
CI do SHA final: Oracle Readiness - TLS e Backup: **success** ([run](https://github.com/uaikauaa/oficina/actions/runs/43119087601)); CI Pipeline: **success** ([run](https://github.com/uaikauaa/oficina/actions/runs/43119087643)); Integracao Real - Frontend Backend PostgreSQL 2FA: **success** ([run](https://github.com/uaikauaa/oficina/actions/runs/43119087466)); Validacao Complementar - Flyway Real e E2E: **success** ([run](https://github.com/uaikauaa/oficina/actions/runs/43119087640)).
Estado efetivo e dependência: presente na cadeia #22–#30; arquivos podem ter sido evoluídos por PRs posteriores.

## PR #28 — Etapa 3.4: SMTP 550 real e auditoria funcional isolada

Estado: **open, draft**. Base `feat/admin-stage33-prehomologation` (`69ef399ff665548d47acfd03f3de5d001efebd50`); origem `audit/admin-stage34-final`; final `f49707d706dc61879caa5cd821c78adffaf70bf6`. Commits (2): `3463f75945c69d647252183bc18b1ed6eee389bf`, `f49707d706dc61879caa5cd821c78adffaf70bf6`. Arquivos alterados: 3, listados nominalmente no JSON e na matriz.
Mudança funcional/segurança/infraestrutura: SMTP 550 ponta a ponta e relatório 3.4.
CI do SHA final: Oracle Readiness - TLS e Backup: **success** ([run](https://github.com/uaikauaa/oficina/actions/runs/43123411237)); Validacao Complementar - Flyway Real e E2E: **success** ([run](https://github.com/uaikauaa/oficina/actions/runs/43123411203)); CI Pipeline: **success** ([run](https://github.com/uaikauaa/oficina/actions/runs/43123411453)); Integracao Real - Frontend Backend PostgreSQL 2FA: **success** ([run](https://github.com/uaikauaa/oficina/actions/runs/43123411362)).
Estado efetivo e dependência: presente na cadeia #22–#30; arquivos podem ter sido evoluídos por PRs posteriores.

## PR #29 — Etapa 3.5: vincular access tokens à sessão e fechar auditoria

Estado: **open, draft**. Base `audit/admin-stage34-final` (`f49707d706dc61879caa5cd821c78adffaf70bf6`); origem `audit/admin-stage35-final`; final `ba18f6c9791f680c23bc1d8096824e927823c2c7`. Commits (1): `ba18f6c9791f680c23bc1d8096824e927823c2c7`. Arquivos alterados: 9, listados nominalmente no JSON e na matriz.
Mudança funcional/segurança/infraestrutura: JWT vinculado à sessão persistida, revogação e testes 3.5.
CI do SHA final: Oracle Readiness - TLS e Backup: **success** ([run](https://github.com/uaikauaa/oficina/actions/runs/43129283886)); CI Pipeline: **success** ([run](https://github.com/uaikauaa/oficina/actions/runs/43129283767)); Validacao Complementar - Flyway Real e E2E: **success** ([run](https://github.com/uaikauaa/oficina/actions/runs/43129284017)); Integracao Real - Frontend Backend PostgreSQL 2FA: **success** ([run](https://github.com/uaikauaa/oficina/actions/runs/43129284112)).
Estado efetivo e dependência: presente na cadeia #22–#30; arquivos podem ter sido evoluídos por PRs posteriores.

## PR #30 — Etapa 4A: preparar Neon, validar sessões e operações isoladas

Estado: **open, draft**. Base `audit/admin-stage35-final` (`ba18f6c9791f680c23bc1d8096824e927823c2c7`); origem `audit/admin-stage4a`; final `fc1560ab07840adfe9d47515b701de809fc6a803`. Commits (2): `912a5b808f5a09c1889309ae87c240a95fadb2b5`, `fc1560ab07840adfe9d47515b701de809fc6a803`. Arquivos alterados: 27, listados nominalmente no JSON e na matriz.
Mudança funcional/segurança/infraestrutura: sessionId explícito, testes operacionais, configuração e runbook 4A.
CI do SHA final: CI Pipeline: **success** ([run](https://github.com/uaikauaa/oficina/actions/runs/43284214264)); Oracle Readiness - TLS e Backup: **success** ([run](https://github.com/uaikauaa/oficina/actions/runs/43284214167)); Validacao Complementar - Flyway Real e E2E: **success** ([run](https://github.com/uaikauaa/oficina/actions/runs/43284214221)); Integracao Real - Frontend Backend PostgreSQL 2FA: **success** ([run](https://github.com/uaikauaa/oficina/actions/runs/43284214107)).
Estado efetivo e dependência: presente na cadeia #22–#30; arquivos podem ter sido evoluídos por PRs posteriores.

## Reversão e sobreposições

| PR | Migrations no diff | Arquivos de teste no diff | Remoções relevantes |
|---|---|---:|---|
| #17 | — | 5 | nenhuma exclusão funcional identificada |
| #18 | — | 4 | nenhuma na diff do PR; mudanças fora da candidata |
| #19 | — | 5 | 8 arquivos novos do #17 e alterações revertidas |
| #20 | — | 0 | artefatos/documentos redundantes |
| #21 | — | 0 | artefatos/documentos redundantes |
| #22 | — | 2 | nenhuma exclusão funcional identificada |
| #23 | V25 | 24 | nenhuma exclusão funcional identificada |
| #24 | V26 | 10 | nenhuma exclusão funcional identificada |
| #25 | V27 | 11 | nenhuma exclusão funcional identificada |
| #26 | — | 0 | nenhuma exclusão funcional identificada |
| #27 | V28 | 17 | nenhuma exclusão funcional identificada |
| #28 | — | 2 | nenhuma exclusão funcional identificada |
| #29 | — | 3 | nenhuma exclusão funcional identificada |
| #30 | — | 7 | nenhuma exclusão funcional identificada |


`git diff fb64a44f1171b4320c439ac608fbfdd8411efd94 62e8f62 --` não retorna alteração: o merge de #19 restaurou a árvore anterior ao #17. Os guards e scripts próprios de #17 não foram reinseridos na candidata. #18 mantém adaptadores Firebase/rewrite e guard de homologação divergentes; a candidata mantém proxy Next/Spring e não os inclui. #20–#21 convergem documentação e não justificam reaplicar exclusões. #23–#30 tocam repetidamente AuthService, JwtService, SecurityConfig, outbox, testes e documentação; vale sempre o estado final da candidata, não o patch intermediário.

## Revisões

A consulta de reviews, threads e comentários dos PRs #17–#30 pelo conector GitHub retornou listas vazias na data do inventário; nenhum comentário Codex pendente foi encontrado por esse canal. Isso não comprova revisão humana. O #26 mantém um check vermelho histórico; não deve ser tratado como aprovado por checks verdes da cadeia funcional.
