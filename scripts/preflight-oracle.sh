#!/usr/bin/env bash
# Validacao nao destrutiva antes de subir a stack real e aplicar Flyway.
set -Eeuo pipefail
umask 077
env_file="${1:-.env.production}"
tls_dir="${2:-secrets/nginx}"
test -r "$env_file" || { echo "ERRO: .env.production ausente" >&2; exit 1; }
test -r "$tls_dir/origin.pem" || { echo "ERRO: certificado TLS ausente" >&2; exit 1; }
test -r "$tls_dir/origin.key" || { echo "ERRO: chave TLS inacessivel" >&2; exit 1; }
if grep -E '(CHANGE_ME|example\.invalid)' "$env_file" >/dev/null; then
  echo "ERRO: existem placeholders em producao" >&2; exit 1
fi
openssl x509 -in "$tls_dir/origin.pem" -noout -checkend 86400 >/dev/null || {
  echo "ERRO: certificado expirado ou expira em menos de 24h" >&2; exit 1;
}
openssl pkey -in "$tls_dir/origin.key" -noout >/dev/null 2>&1 || {
  echo "ERRO: chave TLS invalida" >&2; exit 1;
}
cmp -s \
  <(openssl x509 -in "$tls_dir/origin.pem" -pubkey -noout) \
  <(openssl pkey -in "$tls_dir/origin.key" -pubout) || {
    echo "ERRO: certificado e chave nao correspondem" >&2; exit 1;
  }
if find "$tls_dir/origin.key" -perm /o+r -print -quit | grep -q .; then
  echo "ERRO: chave privada publica para outros usuarios" >&2; exit 1
fi
docker compose --env-file "$env_file" config --quiet
echo "PREFLIGHT_OK: TLS e Compose localmente validos."
echo "Pendente: cert hostname, DNS/Full strict, backup restauravel, firewall, health e smoke externos."
