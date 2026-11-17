#!/usr/bin/env bash
# Starts the whole local demo stack: Postgres (fresh + seeded), PostgREST,
# the gateway on :54321 and the Expo web app on :8081 pointed at it.
# Prints nothing but progress; logs go to $LOGDIR.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
B="$ROOT/social/backend"
LOGDIR=${LOGDIR:-/tmp/suds-stack}; mkdir -p "$LOGDIR"
PGRST_BIN=${PGRST_BIN:-/opt/suds-tools/postgrest}
if [ ! -x "$PGRST_BIN" ]; then
  mkdir -p "$(dirname "$PGRST_BIN")"
  curl -sSL https://github.com/PostgREST/postgrest/releases/download/v12.2.3/postgrest-v12.2.3-linux-static-x64.tar.xz \
    -o /tmp/pgrst.tar.xz
  echo "9f71269e61ac3a940281e93ff415760f5957e430e475ba4c3889f3ede7d5527c  /tmp/pgrst.tar.xz" | sha256sum -c --quiet
  tar xf /tmp/pgrst.tar.xz -C "$(dirname "$PGRST_BIN")"
fi
[ -d "$ROOT/node_modules" ] || (cd "$ROOT" && npm ci --no-audit --no-fund >"$LOGDIR/npm.log" 2>&1)
pkill -f "postgrest $B" 2>/dev/null || true; pkill -f "node $B/gateway.js" 2>/dev/null || true
"$B/setup-db.sh"
SECRET=$(cd "$B" && node -e "console.log(require('./tokens').SECRET)")
cat > "$LOGDIR/postgrest.conf" <<CONF
db-uri = "postgres://authenticator@127.0.0.1:54322/postgres"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$SECRET"
server-port = 3000
CONF
setsid nohup "$PGRST_BIN" "$LOGDIR/postgrest.conf" >"$LOGDIR/postgrest.log" 2>&1 </dev/null &
setsid nohup node "$B/gateway.js" >"$LOGDIR/gateway.log" 2>&1 </dev/null &
if ! curl -s -o /dev/null localhost:8081; then
  ANON=$(cd "$B" && node tokens.js anon)
  (cd "$ROOT" && EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 EXPO_PUBLIC_SUPABASE_ANON_KEY="$ANON" CI=1 \
    setsid nohup npx expo start --web --port 8081 >"$LOGDIR/expo.log" 2>&1 </dev/null &)
fi
for i in $(seq 1 120); do curl -s -o /dev/null localhost:8081 && curl -s -o /dev/null localhost:3000 && break; sleep 2; done
curl -s -o /dev/null -w "app %{http_code}\n" localhost:8081
