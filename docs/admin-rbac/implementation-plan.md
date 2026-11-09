# Etapa 2 — plano de execução isolada

Base: PR #22, `ada7332e5fc6a93df712b6505ebdf1af421828a4`. PRs #21 e #22 abertos em 9/11/2026, oito checks verdes no head de cada um. Branch de trabalho: `feat/admin-rbac-users-infrastructure`; PR da etapa deve apontar para `chore/neon-connection-admin-readiness-audit` enquanto #22 estiver aberto.

## Componentes e ordem

1. **Base de dados e autorização:** V25 incremental para catálogo de permissões, relação role-permissão, papéis delegados e eventos administrativos; preservar V1–V24 e B24. Mapear as 83 combinações da matriz para permissões por método e rota. Carregar roles e permissões efetivas do banco após validar a versão do token, sem confiar nas claims de roles. Negar rotas desconhecidas.
2. **Administração:** serviço transacional para usuários e papéis, bloqueio do último SUPER_ADMIN, proteção contra autodesativação e escalonamento, revogação de refresh tokens e incremento de `token_version`, auditoria com ator/alvo/motivo.
3. **Provisionamento:** convite de uso único, expiração, verificação de e-mail, senha forte e 2FA obrigatório; nenhum papel SUPER_ADMIN controlado por endpoint público. Testes com identidades sintéticas.
4. **Interface:** rotas administrativas protegidas por capacidades retornadas pelo backend, gestão de usuários, papéis, sessões, auditoria e infraestrutura; manter autorização no servidor.
5. **Infraestrutura:** métricas verificáveis pelo backend, cache/TTL e indisponibilidade explícita para Neon e Google Cloud; nenhuma API paga habilitada automaticamente.
6. **Validação:** PostgreSQL descartável e SMTP sintético; Flyway em banco novo e atualizado; regressão Java/TypeScript/lint/build/Playwright; testes positivos e negativos por papel, token antigo e objeto. Auditoria final da matriz e relatório de achados.

## Gates e riscos

- O `.env` raiz é privado e ignorado por `*.env`; nunca versionar valores. O processo Spring deve receber `SPRING_PROFILES_ACTIVE` **antes** de iniciar; o Next.js deve receber `INTERNAL_BACKEND_URL` no próprio ambiente.
- O destino do banco ativo deve ser observado no processo, não inferido apenas de arquivos. Preservar os serviços locais em execução.
- Testes só podem usar destino local descartável aprovado pelo guard; nenhum teste com credenciais do Neon original.
- Flyway, bootstrap, sincronização de notificações e schedulers escrevem durante startup. Não iniciar backend completo no Neon original nesta etapa.
- Antes de ativação posterior: confirmar projeto/branch/endpoints no console Neon, comprovar e restaurar backup isolado, rotacionar segredos expostos, ensaiar migration/provisionamento/transição/rollback e obter autorização específica. Geisa permanece com `ROLE_ADMIN` no banco original até essas condições serem cumpridas.
- Produção, merge, deploy e mutações no Neon original permanecem **NO-GO**.
