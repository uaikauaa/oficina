#!/usr/bin/env bash
# Oficina Gestao: backup criptografado off-site usando conexao direta ao Neon.
# Requer cliente PostgreSQL >= versao do Neon, age e AWS CLI.
set -Eeuo pipefail
umask 077
ENV_FILE="${BACKUP_ENV_FILE:-/etc/oficina/backup.env}"
if [[ ! -r "$ENV_FILE" ]]; then echo "ERRO: backup.env privado ausente" >&2; exit 1; fi
# Arquivo controlado pelo operador (root:oficina-backup 0640).
# shellcheck disable=SC1090
source "$ENV_FILE"
for name in BACKUP_DB_HOST BACKUP_DB_NAME BACKUP_DB_USER BACKUP_DB_PASSWORD BACKUP_AGE_RECIPIENT BACKUP_BUCKET BACKUP_S3_ENDPOINT AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY; do
  if [[ -z "${!name:-}" ]]; then echo "ERRO: $name nao configurado" >&2; exit 1; fi
done
for binary in pg_dump pg_restore age aws; do
  command -v "$binary" >/dev/null || { echo "ERRO: dependencia ausente: $binary" >&2; exit 1; }
done
if [[ "$BACKUP_DB_HOST" == *-pooler* ]]; then
  echo "ERRO: usar URL direta do Neon, nunca pooler para pg_dump" >&2; exit 1
fi
if [[ "$BACKUP_S3_ENDPOINT" != https://* ]]; then
  echo "ERRO: endpoint S3 deve usar HTTPS" >&2; exit 1
fi
export PGHOST="$BACKUP_DB_HOST" PGPORT="${BACKUP_DB_PORT:-5432}"
export PGDATABASE="$BACKUP_DB_NAME" PGUSER="$BACKUP_DB_USER"
export PGPASSWORD="$BACKUP_DB_PASSWORD" PGSSLMODE=verify-full
tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
filename="oficina_$stamp.dump.age"
plain="$tmpdir/export.dump"
cipher="$tmpdir/$filename"
key="${BACKUP_PREFIX:-oficina-production}/$filename"
pg_dump --format=custom --no-owner --no-privileges --file="$plain"
pg_restore --list "$plain" >/dev/null
age -r "$BACKUP_AGE_RECIPIENT" -o "$cipher" "$plain"
test -s "$cipher"
aws --endpoint-url "$BACKUP_S3_ENDPOINT" s3 cp "$cipher" "s3://$BACKUP_BUCKET/$key" --only-show-errors
remote_size="$(aws --endpoint-url "$BACKUP_S3_ENDPOINT" s3api head-object --bucket "$BACKUP_BUCKET" --key "$key" --query ContentLength --output text)"
[[ "$remote_size" =~ ^[0-9]+$ ]] && ((remote_size > 1000)) || {
  echo "ERRO: objeto off-site ausente ou vazio" >&2; exit 1
}
echo "BACKUP_OK bucket=$BACKUP_BUCKET key=$key size=$remote_size"
echo "AVISO: restaure um backup em banco isolado para comprovar recuperacao."
