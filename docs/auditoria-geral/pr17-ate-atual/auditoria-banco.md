# PostgreSQL, Flyway e integridade

Árvore candidata contém B24 e V1–V28; V25 (RBAC), V26 (CONSULTA), V27 (outbox de convites) e V28 (recuperação) vieram na cadeia #23–#27. Não existe V29 nesta candidata. `FlywayConfig` chama `migrate()` no startup, portanto **iniciar backend sobre o original é operação de escrita possível**. `AdminAccountBootstrap` também pode criar conta em banco vazio; `InviteOutbox`, `RefreshTokenCleanupScheduler`, `SharedRateLimitService` e `NotificacaoService` fazem trabalho de startup/agendado. `ConfiguracaoOficinaBootstrap` apenas valida.

O guard TEST_DB_* exige host loopback, porta esperada, nome `oficina_gestao_test`, credencial dedicada e manifesto de 28 migrations sintéticas com hashes fixos. A suíte atual usa PostgreSQL 16 novo em `127.0.0.1:5432`; não herdou DB_URL/credenciais operacionais. Testes `ProductionMigrationPathTest`, `SyntheticMigrationsTest`, constraints, baseline B24 e testes transacionais verificam cenários conhecidos. Os relatórios Stage 4A mostram 893 casos e caminhos V21/V24/B24/V25–V28. A execução desta branch está em [matriz-testes](matriz-testes.md).

| Invariante | Evidência disponível | Limite |
|---|---|---|
| Conta/role/token | FKs, índices e regras V25–V28; testes de sessão/replay e outbox | Dados legados do original não inspecionados |
| OS/estoque/financeiro | `OperationalCriticalFlowsIntegrationTest` lê estado após mutações, verifica baixa/estorno, total 85 e PDF | Carga concorrente e histórico real não ensaiados |
| Migração incremental | Flyway isolado cobre B24/V25–V28, checksums e ausência de `repair` automático | Restore de snapshot original ainda não existe |
| Retenção/outbox | Worker de duas JVMs e SMTP 550 testados no Stage 4A; ciphertext apagado após terminal | Entrega real e filas restauradas requerem isolamento de egress |

Não declarar compatibilidade de V1–V24 com o banco principal apenas por schemas sintéticos. Antes de qualquer janela, comparar `flyway_schema_history` do original em leitura aprovada, obter backup cifrado sob segunda autorização, restaurar em PostgreSQL isolado, conferir constraints, FKs, indexes, sequences, hashes de senha por igualdade booleana privada e históricos OS/estoque/financeiro. Ensaiar V25–V28 na cópia sem `repair`, `clean` ou `baseline`; comparar antes/depois e estimar locks/duração. O [runbook existente](../../admin-rbac/stage4a-neon-runbook.md) detalha comandos e pontos de parada.
