#!/usr/bin/env bash
# Builds a throwaway local Postgres with the app's real schema (all of
# supabase/migrations), then loads the scenario's demo data. Idempotent: wipes and
# recreates the cluster each time. Never connects to production.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PGDIR=${SUDS_PGDIR:-/var/lib/sudspg}
PGBIN=$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)
PORT=54322
if ! ls /usr/share/postgresql/*/extension/postgis.control >/dev/null 2>&1; then
  (apt-get install -y -qq postgresql-16-postgis-3 || (apt-get update -qq && apt-get install -y -qq postgresql-16-postgis-3)) >/dev/null
fi
su postgres -c "$PGBIN/pg_ctl -D $PGDIR/data stop -m fast" >/dev/null 2>&1 || true
rm -rf "$PGDIR"; mkdir -p "$PGDIR"; chown postgres "$PGDIR"
su postgres -c "$PGBIN/initdb -D $PGDIR/data -A trust -U postgres" >/dev/null
su postgres -c "$PGBIN/pg_ctl -D $PGDIR/data -o '-p $PORT -k $PGDIR -c listen_addresses=127.0.0.1' -l $PGDIR/log -w start" >/dev/null
export PGOPTIONS="-c client_min_messages=warning"
PSQL="psql -h $PGDIR -p $PORT -U postgres -q -v ON_ERROR_STOP=1"
$PSQL -f "$ROOT/social/backend/shim.sql" 2>/dev/null
for f in $(ls "$ROOT"/supabase/migrations/*.sql | grep -v combined.sql | sort); do
  # pg_cron / pg_net are Supabase-hosted extensions; the shim provides no-op stand-ins.
  sed -E '/CREATE EXTENSION IF NOT EXISTS (pg_cron|pg_net)/d' "$f" | $PSQL -o /dev/null -f - 2>&1 | grep -v -E "NOTICE|WARNING|HINT|DETAIL|^$" || true
done
# Demo data: this run's scenario (social/out/scenario.json, from scenario.py new), else the default one.
{ python3 "$ROOT/social/backend/media_lib.py"; python3 "$ROOT/social/backend/scenario.py" sql; } | $PSQL -o /dev/null -f -
# Tell a running PostgREST to re-read the rebuilt schema.
$PSQL -c "NOTIFY pgrst, 'reload schema'"
echo "db ready on 127.0.0.1:$PORT"
