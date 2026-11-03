# Auditoria final — Oficina Gestão

**DECISÃO: NO-GO para produção em 30/10/2026.** O código recebeu correções e passou por testes locais, mas não há evidência de implantação homologada entre os dois Cloud Run, TLS com Neon, configuração IAM, proteção distribuída contra abuso ou restauração do banco real. Esses requisitos são mandatórios no prompt; testes locais não os substituem.

## Escopo e rastreabilidade

- Repositório: [uaikauaa/oficina](https://github.com/uaikauaa/oficina).
- `main` analisada: `8130fb7914c0030c0d374dd0e1d87f28b83ddac2`.
- [PR #10](https://github.com/uaikauaa/oficina/pull/10): aberto, draft, **não integrado**, head `a788f6372dfa1b8e0dceeaaa3212e5e5f0ab82de`. Suas três alterações são o ARG de build no Dockerfile frontend, Cloud Build e guia de implantação.
- Correções em branch separada `audit/seguranca-cloud-run-20261030`, baseada no head do PR #10. O PR de auditoria é empilhado sobre essa branch, preservando a revisão independente do PR original.
- Somente recursos locais descartáveis, PostgreSQL sintético, SMTP Mailpit e contas `*.invalid`. Não houve conexão ao Neon, teste contra domínio de produção, deploy, merge ou alteração de IAM.
- Worktree separado do diretório original. Imagens e demais arquivos não rastreados do usuário não fazem parte da entrega.

## Resultado executivo

Foram reproduzidos cinco cenários de falha na autenticação: refresh descendente sobrevivendo ao logout com cookie antigo; corrida refresh/logout; desafio 2FA sobrevivendo à troca de senha; emissão de sessão para conta desativada; e novos logins contornando o cooldown de envio de e-mail. A conta desativada continuava bloqueada pelo filtro da API: não foi demonstrado acesso a dados nessa condição.

As correções serializam operações por conta, revogam refresh e desafios pendentes, revalidam o estado da conta e aplicam limites persistentes de envio. Também foram corrigidos transporte SMTP permissivo, registro de detalhes sensíveis de exceções, composição de nomes de PDFs e entrada livre de ordenação no Spring Data. Dependências foram atualizadas com testes de compatibilidade, preservando Java 21, Spring Boot 3.4 e Spring Security 6.4.

A cobertura de autorização percorre os **83 pares método/rota** realmente registrados na API, incluindo aliases. A matriz também classifica páginas, handlers, arquivos estáticos, rotas internas Next, Actuator, documentação e fallback de erros. O domínio é uma oficina compartilhada entre ADMIN, sem modelo multitenant; os vínculos de recursos continuam validados no backend.

O fluxo Chromium → Next standalone → Spring Boot → PostgreSQL → Mailpit passou com 2FA, cookies, CSRF, cadastros, estoque, OS, três PDFs e logout. Foram exercitados SQLi limitada, texto HTML armazenado, campos extras no JSON, preço calculado no servidor e exclusão de item sob uma OS diferente. Isso não equivale a provar ausência de todas as variantes dessas classes de ataque.

## Entregáveis

| Entrega exigida | Artefato |
|---|---|
| A. Relatório executivo | Este documento |
| B. Matriz completa de rotas | [matriz-rotas.md](matriz-rotas.md), [rotas-api.json](rotas-api.json) |
| C. Vulnerabilidades, impacto e regressões | [vulnerabilidades.md](vulnerabilidades.md) |
| D. Cloud Run e riscos operacionais | [cloud-run.md](cloud-run.md) |
| E. Comandos, resultados e limitações | [testes.md](testes.md), [evidencias.json](evidencias.json) |
| F. Correções para revisão | [PR #11](https://github.com/uaikauaa/oficina/pull/11), separado e draft, sem merge automático |
| G. Sequência de implantação | [checklist-implantacao.md](checklist-implantacao.md) |
| H. Veredito | **NO-GO**; condições abaixo e checklist |
| Linguagens, versões e dependências | [stack.md](stack.md), [dependencias.json](dependencias.json) |

## Condições de liberação

Antes de mudar o veredito, exigir evidências de homologação HTTPS dos dois serviços, SMTP com TLS obrigatório, Neon com identidade do servidor validada, ensaio de suspensão/reconexão e restauração, revisão IAM/Secret Manager/OIDC, limites de consumo e aprovação dos riscos residuais. Os alertas remanescentes do ecossistema Spring precisam de aceite técnico documentado das condições de não aplicabilidade/mitigação ou migração para uma linha com correções disponíveis.

O repositório está mais protegido do que a base auditada. Não se declara segurança absoluta nem aprovação irrestrita para tráfego real.

Referências metodológicas: [OWASP ASVS](https://asvs.owasp.org/), [OWASP API Security Top 10](https://owasp.org/API-Security/editions/2023/en/0x00-header/). A avaliação usou requisitos relevantes; não é certificação integral ASVS.
