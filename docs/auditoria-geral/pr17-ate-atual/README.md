# Auditoria geral retrospectiva — PRs #17–#30

Data: 12/11/2026. Candidata: PR #30, SHA `fc1560ab07840adfe9d47515b701de809fc6a803`; branch isolada `audit/admin-stage4a1`, base no #30. Nenhum Neon original, conta real, e-mail real, merge, deploy ou serviço Cloud foi alterado.

## Decisão executiva

A cadeia funcional é testável e os dois riscos de segurança identificados nesta revisão foram tratados: JWT sem sessão é proibido em produção e a solicitação pública de recuperação retorna 503 até mitigação temporal validada. O container antigo e a configuração privada permanecem inadequados para ativação. **NO-GO para produção e qualquer migration ou escrita no original.**

> Evidência desta auditoria distingue código/testes observados, evidência anterior revalidada por artefato, configuração declarada e estado remoto não verificado. Aprovação sintética não autoriza operação real.

## Vereditos por área

| Área | Veredito | Evidência / limite |
|---|---|---|
| HISTÓRICO PR #17–ATUAL | **APROVADO** | 14 PRs inventariados; SHAs, branches, arquivos, checks e matriz por arquivo |
| INTEGRIDADE DOS MERGES E REVERSÕES | **APROVADO** | main pós-#19 igual à árvore pré-#17; #18/#26 paralelos |
| SEGURANÇA BACKEND | **PARCIAL** | JWT fixado; REC-01 bloqueado; IDOR/carga ampliados pendentes |
| SEGURANÇA FRONTEND | **PARCIAL** | proxy/CSRF/cookies revistos; validação efetiva do alvo pendente |
| AUTENTICAÇÃO | **PARCIAL** | login/2FA/refresh sintéticos; nenhum titular real |
| JWT E SESSÕES | **APROVADO** | sessionId explícito, revogação/replay e guard prod; testes isolados |
| 2FA | **APROVADO** | desafio/replay/expiração e stack Mailpit sintética |
| RECUPERAÇÃO DE SENHA | **PARCIAL** | solicitação pública bloqueada em prod; mitigação durável pendente |
| RBAC | **PARCIAL** | matriz e mutações principais; cobertura IDOR exaustiva pendente |
| SUPER_ADMIN SINTÉTICO | **APROVADO** | administração e operações em PostgreSQL descartável |
| OPERADOR_GERAL SINTÉTICO | **APROVADO** | OS/estoque/financeiro/exports e paridade V25 |
| DEMAIS PAPÉIS | **PARCIAL** | operações válidas/negativas representativas |
| GESTÃO DE USUÁRIOS | **PARCIAL** | fluxos sintéticos; contas reais não tocadas |
| CONVITES | **PARCIAL** | aceite/outbox/SMTP sintéticos; entrega real pendente |
| OUTBOX | **APROVADO** | AES-GCM, restart duas JVMs e SMTP 550 em ambiente isolado |
| AUDITORIA ADMINISTRATIVA | **PARCIAL** | eventos sintéticos; retenção real não verificada |
| PAINEL ADMINISTRATIVO | **PARCIAL** | 3 jornadas reais Stage 4A e 115 mocks; bugs locais tratados |
| CLIENTES | **PARCIAL** | criação/edição/inativação verificadas; histórico real pendente |
| MÁQUINAS | **PARCIAL** | cadastro e vínculo sintético; dados reais pendentes |
| PRODUTOS E PEÇAS | **PARCIAL** | cadastro/baixa sintéticos; concorrência ampla pendente |
| ESTOQUE | **PARCIAL** | baixa/estorno e saldos sintéticos; carga e histórico pendentes |
| ORDENS DE SERVIÇO | **PARCIAL** | conclusão/cancelamento/estorno/total sintéticos |
| FINANCEIRO | **PARCIAL** | total OS 85 e relatório sintéticos; conciliação real pendente |
| RELATÓRIOS | **PARCIAL** | leitura/autorizações sintéticas; dados reais pendentes |
| PDF/CSV | **PARCIAL** | PDF assinatura e CSV sintético; neutralização geral revisar |
| POSTGRESQL | **PARCIAL** | PostgreSQL 16 descartável; original não acessado |
| FLYWAY | **PARCIAL** | B24/V1–V28 em cópia sintética; restore original pendente |
| INTEGRIDADE DOS DADOS | **PARCIAL** | constraints/testes sintéticos; nenhum snapshot original |
| INFRAESTRUTURA | **PENDENTE** | container preexistente divergente; Cloud Run não validado |
| TLS | **PENDENTE** | verify-full declarado em .env, ausente no container antigo; alvo não validado |
| CLOUD RUN | **PENDENTE** | IAM/custos/serviço efetivo não inspecionados |
| CONFIGURAÇÃO PRIVADA | **PENDENTE** | presença inventariada; outbox/URL/profile/cookie/CORS a fechar |
| SEGREDOS | **PARCIAL** | Gitleaks histórico/Trivy CI #30 verdes; rotação não atestada |
| DEPENDÊNCIAS | **PARCIAL** | npm prod 0; 7 moderadas dev; SBOM/Trivy CI #30 |
| DESEMPENHO | **PARCIAL** | timing recuper. medido no serviço; HTTP/carga ainda não |
| RESPONSIVIDADE | **APROVADO** | 5 viewports em Playwright mockado |
| ACESSIBILIDADE | **PARCIAL** | teclado/foco básicos; leitor de tela não medido |
| TESTES AUTOMATIZADOS | **APROVADO** | Maven 897 XML, frontend 379, build/lint/tipos |
| TESTES REAIS ISOLADOS | **APROVADO** | 3 Playwright reais e duas JVMs passaram nesta branch; sem dados reais |
| CI/CD | **PENDENTE** | SHA final desta branch ainda precisa 4 workflows |
| GOVERNANÇA CODEX | **PARCIAL** | AGENTS revisados; PR #26 paralelo com check falho |
| PRONTIDÃO PARA DIAGNÓSTICO NEON | **PARCIAL** | runbook pronto; alvo/credencial/autorização específicos pendentes |
| PRONTIDÃO PARA MIGRATIONS REAIS | **REPROVADO** | sem backup/restore/dados legados/ensaio |
| PRONTIDÃO PARA PROVISIONAMENTO REAL | **PENDENTE** | convite/2FA planejados; nenhum usuário real |
| PRONTIDÃO PARA PRODUÇÃO | **REPROVADO** | REC-01 bloqueado, config/TLS/restore e ativação pendentes |

## Decisões independentes

1. **Auditoria técnica:** GO condicionado aos 4 workflows do SHA final; bloqueios residuais estão formalizados em `achados-e-correcoes.md`.
2. **Solicitar autorização de diagnóstico read-only Neon:** GO para **pedir** autorização específica, após preencher alvo/role/credencial privados; nenhuma conexão autorizada por este relatório.
3. **Preparar janela futura de alteração:** NO-GO até diagnóstico, backup cifrado restaurado, V25–V28 ensaiadas e configuração efetiva corrigida.
4. **Produção:** NO-GO. Recuperação pública está bloqueada, e configuração/TLS/contas reais/rollback exigem gates próprios.

## Anexos e evidências

- [Histórico individual e checks](historico-prs.md), [inventário estruturado](inventario-prs.json), [checks por SHA](checks-prs.json) e [matriz de 324 entradas de arquivo](matriz-rastreabilidade.md).
- [Segurança](auditoria-seguranca.md), [RBAC](auditoria-rbac.md), [banco](auditoria-banco.md), [frontend](auditoria-frontend.md), [infraestrutura](auditoria-infraestrutura.md) e [qualidade](auditoria-qualidade.md).
- [Testes e falhas intermediárias](matriz-testes.md), [achados/correções](achados-e-correcoes.md), [próximo gate Neon](readiness-neon.md).
- [Relatório Stage 4A](../../admin-rbac/stage4a-prehomologation.md) e [runbook Neon](../../admin-rbac/stage4a-neon-runbook.md), usados como contexto e confrontados com código/histórico; não são prova única.
