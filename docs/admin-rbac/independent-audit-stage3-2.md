# Etapa 3.2 — outbox de convites e validação isolada

Data: 09/11/2026. Base: `09728bf6feffd8d50bf60994680e2162bee7a6c4` (PR #24). Branch de trabalho: `fix/admin-invite-outbox-stage32`. PR draft: #25. SHA da implementação: `023b7b189e204ad4c465e9bafbd4a01a388c37df`; o SHA final é o head do PR #25, atualizado ao publicar este relatório. Os PRs #21–#24 foram conferidos como abertos antes da alteração; #24 tinha oito checks aprovados somente no SHA inicial. `AGENTS.md` e `SECURITY.md` já modificados localmente foram preservados e excluídos desta entrega. Não houve conexão ao Neon original, migração remota, conta real, deploy ou merge.

## A3-03

V27 acrescenta `invite_delivery_outbox`. `InviteService.issue()` grava convite e payload criptografado na mesma transação; o worker só enxerga linhas confirmadas. `InviteOutbox` usa `FOR UPDATE OF o SKIP LOCKED`, até dez entregas por ciclo e cinco tentativas por convite. Falhas transitórias usam 30, 60, 120 e 240 segundos de backoff; após a quinta, o registro fica `EXHAUSTED`. Autenticação/parsing SMTP são terminais. Convite revogado, usado ou expirado é cancelado antes de enviar. Reemissão revoga o convite anterior e apaga seu ciphertext na mesma transação. O token de validação continua apenas como SHA-256 na tabela de convites.

O payload usa AES-256-GCM com nonce aleatório de 96 bits, tag de 128 bits e AAD do ID do convite; `UNIQUE(key_version, nonce)` impede reutilização do par no banco. `INVITE_OUTBOX_KEYS` recebe `versão:base64-de-32-bytes`, separada de JWT, rate limiting, proxy e senha do banco; `INVITE_OUTBOX_ACTIVE_VERSION` escolhe a chave para novas mensagens. A aplicação falha na inicialização se a chave ativa faltar ou for inválida. Rotações mantêm a versão anterior disponível até esvaziar os pendentes. Em `SENT`, `CANCELLED` e `EXHAUSTED`, nonce e ciphertext viram `NULL`. Auditoria registra ID e categoria, sem token, URL ou ciphertext. O exemplo de teste é sintético e não serve para implantação.

SMTP e confirmação no banco não são uma transação distribuída. Se o SMTP aceitar o e-mail e a confirmação falhar, o worker reenviará após reinício. Dois e-mails podem conter o mesmo link; o uso único é garantido na aceitação do convite. Um teste injeta falha de confirmação após a chamada SMTP e prova duas chamadas de envio com uma única entrega final. Não há promessa de entrega exatamente uma vez.

## Evidências locais

PostgreSQL 16 com `tmpfs` em `127.0.0.1:5433`, banco exato `oficina_gestao_test`, guard de testes e migrations sintéticas verificadas por SHA-256. A suíte focada exercitou commit, rollback, falha SMTP transitória e permanente, retry, reemissão, expiração antes e depois da entrega, token revogado, ciphertext corrompido, chave incorreta, rotação, falha de escrita no banco, duas threads com `SKIP LOCKED` e ambiguidade SMTP/ack. Os testes de ciclo de vida verificaram aceitação única, replay e provisionamento sintético. `mvnw.cmd clean verify`: relatórios de **867 testes, zero falhas, erros ou skips** e JAR gerado; a captura do exit code foi interrompida após a geração dos relatórios, de modo que este comando deve ser repetido como gate no CI. Flyway: B24→V27, V1→V27 sintético, V21/V24/V25/V26→V27, comparação de schema e integridade do histórico. Nenhuma migration anterior foi editada.

Frontend: **379 testes**, TypeScript, ESLint e build Next aprovados. A mensagem de criação de convite agora informa processamento do envio. Playwright mockado: **115 aprovados**, evidência de regressão visual, sem provar integração. O ensaio `scripts/test-real-stack-local.mjs` usa Next, Spring, PostgreSQL descartável e Mailpit: **2 Playwright reais aprovados**. Cobriu 2FA, operações, PDF/CSV, limites distribuídos e reinício de JVM. O cenário administrativo testou provisionamento por `ROLE_ADMIN` sintético, entrega de convite via Mailpit, ativação, replay, login/2FA do SUPER_ADMIN, cinco telas administrativas e `/convite` em 320×568, 390×844, 768×1024, 1366×768 e 1920×1080, APIs administrativas, criação e edição de papel personalizado, proteção contra autodesativação, revogação de sessões, atribuição de papel, auditoria, operador e consulta sintéticos. O CI do novo SHA ainda deve ser conferido.

## Limites e pendências

- Os testes SMTP de falha usam um `EmailService` controlado no Spring com PostgreSQL real; Mailpit prova o caminho SMTP bem-sucedido. Falha permanente por resposta SMTP 5xx específica ainda precisa de classificação e teste com servidor que devolva 5xx. A classificação terminal cobre autenticação e parsing; demais falhas são limitadas a cinco tentativas.
- Testes de processo encerrado durante pendência e duas JVMs despachando a mesma linha ainda não foram executados; o teste de concorrência da outbox usa duas threads e transações distintas no mesmo processo. O ensaio de duas JVMs existente cobre o rate limiter, não a outbox.
- O painel administrativo real cobre smoke, acesso e algumas mutações. Busca/paginação, fluxos de formulários/modais, acessibilidade completa, erro de sessão expirada e toda a matriz de operações por papel ainda exigem roteiro adicional. O papel CONSULTA tem negativas de API; o operador não equivale à conta real da Geisa.
- Recuperação de senha sem login, inventário confiável de dispositivos, encerramento individual de sessões, filtros/retenção de auditoria e alertas administrativos seguem em entrega separada. A revogação atual invalida tokens de um usuário, sem inventário de dispositivos.
- O Neon original não foi aberto nesta etapa; projeto, branch, endpoint, TLS, backup/restauração, migrations pendentes no destino e acesso das contas reais são desconhecidos. Veja [plano de homologação](../neon-admin-readiness/stage3-2-homologation.md).

## Vereditos

| Item | Status | Evidência e limite |
|---|---|---|
| A3-03 | APROVADO | Outbox transacional V27, rollback, retry, criptografia, concorrência por lock e ambiguidade testados; condições de processo/JVM separadas permanecem no roteiro. |
| PROVISIONAMENTO SUPER_ADMIN | PARCIAL | Fluxo isolado com identidade sintética; sem conta real. |
| CONVITES | PARCIAL | Criação, entrega Mailpit, aceite e replay; cobertura SMTP 5xx e reinício pendente. |
| RBAC | PARCIAL | V26 preservada; negativas reais de API e papéis sintéticos, matriz completa pendente. |
| ACESSO OPERACIONAL DA GEISA | PENDENTE | Nenhuma autenticação ou alteração da conta real. |
| PAINEL ADMINISTRATIVO | PARCIAL | Cinco rotas reais e mutações selecionadas; acessibilidade e estados completos pendentes. |
| LOGIN E 2FA SINTÉTICOS | APROVADO | Mailpit e browser reais em banco isolado. |
| RECUPERAÇÃO DE SENHA | PENDENTE | Sem fluxo público seguro; requer entrega separada com outbox compatível. |
| SESSÕES | PARCIAL | Revogação geral por usuário; sem inventário de dispositivo. |
| FLYWAY | APROVADO | V27 em bancos novos e atualizados; checksums históricos preservados. |
| INTEGRIDADE | APROVADO | 867 relatórios de teste sem falhas e comparação de schema, sem escrita remota. |
| SEGURANÇA | PARCIAL | Token criptografado e apagado; matriz e SMTP 5xx pendentes. |
| PLAYWRIGHT REAL | PARCIAL | Stack isolado com rotas/admin selecionados; roteiro integral pendente. |
| BACKUP NEON | PENDENTE | Nenhum backup ou restauração comprovado nesta etapa. |
| CONEXÃO OPERACIONAL NEON | PENDENTE | Nenhuma conexão realizada. |
| LOGIN REAL SUPER_ADMIN | PENDENTE | Conta real não criada. |
| LOGIN REAL GEISA | PENDENTE | Conta real não utilizada. |
| PRONTIDÃO PARA HOMOLOGAÇÃO | PARCIAL | Plano preparado; critérios externos e testes restantes pendentes. |
| PRODUÇÃO | PENDENTE | Sem deploy ou autorização de produção. |
