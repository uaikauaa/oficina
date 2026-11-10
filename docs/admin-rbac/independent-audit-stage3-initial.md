# Etapa 3 — auditoria independente (execução parcial)

Data: 09/11/2026. Este registro descreve somente evidências observadas nesta execução. Não equivale à homologação integral solicitada.

## Base e estado GitHub

- Checkout: `audit/admin-rbac-security-validation`, HEAD inicial e final `9842bda1fef3969ddb6fc176f9a34306b1707ab0`, baseado no PR #23. O working tree já continha mudanças em `AGENTS.md` e `SECURITY.md`; foram preservadas.
- Consulta à API do GitHub: #21 aberto sobre `main` em `5a9beb1`; #22 aberto, draft, sobre a branch #21 em `ada7332`; #23 aberto, draft, sobre a branch #22 em `9842bda`.
- Oito checks de #23 no SHA acima concluídos com sucesso. O check Playwright usa API mockada, conforme seu próprio nome; não demonstra integração Next → Spring → PostgreSQL → SMTP.
- O diff do PR #23 em relação à base correta foi inventariado por arquivo. `V25__admin_rbac.sql` é a migration nova; não há `V26__notificacoes.sql`. Frontend usa Next 16.4.1, React 19.2.8, React Hook Form e Zod; não depende de shadcn/ui ou Radix.
- Mudanças desta execução: `frontend/next.config.ts`, `frontend/src/lib/securityHeaders.test.ts` e este relatório. Nenhum commit, push, PR, merge ou deploy foi feito. As alterações de governança preexistentes não foram incorporadas a esta auditoria.

## Achados reproduzíveis

| ID / classe | Severidade | Arquivo e trecho | Evidência e impacto | Correção / regressão |
|---|---|---|---|---|
| A3-01 — falha comprovada | Média | `frontend/next.config.ts`, regra global de headers; `frontend/src/app/convite/page.tsx`, token da query | `Referrer-Policy: strict-origin-when-cross-origin` envia caminho e query no `Referer` para requisições de mesma origem antes da remoção da URL pelo efeito React. Isso pode expor o token a logs internos da origem. | Regra específica `no-referrer` para `/convite`. Teste em `securityHeaders.test.ts`, 379 testes frontend verdes; GET real `?token=synthetic` respondeu 200 com `Referrer-Policy: no-referrer` e `Cache-Control: private, no-store`. Logs de acesso do próprio servidor ainda precisam ser configurados para não registrar query sensível. |
| A3-02 — falha comprovada | Alta | `backend/src/main/resources/db/migration/V25__admin_rbac.sql`, concessão `ROLE_CONSULTA` com `p.descricao LIKE 'GET /api/%'` | O SELECT concede também `relatorios.*.get` e `configuracao.oficina.get`. Qualquer conta com somente `ROLE_CONSULTA` recebe essas permissões; `SecurityConfig` autoriza por `PERM_*` correspondente. Há exposição de relatórios financeiros e dados de configuração além de uma consulta operacional restrita. | Requer migration incremental posterior à V25, com matriz explícita dos GET permitidos, e teste com JWT real de `ROLE_CONSULTA` para relatórios, configuração e rotas permitidas. V25 histórica não foi editada. Correção pendente por falta de PostgreSQL descartável para ensaiar a migration. |
| A3-03 — risco potencial | Média | `backend/src/main/java/com/oficinagestao/service/InviteService.java`, `issue()` | O SMTP é chamado antes do commit da transação. Se a transação falhar após o envio, o destinatário recebe link cujo hash não foi confirmado. Se o envio tiver sucesso mas o cliente perder a resposta, pode haver reenvio e revogação do convite anterior. Não foi reproduzida falha SMTP nesta execução. | Definir entrega transacional confiável (outbox ou equivalente) e ensaiar rollback, falha SMTP, reemissão e concorrência em banco descartável com Mailpit. |
| A3-04 — funcionalidade pendente | Média | `AuthController`, `AdminUserController`, telas administrativas | Há alteração de senha autenticada e revogação global de sessões do usuário alvo. Não há fluxo de recuperação de senha sem login nem inventário confiável de dispositivos/sessões. O relatório da Etapa 2 também os marca pendentes. | Implementação e testes separados antes de declarar gestão completa de acesso. |

## Comportamentos corretos e limites da revisão

- `JwtAuthenticationFilter` compara `token_version` atual e monta authorities a partir dos papéis e permissões atuais do banco. Isso reduz o risco de claims antigos manterem grants; testes de revogação existentes devem ser repetidos em PostgreSQL isolado.
- `SharedRateLimitService` persiste limites no PostgreSQL. Nenhum defeito foi demonstrado que justifique Redis ou Caffeine.
- `AdminUserService` impede alteração da própria conta e protege o último SUPER_ADMIN com lock transacional. A concorrência completa entre instâncias ainda precisa de ensaio isolado.
- V25 não altera os papéis de usuários existentes. `ROLE_OPERADOR_GERAL` recebe todos os grants operacionais e financeiros catalogados, enquanto as seis permissões administrativas são excluídas. A integridade de fluxos completos de OS, estoque, financeiro e exclusões permitidas não foi comprovada nesta execução.
- `AdminAccountBootstrap` pode criar uma conta `ROLE_ADMIN` quando a tabela de usuários está vazia. Flyway, bootstrap e schedulers de refresh/rate limit podem escrever. Não se deve iniciar o backend completo apontando ao Neon original durante diagnóstico.
- O painel de infraestrutura usa SQL do banco conectado e integrações condicionais. Métricas declaradas indisponíveis não foram tratadas como defeitos. Identidade de projeto/branch do Neon, quotas e billing não foram confirmados.

## Testes desta execução e lacunas

- Frontend: `npm test` **379/379**, ESLint e `npx tsc --noEmit` aprovados; `npm run build` aprovado; HTTP local da rota de convite com header confirmado; `git diff --check` aprovado.
- Backend: não executado nesta execução. `127.0.0.1:5432` e `:5433` não aceitam conexão; o daemon Docker Linux não está disponível. Os 851 testes e as migrations isoladas citados pelo PR #23 são evidência histórica do CI, não revalidação local.
- Não foram executados Playwright visual nos cinco viewports, fluxo real com Mailpit, cenários A–E de Flyway, teste de restore, ensaios de concorrência, SMTP real, probes em Neon/Google Cloud ou login das contas reais. Não classificar essas áreas como aprovadas.

## Vereditos atuais

| Item | Estado e evidência |
|---|---|
| RBAC | PARCIAL — catálogo e autorização implementados; A3-02 aberto e fluxos por papel não reensaiados. |
| SUPER_ADMIN | PARCIAL — fluxo sintético consta do PR #23; sem conta ou login real. |
| OPERADOR_GERAL | PARCIAL — grants catalogados; regressões operacionais completas pendentes. |
| Acesso operacional da Geisa | PENDENTE — nenhuma transição ou autenticação real executada. |
| Provisionamento | PARCIAL — proteção implementada; SMTP, concorrência e operação real pendentes. |
| Convites | PARCIAL — hash e uso único implementados; A3-01 corrigido, A3-03 e ensaio Mailpit pendentes. |
| JWT e sessões | PARCIAL — grants atuais e revogação implementados; inventário de sessões pendente. |
| Recuperação de senha | PENDENTE — não implementada. |
| Gestão de usuários | PARCIAL — listagem, papéis, status e revogação implementados; fluxos de UI e integração pendentes. |
| Auditoria | PARCIAL — eventos e listagem; retenção, filtros e integridade operacional pendentes. |
| Painel administrativo | PARCIAL — build aprovado, integração real e UI funcional pendentes. |
| Responsividade | PENDENTE — cinco viewports não ensaiados. |
| Dashboard Neon | PARCIAL — SQL local e API opcional; dados reais e limites não confirmados. |
| Dashboard Google Cloud | PARCIAL — requisições opcionais; IAM/métricas/custos não homologados. |
| Integridade do banco e Flyway | PENDENTE nesta execução — falta PostgreSQL descartável para reensaio V25 e dados sintéticos. |
| Backup e restauração | PENDENTE — nenhuma evidência de restore. |
| Conexão diagnóstica Neon | PENDENTE nesta execução — somente relato histórico do PR #22; identidade de projeto/branch não confirmada. |
| Conexão operacional Neon | PENDENTE — backend completo não iniciado, como exigido. |
| Login real SUPER_ADMIN e Geisa | PENDENTE — não executados. |
| Segurança | PARCIAL — A3-01 corrigido; A3-02 aberto e testes isolados restantes pendentes. |
| Regressões | PENDENTE — não reensaiadas com backend e banco. |
| CI | APROVADO para o SHA #23; alterações locais desta auditoria ainda sem CI. |
| Prontidão para homologação | PENDENTE — fechar A3-02, backend isolado, SMTP/Playwright e restore. |
| Prontidão para alterar Neon original e produção | REPROVADO — gates e autorização específica ausentes. |

## Handoff — homologação operacional controlada (plano, não executar)

1. Obter evidência privada do painel Neon para projeto, branch, compute, banco, role, endpoint direto/pooled e plano. Confirmar os mesmos identificadores por sessão diagnóstica somente leitura com TLS `verify-full`, sem iniciar Spring completo.
2. Criar backup consistente privado, verificar integridade e restaurar em PostgreSQL descartável. Conferir usuário operacional sintético/equivalente, vínculos de clientes, máquinas, OS, estoque e histórico.
3. Rotacionar segredos expostos em canais anteriores por procedimento aprovado, sem publicá-los em Git, logs ou relatório. Validar Secret Manager, IAM, backend privado, proxy e cookies no ambiente isolado.
4. Ensaiar V25 e eventual migration incremental em bancos descartáveis: B24→V25, V1–V24→V25, restart, falha controlada e dados sintéticos históricos. Confirmar ordem de migration, efeitos de startup e rollback por restauração.
5. Corrigir A3-02 e fechar testes por papel/objeto. Executar Next → Spring → PostgreSQL descartável → Mailpit e Playwright nos cinco tamanhos, inclusive 2FA, convite, login, operações de OS/estoque/financeiro, negações administrativas, revogação e token antigo.
6. Com todos os gates fechados, apresentar separadamente ao operador o alvo exato, comandos de implantação/migration, janela, backup, rollback, responsáveis e evidências esperadas. Solicitar aprovação específica **antes** de qualquer escrita no Neon, deploy ou provisionamento.
7. Após autorização futura, provisionar SUPER_ADMIN com participação do titular, validar login/2FA, recuperação, operações e auditoria; só então planejar transição da conta operacional preservando ID, hash, estado e vínculos, com rollback ensaiado. Interromper diante de divergência de identidade, migration, restore, autenticação ou acesso operacional.

**GO/NO-GO atual: NO-GO para Neon original e produção.**
