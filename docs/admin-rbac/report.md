# Etapa 2 — relatório de implementação isolada

Data: 9/11/2026. Base: PR #22, SHA `ada7332e5fc6a93df712b6505ebdf1af421828a4`. Branch: `feat/admin-rbac-users-infrastructure`, a partir do head do PR #22; PR da etapa deve usar `chore/neon-connection-admin-readiness-audit` como base enquanto #22 estiver aberto. PRs #21 e #22 estavam abertos com oito checks verdes cada na consulta inicial. Nenhum merge, deploy ou migration no Neon original foi feito. Dois PNGs não rastreados preexistentes no frontend foram preservados fora do commit.

## Implementação

- **Banco:** V25 incremental cria catálogo de permissões, associação papel/permissão, convites de uso único, trilha administrativa e papéis novos. V1–V24 e B24 permaneceram intactas. `ROLE_ADMIN` legado mantém operações, sem ganhar administração de identidades. O gerador do catálogo liga 74 rotas operacionais da matriz de 83 combinações à migration e ao `SecurityConfig`.
- **Autorização:** JWT validado contra `token_version` e grants atuais do banco em cada request; claims de papel do token não concedem acesso. Rotas API desconhecidas são negadas. APIs de usuários, papéis, auditoria e infraestrutura têm permissões explícitas; a rota inicial de provisionamento exige `ROLE_ADMIN`, e-mail fixado na configuração, senha atual e ausência de SUPER_ADMIN ativo ou convite pendente.
- **Usuários e segurança:** listagem, busca, filtro e paginação; mudança de status e papéis; revogação de sessões por incremento de versão e revogação dos refresh tokens. Reautenticação e motivo em mutações; bloqueio de autodesativação e proteção do último SUPER_ADMIN. Convite de 24 horas envia token por e-mail e armazena só hash; senha escolhida pelo titular; login subsequente exige 2FA. Auditoria administrativa registra ator, alvo, ação e motivo.
- **Interface:** `/administracao`, `/administracao/usuarios`, `/administracao/papeis`, `/administracao/auditoria`, `/administracao/infraestrutura` e `/convite`. Usa layout autenticado, componentes e cliente API/CSRF existentes; CSS responsivo das páginas. O backend permanece a autoridade final.
- **Infraestrutura:** tamanho lógico, tabelas e estimativas de registros do PostgreSQL conectado; nome do projeto via API Neon se configurada; requisições Cloud Run via Cloud Monitoring se projeto, serviço e IAM estiverem configurados. Cache, timeouts, fontes e indisponibilidade explícita. Armazenamento faturado, CU-hours, quota real, CPU, memória, instâncias, billing e orçamento não são apresentados como números sem fonte. Detalhes em [infrastructure.md](infrastructure.md).

## Validação e limites

O banco de teste foi um container PostgreSQL 16 descartável em `127.0.0.1:5433/oficina_gestao_test`, separado do banco local ativo e do Neon. O guard de testes rejeita destinos externos e confere porta, nome e migrations sintéticas. A suíte inclui Flyway em schema vazio e caminho de atualização, autenticação, rotas, mudança de grants, revogação de token, ciclo de usuário, convite, papéis personalizados, provisionamento inicial e veracidade do painel. A auditoria independente inventaria 97 combinações HTTP/rota (83 originais + 14 novas) e exercita anônimo, usuário comum e `ROLE_ADMIN` com JWT real; o teste especial do provisionamento usa identidade sintética.

Frontend: 378 testes Node passaram; TypeScript, ESLint das telas administrativas e build Next passaram. Backend: `mvn clean verify` passou com **851 testes, 0 falhas, 0 erros, 0 ignorados**. Testes externos reais de Neon/Google, entrega SMTP/2FA de ponta a ponta e Playwright visual permanecem pendentes. Nenhuma API externa paga foi ativada.

## Plano de contas e gates

O futuro titular da conta principal receberá convite no e-mail `kauagustavo1511@gmail.com` **somente após aprovação operacional separada**. O endereço não foi criado no Neon. O ensaio sintético do endpoint inicial e da aceitação de convite está em `SuperAdminBootstrapIntegrationTest`; o procedimento detalhado está em [provisioning.md](provisioning.md). Geisa mantém ID 1, estado ativo, hash, histórico e `ROLE_ADMIN` no banco original. A migração para `ROLE_OPERADOR_GERAL` depende de autenticação, 2FA, acesso operacional e recuperação comprovados da conta principal; deve revogar sessões e ter rollback ensaiado.

Os achados F01–F09 da [auditoria da Etapa 1](../neon-admin-readiness/README.md) não são encerrados por estes testes. Principalmente: projeto/branch/endpoint Neon não confirmados no console; backup e restauração não comprovados; segredos aparentes do pedido exigem rotação; startup completo ainda pode escrever por Flyway, bootstrap e tarefas; compatibilidade de carga no pooled não foi ensaiada. O banco local medido pelo painel não prova estado do Neon. Antes de alterar o Neon original, obter confirmação do operador sobre o projeto e branch, backup restaurável, rotação, ordem de migration, ensaio de provisionamento/transição/rollback e autorização explícita para as operações exatas.

## Vereditos de revisão

| Item | Estado | Evidência ou pendência |
|---|---|---|
| RBAC | PARCIAL | Rotas e grants implementados; falta homologação operacional por papel e objeto |
| SUPER_ADMIN | PARCIAL | Fluxo inicial sintético, grants e proteção do último; sem conta real |
| OPERADOR_GERAL | PARCIAL | Grants operacionais sem ensaio funcional integral de UI |
| Acesso integral da Geisa | PENDENTE | Conta original preservada; nenhuma transição feita |
| Gestão de usuários | PARCIAL | API, convites e telas; recuperação e listagem de sessões não implementadas |
| Convites | PARCIAL | Uso único/expiração/role fixo testados; SMTP real pendente |
| Segurança | PARCIAL | Reautenticação, CSRF e grants atuais; revisão de IDOR ainda necessária |
| Revogação de sessões | APROVADO | `token_version` e refresh revogados em testes sintéticos |
| Auditoria | PARCIAL | Eventos administrativos e listagem; retenção/exportação não definidas |
| Painel administrativo | PARCIAL | Resumo real e navegação; alertas de segurança não agregados |
| Dashboard Neon | PARCIAL | SQL real local e projeto opcional; consumo/quota indisponíveis |
| Dashboard Google Cloud | PARCIAL | Leitura opcional de requisições; métricas e billing restantes pendentes |
| Responsividade | PARCIAL | Classes responsivas e build; revisão visual em viewport pendente |
| Flyway | APROVADO EM ISOLAMENTO | V25 e percurso de schema descartável |
| Integridade | PARCIAL | Sem exclusões reais; backup/restore original pendentes |
| Testes | PARCIAL | Suítes automatizadas; integração externa e E2E pendentes |
| CI | PENDENTE | Checks do PR da etapa ainda não disponíveis neste relatório |
| Prontidão para homologação | PARCIAL | Código revisável e banco descartável; SMTP, UI e provider pendentes |
| Prontidão para alterar Neon original | REPROVADO | Gates de identidade, backup, rotação e autorização não fechados |
| Produção | REPROVADO | Sem deploy/merge e sem validação operacional |

Achados abertos: **ALTO**: ausência de backup/restauração comprovada e identidade Neon não confirmada; **MÉDIO**: recuperação e sessões detalhadas ausentes, dados de billing e limites não integrados, falta de Playwright e SMTP real; **INFORMATIVO**: contagens por módulo usam `reltuples` estimado e podem atrasar. Nenhuma exclusão de dados ou alteração de usuário no banco original foi autorizada.
