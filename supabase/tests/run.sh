#!/bin/bash
# Applies every migration to a scratch database on a local Postgres (with
# PostGIS) and runs the SQL tests. Needs a superuser connection, e.g.:
#   PGHOST=/var/run/postgresql PGUSER=postgres supabase/tests/run.sh
# pg_cron and pg_net aren't installed locally: their CREATE EXTENSION lines are
# skipped and supabase_stub.sql stubs the functions the migrations call.
set -euo pipefail
cd "$(dirname "$0")/.."
DB=${TEST_DB:-suds_test}
psql -q -d postgres -c "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB"
psql -q -d "$DB" -c 'ALTER DATABASE '"$DB"' SET search_path = "$user", public, extensions'
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f tests/supabase_stub.sql 2>&1 | grep -v "wal_level\|HINT" || true
failed=0
for f in migrations/[0-9]*.sql; do
  if ! sed -E "s/^CREATE EXTENSION IF NOT EXISTS (pg_cron|pg_net).*//" "$f" \
      | psql -q -v ON_ERROR_STOP=1 -1 -d "$DB" -f - >/dev/null 2>/tmp/suds_migration_err; then
    echo "FAILED: $f"; cat /tmp/suds_migration_err; failed=1
  fi
done
[ "$failed" = 0 ] && echo "All migrations applied."
for t in tests/*.test.sql; do
  echo "== $t"
  psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$t" 2>&1 | grep -i "error\|assert\|passed" || true
done
