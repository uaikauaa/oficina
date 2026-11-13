# Etapa 4B — gate de identificação e diagnóstico Neon

Data: 13/11/2026 (America/Sao_Paulo). Referência funcional: PR #32,
`b9fda3fe853d4969bdb24ce4904c0ec99045f026`.

## Resultado desta execução

A ficha privada existente foi conferida apenas quanto à completude. Ela permanece
marcada como **NÃO CONFERIDO** e todos os campos oficiais estão vazios. Nenhum
valor foi inferido do `.env`, de containers antigos ou de hostnames históricos.
Não houve abertura do painel/API Neon, resolução de DNS, conexão PostgreSQL,
inicialização do Spring Boot, Flyway, backup ou mudança de permissões.

| Gate | Estado | Condição para avançar |
|---|---|---|
| Alvo confirmado | **NÃO** | Operador autorizado preencher organização, projeto, branch/tipo, compute/hostname direto e banco a partir do painel oficial |
| TLS | **PENDENTE** | Confirmar hostname direto, CA/truststore e validar o handshake `verify-full` somente após autorização específica |
| Role de leitura | **PENDENTE** | Confirmar role existente e grants efetivos de menor privilégio; provisionamento exige autorização separada |
| Autorização | **NÃO CONCEDIDA** | Apresentar solicitação completa com alvo, role, credencial, janela e SQL exato e receber aprovação explícita |
| Histórico Flyway | **PENDENTE** | Executar os SELECTs autorizados dentro de `REPEATABLE READ READ ONLY` |
| Integridade preliminar | **PENDENTE** | Obter apenas catálogo e contagens agregadas autorizadas e finalizar com `ROLLBACK` |
| Próximo gate de backup | **BLOQUEADO** | Diagnóstico autorizado e aprovado; backup continuará exigindo autorização distinta |

## Pacote preparado fora do Git

Foram preparados localmente, sem valores operacionais:

- roteiro para o operador conferir a ficha no painel oficial;
- template de `pg_service.conf` para conexão direta, `sslmode=verify-full`,
  CA aprovada, timeouts e `default_transaction_read_only=on`;
- SQL contendo os comandos da seção 3 do
  [runbook](stage4a-neon-runbook.md), em duas transações
  `REPEATABLE READ READ ONLY`, ambas encerradas por `ROLLBACK`;
- texto de solicitação específica com riscos, possível ativação/custo do compute
  e critérios de interrupção.

O futuro comando está limitado a
`psql -X --no-password --set=ON_ERROR_STOP=1 --dbname=service=neon_diag_aprovado`,
com senha apenas em `PGPASSFILE` privado protegido por ACL. O operador deverá
preencher os arquivos somente depois da conferência oficial. Não registrar
senha, hostname privado, IDs ou referência sensível da credencial no GitHub.

## Critérios de parada

Interromper antes ou durante a primeira sessão se a ficha estiver incompleta; a
role não existir ou tiver privilégios excessivos; identidade, branch, compute,
hostname, banco, TLS, CA ou janela divergirem; `transaction_read_only` não
retornar `on`; qualquer tabela esperada estiver ausente; ou qualquer comando
falhar. Não reparar, criar role, ampliar grants, iniciar aplicação ou executar
consulta adicional por inferência.

## Decisão

O procedimento está preparado, mas a solicitação específica ainda não pode ser
emitida com dados concretos. O responsável deve primeiro preencher a ficha
privada a partir do painel oficial. A aprovação genérica da Etapa 4B não autoriza
a primeira conexão. PR #32 permanece draft; merge, deploy, backup e migrations
reais continuam fora do escopo.
