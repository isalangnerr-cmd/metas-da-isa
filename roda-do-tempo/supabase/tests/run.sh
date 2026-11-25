#!/usr/bin/env bash
# Roda a migração + testes de segurança num Postgres local descartável.
# Uso: PGPORT=5433 PGHOST=/tmp supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB=rdt_test_$$
createdb -U postgres "$DB"
trap 'dropdb -U postgres "$DB"' EXIT
psql -U postgres -d "$DB" -q -v ON_ERROR_STOP=1 -f tests/00_supabase_stub.sql
psql -U postgres -d "$DB" -q -v ON_ERROR_STOP=1 -f migrations/0001_roda_do_tempo.sql -f migrations/0001b_endurecimento.sql -f migrations/0001c_permissoes.sql
psql -U postgres -d "$DB" -q -v ON_ERROR_STOP=1 -f tests/rls_test.sql
