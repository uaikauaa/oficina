# Procedimentos de Backup e Recuperação de Desastres — Oficina Gestão

Este documento estabelece as rotinas operacionais oficiais para realização de **backup**, **verificação de integridade** e **restauração de dados (restore)** do banco de dados PostgreSQL Neon da aplicação **Oficina Gestão**.

---

## 1. Estratégia de Proteção de Dados

A arquitetura adota duas camadas complementares de proteção:

1. **Nível de Plataforma (Neon Serverless PITR & Snapshots)**:
   - O Neon grava o log contínuo de transações (*Write-Ahead Logging* / WAL).
   - Permite **Point-in-Time Recovery (PITR)** para restauração a qualquer segundo dos últimos 7 a 30 dias (conforme o plano Neon).
   - Permite a criação instantânea de **Snapshots** e branches de backup sem impacto de I/O na produção.
2. **Nível Lógico Operacional (`pg_dump`)**:
   - Geração periódica de despejo SQL completo (`.sql` ou formato custom `.dump`), independente de nuvem ou fornecedor.
   - Permite migração ou restauração em qualquer PostgreSQL local ou gerenciado.

---

## 2. Procedimento de Backup Lógico via `pg_dump`

### 2.1. Execução Manual de Backup
Para gerar uma cópia de segurança completa do banco de produção em um arquivo comprimido:

```bash
# Definir a connection string de produção (sem expor em logs)
export DATABASE_URL="postgresql://neondb_owner:SENHA@ep-prod.neon.tech/neondb?sslmode=require"

# Gerar arquivo de dump com timestamp
DATA_BACKUP=$(date +"%Y%m%d_%H%M%S")
pg_dump "$DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="backup_oficina_${DATA_BACKUP}.dump"

# Verificar o tamanho do arquivo gerado
ls -lh "backup_oficina_${DATA_BACKUP}.dump"
```

> **No Windows PowerShell**:
> ```powershell
> $data = Get-Date -Format "yyyyMMdd_HHmmss"
> pg_dump "postgresql://neondb_owner:SENHA@ep-prod.neon.tech/neondb?sslmode=require" --format=custom --no-owner --no-privileges --file="backup_oficina_$data.dump"
> ```

---

## 3. Procedimento de Restauração de Desastre (Restore)

> [!CAUTION]
> A restauração substitui dados existentes no banco de destino. **Nunca execute uma restauração diretamente sobre o banco de produção sem antes validar em uma base temporária.**

### 3.1. Restauração via Console Neon (Point-in-Time Recovery - Recomendado)
1. Acesse o painel do projeto no [Neon](https://console.neon.tech).
2. Vá em **Branches** e clique em **Create Branch**.
3. Selecione a opção **Time travel / Point in time**.
4. Defina a data e o horário exato anterior ao incidente (ex: antes de uma exclusão acidental).
5. Nomeie a nova branch como `production-restored-[DATA]`.
6. Valide a integridade dos dados na nova branch.
7. Altere a connection string do backend para apontar para a branch restaurada ou promova a branch para padrão.

### 3.2. Restauração Lógica via `pg_restore`
Caso seja necessário restaurar a partir de um arquivo `.dump` gerado por `pg_dump`:

```bash
# 1. Criar um banco de dados limpo para receber a restauração
createdb -h ep-prod.neon.tech -U neondb_owner oficina_recuperada

# 2. Executar o restore a partir do arquivo
pg_restore \
  --dbname="postgresql://neondb_owner:SENHA@ep-prod.neon.tech/oficina_recuperada?sslmode=require" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  "backup_oficina_20260916_120000.dump"
```

---

## 4. Checklist de Validação de Integridade Pós-Restore

Após qualquer procedimento de restauração, execute a seguinte validação antes de liberar o sistema para a oficina:

1. **Validação do Flyway**:
   Verificar se todas as migrações `V1` até `V9` constam na tabela `flyway_schema_history`:
   ```sql
   SELECT version, description, success FROM flyway_schema_history ORDER BY installed_rank;
   ```
2. **Integridade de Clientes e Equipamentos**:
   ```sql
   SELECT count(*) FROM clientes;
   SELECT count(*) FROM maquinas;
   ```
3. **Integridade de Estoque e Saldo**:
   Garantir que nenhum produto ficou com saldo negativo:
   ```sql
   SELECT id, codigo, nome, estoque_atual FROM produtos WHERE estoque_atual < 0;
   -- Deve retornar 0 linhas
   ```
4. **Integridade de Ordens de Serviço**:
   ```sql
   SELECT status, count(*) FROM ordens_servico GROUP BY status;
   ```
5. **Sequência de Numeração de OS**:
   Verificar se a sequence `ordens_servico_seq` está sincronizada com a última OS cadastrada.
