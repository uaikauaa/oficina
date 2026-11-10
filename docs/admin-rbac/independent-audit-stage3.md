# Etapa 3.1 — auditoria e remediação isolada

Continuação: [Etapa 3.2 — outbox de convites e validação isolada](independent-audit-stage3-2.md). Os vereditos abaixo são históricos da Etapa 3.1.

Data local: 09/11/2026. Referência inicial: PR #23, SHA `9842bda1fef3969ddb6fc176f9a34306b1707ab0`. Branch: `audit/admin-rbac-security-validation`, baseada no head de #23. Os PRs #21, #22 e #23 estavam abertos em cadeia; #22 e #23 em draft. Os oito checks de #23 eram do SHA antigo. O SHA final e o CI das correções devem ser conferidos no novo PR. Nenhum merge, deploy ou acesso ao Neon original ocorreu nesta etapa. O [relatório inicial](independent-audit-stage3-initial.md) foi preservado separadamente.

O working tree inicial tinha alterações em `AGENTS.md`, `SECURITY.md`, `frontend/next.config.ts` e `frontend/src/lib/securityHeaders.test.ts`. As mudanças de governança foram preservadas fora da correção funcional. PNGs gerados novamente pelo Playwright foram restaurados ao estado inicial após a execução.

## Ambiente e isolamento

Docker Desktop estava instalado com daemon Linux inicialmente parado; foi iniciado em segundo plano. PostgreSQL 16 descartável foi criado em container identificado, com `--tmpfs /var/lib/postgresql/data`, porta **127.0.0.1:5433**, banco `oficina_gestao_test` e credenciais sintéticas. O guard do backend confirmou o destino antes da conexão. Nenhuma variável de conexão Neon ou de teste estava herdada antes da configuração. A integração real usou outro PostgreSQL descartável em 127.0.0.1:15433 e Mailpit local, com containers removidos pelo script. V1–V25 e B24 não foram alteradas; a próxima versão livre era V26.

## Achados

| ID / classe | Severidade | Evidência, impacto e resolução |
|---|---|---|
| A3-01 — falha confirmada, corrigida | Média | `/convite` recebe token na query, mas a política global `strict-origin-when-cross-origin` permitia enviar a URL no `Referer` de mesma origem. `nginx/nginx.conf` registrava `$request_uri`, incluindo query. Regra específica `no-referrer` e log com `$uri` foram aplicados. Testes unitário, Playwright e resposta HTTP local confirmaram header, cache `no-store` e remoção da query da barra. Logs de plataformas externas ainda exigem verificação. |
| A3-02 — falha confirmada, corrigida | Alta | V25 concedia todo GET a `ROLE_CONSULTA`, incluindo relatórios financeiros, configuração, produto com custo/margem e OS. V26 remove apenas grants excessivos desse papel e mantém nove leituras explícitas. Flyway em banco novo e V25 existente, mais JWT real, passaram. Papéis operacionais e super admin não foram modificados pela V26. |
| A3-03 — risco confirmado no código, aberto | Alta | `InviteService.issue()` chama `mail.sendInvitation()` antes de confirmar a transação. Falha de commit posterior pode entregar um link inválido. A suíte do convite usa SMTP mockado e não simula commit ambíguo, falha SMTP, reemissão e concorrência completa. Um callback após commit isolado também perderia mensagens após falha de processo. Fechamento exige outbox durável sem token em claro, retries, controle de duplicação, migration incremental e ensaios com Mailpit. Impacto na gestão de segredos precisa de revisão antes da mudança. Provisionamento real permanece bloqueado. |
| A3-04 — falha confirmada, corrigida | Alta | `ConfiguracaoOficinaController` exigia `ROLE_ADMIN` no PUT, apesar de `SecurityConfig` conceder `configuracao.oficina.put` ao operador e super admin. A anotação passou a exigir a permissão granular. JWT real dos dois papéis obteve 200 em PUT sintético; consulta recebeu 403. |
| A3-05 — falha confirmada, corrigida | Média | `UsuarioRepository.searchAdmin()` aplicava `LOWER()` ao parâmetro nulo da busca. PostgreSQL retornou `function lower(bytea) does not exist` e GET admin sem filtro respondeu 503 no primeiro `mvn clean verify`. Busca vazia agora usa padrão `%` tipado. Teste HTTP com JWT real e suíte final passaram. |
| A3-06 — falha na seleção dos testes, corrigida | Média | Playwright padrão recolhia `logout.spec.ts`, que exige servidor/porta dedicados: 10 falhas `net::ERR_FAILED`. A configuração dedicada também fixava a origem errada. A suíte padrão agora exclui logout e a fixture usa a origem do projeto. Reexecução: 115 testes padrão e 20 dedicados aprovados. |

## Permissões

`ROLE_CONSULTA` mantém somente `categorias.get`, `categorias.id.get`, `categorias.ativas.get`, `clientes.get`, `clientes.id.get`, `maquinas.get`, `maquinas.id.get`, `fornecedores.get` e `fornecedores.id.get`. Leituras cadastrais incluem dados pessoais; a necessidade de cada campo ainda precisa de validação de negócio. Não há grants de relatórios, OS, estoque, produtos com custo/margem, configuração ou APIs administrativas.

`ROLE_OPERADOR_GERAL`, `ROLE_SUPER_ADMIN` e `ROLE_ADMIN` preservam os grants operacionais da V25; `ROLE_SUPER_ADMIN` mantém os seis grants administrativos. V26 não altera `GERENTE`, `ATENDENTE`, `TECNICO`, `ESTOQUISTA`, `FINANCEIRO` ou papéis personalizados. JWT real cobriu consulta, operador e super admin, inclusive negação administrativa ao operador e PUT de configuração. A matriz completa de fluxos de negócio por todos os papéis segue pendente.

## Testes executados

| Teste | Resultado e alcance |
|---|---|
| `mvnw.cmd clean verify` com guard e PostgreSQL descartável | **854 testes, zero falhas, erros ou skips**. A primeira tentativa revelou duas falhas reais (versão esperada 25 e GET admin 503); ambas foram corrigidas antes da execução final. |
| Flyway | B24→V26, V1–V26 sintético, V21/V24→V26, V25→V26, comparação de schema, preservação de dados e reinicialização sem migration adicional: aprovados. |
| Frontend | **379 testes**, TypeScript, ESLint e build Next aprovados. |
| Playwright padrão | **115 aprovados**, API mockada. Cinco telas administrativas em 320×568, 390×844, 768×1024, 1366×768 e 1920×1080; carregamento e ausência de overflow. Não é integração real dessas telas. |
| Playwright logout dedicado | **20 aprovados** em desktop e celular, API mockada. |
| Integração real isolada | **1 Playwright aprovado**: Chromium → Next → Spring → PostgreSQL descartável → Mailpit; login/2FA, clientes, máquinas, produtos, estoque, OS, PDF/CSV e logout. Duas JVMs validaram o orçamento de rate limiting. Não cobre convite/provisionamento administrativo. |
| Nginx | Imagem construída. `nginx -t` passou em container efêmero com certificado sintético e aliases locais `backend`/`frontend`; configuração de ingress real segue pendente. |

Não houve backup/restauração do Neon, SMTP real, confirmação de projeto/branch no painel Neon, Cloud Run/IAM real ou login das contas reais. A3-03 não está encerrado. Testes negativos MockMvc não substituem validação operacional completa da Geisa.

## Vereditos

| Item | Estado | Evidência / pendência |
|---|---|---|
| RBAC | PARCIAL | A3-02/04 corrigidos; matriz completa por papel/objeto pendente. |
| SUPER_ADMIN | PARCIAL | Administração e operação sintéticas verificadas; sem login real. |
| OPERADOR_GERAL | PARCIAL | Grants e PUT configuração preservados; fluxos integrais por identidade pendentes. |
| Acesso operacional da Geisa | PENDENTE | Conta real não alterada ou autenticada. |
| Provisionamento e convites | PARCIAL | Proteções existentes; A3-03 bloqueia uso real. |
| JWT e sessões | PARCIAL | Grants atuais e revogação testados; inventário de dispositivos pendente. |
| Recuperação de senha | PENDENTE | Fluxo sem login não implementado. |
| Gestão de usuários | PARCIAL | GET sem filtro corrigido; UI com backend real pendente. |
| Auditoria | PARCIAL | Eventos/listagem; filtros e retenção pendentes. |
| Painel administrativo e responsividade | PARCIAL | Cinco telas/cinco viewports com API mockada. |
| Dashboard Neon e Google Cloud | PARCIAL | Métricas indisponíveis declaradas; provedores reais não homologados. |
| Integridade do banco e Flyway | APROVADO em isolamento | Caminhos V26 e dados sintéticos aprovados; Neon original não avaliado. |
| Backup e restauração | PENDENTE | Nenhum restore comprovado. |
| Conexão diagnóstica Neon | PENDENTE nesta etapa | Relato histórico do PR #22 não confirma estado atual. |
| Conexão operacional Neon e logins reais | PENDENTE | Backend e contas reais não testados no original. |
| Segurança e regressões | PARCIAL | A3-01/02/04/05/06 corrigidos; A3-03 e fluxos por objeto pendentes. |
| CI do novo commit | PENDENTE até execução no PR desta branch | Checks #23 são do SHA antigo. |
| Homologação real e produção | REPROVADO | A3-03, backup/restore, identidade Neon, segredos e aprovação pendentes. |

## Handoff controlado

1. Fechar A3-03 com outbox segura e ensaios SMTP/commit/reemissão/expiração/concorrência; completar fluxo administrativo real em ambiente descartável.
2. Confirmar projeto, branch, compute, banco, usuário, endpoints e plano no painel Neon; cruzar por sessão diagnóstica somente leitura, TLS `verify-full`, sem iniciar Spring completo.
3. Criar backup privado e restaurar em banco isolado. Verificar vínculos de clientes, máquinas, OS, estoque e histórico, com tempo de recuperação medido.
4. Ensaiar V25→V26 e efeitos de startup em cópia isolada. Flyway não possui down migration automática: rollback operacional exige restauração verificada ou migration compensatória aprovada.
5. Revisar rotação de segredos, IAM do backend privado, proxy, cookies, logs e retenção; confirmar que ingressos externos não registram query do convite.
6. Apresentar alvo, janela, comandos, responsáveis, critérios de parada, evidências e plano de retorno. Obter autorização específica antes de migration, deploy, provisionamento ou mudança de papel no Neon.
7. Somente após autorização futura: provisionar SUPER_ADMIN com o titular, validar login/2FA/recuperação e operações; então transicionar a conta operacional preservando ID, hash, estado e vínculos. Interromper em qualquer falha de restore, autenticação, autorização ou funcionalidade operacional.

**GO/NO-GO: NO-GO para Neon original e produção.**
