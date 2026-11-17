#!/usr/bin/env bash
# One entrypoint for the social-post toolchain. Safe to run any number of times.
#
#   social/setup.sh --install-only   install tools (PostGIS, PostgREST, npm deps); used by the environment setup script
#   social/setup.sh                  install if needed, then (re)start the local demo stack and verify it
#
# The stack: a throwaway Postgres with the app's real migrations + demo seed,
# PostgREST, a gateway on :54321 standing in for Supabase, and the Expo web
# app on :8081 pointed at it. Nothing here ever talks to production Supabase.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
B="$ROOT/social/backend"
LOGDIR=${LOGDIR:-/tmp/suds-stack}; mkdir -p "$LOGDIR"
TOOLS=/opt/suds-tools
PGRST_VERSION=v12.2.3
PGRST_SHA256=9f71269e61ac3a940281e93ff415760f5957e430e475ba4c3889f3ede7d5527c
step() { echo "== $*"; }

install() {
  if ! ls /usr/share/postgresql/*/extension/postgis.control >/dev/null 2>&1; then
    step "installing PostGIS"
    (apt-get install -y -qq postgresql-16-postgis-3 || (apt-get update -qq && apt-get install -y -qq postgresql-16-postgis-3)) >"$LOGDIR/apt.log" 2>&1
  fi
  if [ ! -x "$TOOLS/postgrest" ]; then
    step "installing PostgREST $PGRST_VERSION"
    mkdir -p "$TOOLS"
    curl -fsSL "https://github.com/PostgREST/postgrest/releases/download/$PGRST_VERSION/postgrest-$PGRST_VERSION-linux-static-x64.tar.xz" -o "$TOOLS/pgrst.tar.xz"
    echo "$PGRST_SHA256  $TOOLS/pgrst.tar.xz" | sha256sum -c --quiet
    tar xf "$TOOLS/pgrst.tar.xz" -C "$TOOLS" && rm "$TOOLS/pgrst.tar.xz"
  fi
  local stamp="$ROOT/node_modules/.lock-sha"
  local want; want=$(sha256sum "$ROOT/package-lock.json" | cut -d' ' -f1)
  if [ ! -f "$stamp" ] || [ "$(cat "$stamp")" != "$want" ]; then
    step "installing npm dependencies"
    (cd "$ROOT" && npm ci --no-audit --no-fund >"$LOGDIR/npm.log" 2>&1)
    echo "$want" >"$stamp"
  fi
  python3 -c "from PIL import Image; import numpy" 2>/dev/null || python3 -m pip install -q --ignore-installed pillow numpy
  command -v ffmpeg >/dev/null || (apt-get install -y -qq ffmpeg >/dev/null 2>&1)
}

wait_for() { # url, seconds
  for _ in $(seq 1 "$2"); do curl -fs -o /dev/null "$1" && return 0; sleep 1; done
  echo "timed out waiting for $1" >&2; return 1
}

start() {
  pkill -f "$TOOLS/postgrest" 2>/dev/null || true
  pkill -f "$B/gateway.js" 2>/dev/null || true
  step "building database (real migrations + seed)"
  "$B/setup-db.sh" >"$LOGDIR/db.log" 2>&1 || { tail -20 "$LOGDIR/db.log"; exit 1; }
  local secret; secret=$(cd "$B" && node -e "console.log(require('./tokens').SECRET)")
  cat >"$LOGDIR/postgrest.conf" <<CONF
db-uri = "postgres://authenticator@127.0.0.1:54322/postgres"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$secret"
server-port = 3000
CONF
  step "starting PostgREST and gateway"
  setsid nohup "$TOOLS/postgrest" "$LOGDIR/postgrest.conf" >"$LOGDIR/postgrest.log" 2>&1 </dev/null &
  setsid nohup node "$B/gateway.js" >"$LOGDIR/gateway.log" 2>&1 </dev/null &
  wait_for http://127.0.0.1:3000/ 30
  wait_for http://127.0.0.1:54321/ 15

  # Only ever reuse an Expo server this script started (so it is pointed at
  # the local gateway, never at the production URL in the environment).
  local pidf="$LOGDIR/expo.pid"
  if ! { [ -f "$pidf" ] && kill -0 "$(cat "$pidf")" 2>/dev/null && curl -fs -o /dev/null http://localhost:8081; }; then
    step "starting Expo web (first bundle takes a minute)"
    pkill -f "expo start" 2>/dev/null || true; sleep 1
    local anon; anon=$(cd "$B" && node tokens.js anon)
    (cd "$ROOT" && EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 EXPO_PUBLIC_SUPABASE_ANON_KEY="$anon" CI=1 \
      setsid nohup npx expo start --web --port 8081 >"$LOGDIR/expo.log" 2>&1 </dev/null & echo $! >"$pidf")
    wait_for http://localhost:8081 240
  fi

  step "verifying"
  local tok; tok=$(cd "$B" && node tokens.js user)
  local n; n=$(curl -fs -X POST http://127.0.0.1:54321/rest/v1/rpc/get_feed -H "Authorization: Bearer $tok" \
    -H "content-type: application/json" -d '{"p_user_id":"00000000-0000-4000-a000-000000000001","p_limit":20,"p_offset":0}' | python3 -c "import json,sys; print(len(json.load(sys.stdin)))")
  [ "$n" -gt 0 ] || { echo "feed is empty" >&2; exit 1; }
  curl -fs -o /dev/null http://127.0.0.1:54321/storage/v1/object/public/drink-media/stock/two-pints.jpg
  (cd "$ROOT" && node social/capture/peek.js /feed "$LOGDIR/check.png" 540 1021) >"$LOGDIR/peek.log" 2>&1 \
    || { tail -5 "$LOGDIR/peek.log"; exit 1; }
  echo "stack ready: app http://localhost:8081  (feed rows: $n, screenshot $LOGDIR/check.png)"
}

install
[ "${1:-}" = "--install-only" ] || start
