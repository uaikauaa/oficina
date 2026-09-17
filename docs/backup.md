# Procedimentos de Backup e Recuperação de Desastres — Oficina Gestão

Este documento estabelece as rotinas operacionais oficiais para realização de **backup**, **backup off-site**, **verificação de integridade** e **restauração de dados (restore)** do banco de dados PostgreSQL Neon da aplicação **Oficina Gestão**.

---

## 1. Estratégia de Proteção de Dados e Backup Off-Site (PROD001-05)

A arquitetura adota quatro camadas complementares de salvaguarda de dados:

1. **Snapshots de Liberação (Neon Serverless)**:
   - Snapshot criado na homologação da Release 1.0.0 e marcos de liberação:
     - Permite restauração instantânea do banco para o estado virgem e homologado a qualquer instante.
2. **Nível de Plataforma (Neon Point-in-Time Recovery - PITR)**:
   - O Neon grava o log contínuo de transações (*Write-Ahead Logging* / WAL).
   - Permite restauração a qualquer segundo dos últimos 7 a 30 dias.
   - Criação instantânea de branches de recuperação sem downtime na produção.
3. **Backup Off-Site Criptografado (Nuvem Externa)**:
   - **Frequência**: Diária às 02:00 da madrugada (horário de menor tráfego da oficina) + Pré-deploy de novas versões.
   - **Destino**: Bucket externo isolado (ex: Cloudflare R2, AWS S3 ou Google Cloud Storage) em região geograficamente distinta do Neon.
   - **Retenção**:
     - Diários: 14 dias
     - Semanais (domingos): 8 semanas (2 meses)
     - Mensais (1º dia do mês): 12 meses (1 ano)
   - **Criptografia**: AES-256 (GPG com chave assimétrica ou SSE no bucket com KMS gerenciado).
   - **Controle de Acesso**: Menor privilégio via IAM. O agente de backup possui permissão apenas de gravação (`PutObject`), sem permissão de deleção direta.
   - **Nomenclatura Padrão**: `oficina_prod_YYYYMMDD_HHMMSS.dump.gz`
   - **Responsável**: Administrador de TI / Responsável Técnico.
   - **Teste Periódico de Restore**: Simulado trimestralmente em base temporária de homologação.
4. **Nível Lógico Operacional (`pg_dump`)**:
   - Geração periódica de despejo SQL completo (`.sql` ou `.dump`), independente de nuvem ou fornecedor.
   - Permite portabilidade ou migração para instâncias PostgreSQL locais ou gerenciadas.

---

## 2. Procedimento de Backup Lógico via `pg_dump`

### 2.1. Execução Manual de Backup
Para gerar uma cópia de segurança completa do banco de produção em um arquivo comprimido:

```bash
# Definir a connection string de produção
export DATABASE_URL="postgresql://neondb_owner:SENHA@ep-proud-field-ac7s6w1q-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require"

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
> pg_dump "postgresql://neondb_owner:SENHA@ep-proud-field-ac7s6w1q-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require" --format=custom --no-owner --no-privileges --file="backup_oficina_$data.dump"
> ```

---

## 3. Procedimento de Restauração de Desastre (Restore)

> [!CAUTION]
> A restauração substitui ou redefine dados existentes no banco de destino. **Nunca execute uma restauração diretamente sobre o banco de produção sem antes validar em uma base temporária.**

### 3.1. Restauração a partir do Snapshot Pré-Release (Neon)
Caso seja necessário redefinir a base de produção para o estado pré-release homologado:
1. Acesse o painel do projeto no [Neon](https://console.neon.tech).
2. Vá em **Snapshots** e selecione `snapshot-pre-release-1-0-0` (`snap-spring-thunder-acvzytef`).
3. Clique em **Create branch from snapshot**.
4. Nomeie a nova branch (ex: `production-clean-restore`).
5. Aponte a aplicação para o endpoint da nova branch ou torne-a a branch default.

### 3.2. Restauração via Console Neon (Point-in-Time Recovery - PITR)
1. Acesse o painel do projeto no [Neon](https://console.neon.tech).
2. Vá em **Branches** e clique em **Create Branch**.
3. Selecione a opção **Time travel / Point in time**.
4. Defina a data e o horário exato anterior ao incidente (ex: antes de uma exclusão acidental).
5. Nomeie a nova branch como `production-restored-[DATA]`.
6. Valide a integridade dos dados na nova branch.
7. Altere a connection string do backend para apontar para a branch restaurada ou promova a branch para padrão.

### 3.3. Restauração Lógica via `pg_restore`
Caso seja necessário restaurar a partir de um arquivo `.dump` gerado por `pg_dump`:

```bash
# 1. Criar um banco de dados limpo para receber a restauração
createdb -h ep-proud-field-ac7s6w1q.sa-east-1.aws.neon.tech -U neondb_owner oficina_recuperada

# 2. Executar o restore a partir do arquivo
pg_restore \
  --dbname="postgresql://neondb_owner:SENHA@ep-proud-field-ac7s6w1q.sa-east-1.aws.neon.tech/oficina_recuperada?sslmode=require" \
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
   Verificar se todas as migrações `V1` até `V9` constam na tabela `flyway_schema_history` com `success = true`:
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
   ```
4. **Verificação de Ordens de Serviço**:
   ```sql
   SELECT status, count(*) FROM ordens_servico GROUP BY status;
   ```
