#!/bin/bash
# Move the ZorHire database(s) from Neon to the Postgres container on this VPS.
# Run ON the VPS as root (or via the "VPS database ops" GitHub Action):
#   bash /opt/zortech/ops/migrate-neon-to-local.sh --check     # preflight only, changes nothing
#   bash /opt/zortech/ops/migrate-neon-to-local.sh             # full migration
#
# Full run:
#   1. Preflight: memory, disk, Docker, and that Neon is reachable.
#   2. Adds POSTGRES_PASSWORD + COMPOSE_PROFILES=localdb to .env and starts the postgres container.
#   3. Stops the backend, dumps Neon (SERVER_DATABASE_URL and, if set, LEDGER_DATABASE_URL),
#      restores into local databases "zorhire" / "ledger", and compares row counts table by table.
#   4. Only if every count matches: saves the old .env, points the URLs at the local DB,
#      starts everything (incl. nightly backups) and waits for /v1/health.
#   Any failure after step 2 puts the old .env back and restarts the backend on Neon.
# Undo later: bash /opt/zortech/ops/rollback-to-neon.sh  (Neon itself is never modified).
set -Eeuo pipefail

DIR=/opt/zortech
ENV_FILE="$DIR/.env"
WORK="$DIR/backups/migration-$(date +%Y%m%d-%H%M%S)"
CHECK_ONLY=false
[ "${1:-}" = "--check" ] && CHECK_ONLY=true

cd "$DIR"
say()  { echo; echo "==> $*"; }
ok()   { echo "    ok: $*"; }
warn() { echo "    WARNING: $*"; }
die()  { echo; echo "    ERROR: $*" >&2; exit 1; }

env_get() { grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"; }
env_set() {
  local key="$1" val="$2" tmp
  tmp="$(mktemp)"
  grep -vE "^${key}=" "$ENV_FILE" > "$tmp" || true
  printf '%s=%s\n' "$key" "$val" >> "$tmp"
  cat "$tmp" > "$ENV_FILE"
  rm -f "$tmp"
}
# Neon's "-pooler" endpoint (PgBouncer) is not safe for pg_dump; use the direct endpoint.
direct_url() { echo "$1" | sed -E 's/-pooler\././'; }
mask() { echo "$1" | sed -E 's#//[^@]*@#//***@#'; }
pg() { docker compose exec -T postgres "$@"; }

[ -f "$ENV_FILE" ] || die "$ENV_FILE not found"
MAIN_URL="$(env_get SERVER_DATABASE_URL || true)"
LEDGER_URL="$(env_get LEDGER_DATABASE_URL || true)"

# ── 1. Preflight ─────────────────────────────────────────────────────────────
say "Preflight"
command -v docker >/dev/null || die "docker not installed"
docker compose version >/dev/null || die "docker compose plugin missing"
MEM_TOTAL_MB=$(free -m | awk '/Mem:/{print $2}')
MEM_AVAIL_MB=$(free -m | awk '/Mem:/{print $7}')
SWAP_MB=$(free -m | awk '/Swap:/{print $2}')
DISK_FREE_GB=$(df -BG --output=avail "$DIR" | tail -1 | tr -dc '0-9')
echo "    VPS: $(nproc) CPU, ${MEM_TOTAL_MB} MB RAM (${MEM_AVAIL_MB} MB available), ${SWAP_MB} MB swap, ${DISK_FREE_GB} GB disk free"
[ "$MEM_AVAIL_MB" -ge 600 ] || die "only ${MEM_AVAIL_MB} MB RAM available; Postgres needs ~600 MB headroom. Upgrade the VPS or use Neon's paid plan instead. Nothing was changed."
[ "$DISK_FREE_GB" -ge 5 ] || die "only ${DISK_FREE_GB} GB disk free; need at least 5 GB. Nothing was changed."
ok "enough memory and disk"

if [[ "$MAIN_URL" == *"@postgres:"* ]]; then
  echo "    SERVER_DATABASE_URL already points at the local container; nothing to migrate."
  exit 0
fi
[ -n "$MAIN_URL" ] || die "SERVER_DATABASE_URL is empty in .env"
echo "    source: $(mask "$MAIN_URL")"
[ -n "$LEDGER_URL" ] && echo "    ledger: $(mask "$LEDGER_URL")"

# A throwaway container does the reachability check, so --check changes nothing on the server.
probe() { docker run --rm pgvector/pgvector:pg17 psql "$(direct_url "$1")" -Atc "SELECT pg_size_pretty(pg_database_size(current_database()))" 2>&1; }
if out=$(probe "$MAIN_URL"); then ok "Neon main DB reachable (size $out)"; else die "cannot reach Neon main DB (still suspended?): $out"; fi
if [ -n "$LEDGER_URL" ]; then
  if out=$(probe "$LEDGER_URL"); then ok "Neon ledger DB reachable (size $out)"; else die "cannot reach Neon ledger DB: $out"; fi
fi

if $CHECK_ONLY; then
  say "Preflight passed. Run again without --check to migrate."
  exit 0
fi

# ── 2. Start local Postgres ─────────────────────────────────────────────────
say "Starting local Postgres"
mkdir -p "$WORK"
cp "$ENV_FILE" "$WORK/env.before"
chmod 600 "$WORK/env.before"

restore_neon_on_failure() {
  echo "    Migration stopped. Putting the previous .env back and restarting the backend on Neon..."
  cp "$WORK/env.before" "$ENV_FILE"
  docker compose up -d backend || true
}
trap 'restore_neon_on_failure' ERR

if [ -z "$(env_get POSTGRES_PASSWORD || true)" ]; then
  env_set POSTGRES_PASSWORD "$(openssl rand -hex 24)"
  ok "generated POSTGRES_PASSWORD"
fi
PROFILES="$(env_get COMPOSE_PROFILES || true)"
if [[ ",$PROFILES," != *",localdb,"* ]]; then
  env_set COMPOSE_PROFILES "${PROFILES:+$PROFILES,}localdb"
fi
PGPASS="$(env_get POSTGRES_PASSWORD)"
docker compose up -d postgres
for i in $(seq 1 30); do
  pg pg_isready -U zorhire -d zorhire >/dev/null 2>&1 && break
  if [ "$i" = 30 ]; then echo "local Postgres did not become ready"; false; fi
  sleep 2
done
ok "local Postgres is up"

# ── 3. Copy the data ────────────────────────────────────────────────────────
say "Stopping the backend so nothing writes during the copy"
docker compose stop backend || true

COUNT_SQL="SELECT format('SELECT %L, count(*) FROM %I.%I;', n.nspname||'.'||c.relname, n.nspname, c.relname)
             FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relkind IN ('r','p') AND NOT c.relispartition
              AND n.nspname NOT IN ('pg_catalog','information_schema')
              AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'neon%'
            ORDER BY 1"
count_all() {  # count_all <psql connection args...>  -> "schema.table count" lines, sorted
  local stmts; stmts="$(pg psql "$@" -Atc "$COUNT_SQL")"
  [ -z "$stmts" ] && return 0
  echo "$stmts" | pg psql "$@" -At -F ' ' | sort
}

copy_db() {   # copy_db <source-url> <local-db-name>
  local src db dump
  src="$(direct_url "$1")"; db="$2"; dump="/tmp/${db}.dump"
  echo "    dumping $db from Neon..."
  pg pg_dump "$src" -Fc --no-owner --no-acl -f "$dump"
  pg cat "$dump" > "$WORK/${db}-neon.dump"
  echo "    restoring into local $db..."
  pg psql -U zorhire -d postgres -v ON_ERROR_STOP=1 -q -c "DROP DATABASE IF EXISTS \"$db\" WITH (FORCE)" -c "CREATE DATABASE \"$db\" OWNER zorhire"
  pg psql -U zorhire -d "$db" -v ON_ERROR_STOP=1 -q -c "CREATE EXTENSION IF NOT EXISTS vector"
  # Neon-only extensions/settings can raise harmless errors; the row-count check below is the real gate.
  if ! pg pg_restore -U zorhire -d "$db" --no-owner --no-acl "$dump" 2> "$WORK/${db}-restore.log"; then
    warn "pg_restore reported issues (see $WORK/${db}-restore.log); verifying the data..."
  fi
  pg rm -f "$dump"

  echo "    comparing row counts table by table..."
  count_all "$src" > "$WORK/${db}-counts-neon.txt"
  count_all -U zorhire -d "$db" > "$WORK/${db}-counts-local.txt"
  if ! diff -u "$WORK/${db}-counts-neon.txt" "$WORK/${db}-counts-local.txt" > "$WORK/${db}-counts.diff"; then
    cat "$WORK/${db}-counts.diff"
    echo "row counts differ for $db (details in $WORK)"
    false
  fi
  ok "$db: $(wc -l < "$WORK/${db}-counts-local.txt") tables, $(awk '{s+=$NF} END{print s+0}' "$WORK/${db}-counts-local.txt") rows, every count matches"
}

say "Copying main database"
copy_db "$MAIN_URL" zorhire
if [ -n "$LEDGER_URL" ]; then
  say "Copying ledger database"
  copy_db "$LEDGER_URL" ledger
fi

# ── 4. Switch over ──────────────────────────────────────────────────────────
say "Switching the app to the local database"
env_set NEON_DATABASE_URL_BEFORE_MIGRATION "$MAIN_URL"
env_set SERVER_DATABASE_URL "postgresql://zorhire:${PGPASS}@postgres:5432/zorhire"
if [ -n "$LEDGER_URL" ]; then
  env_set NEON_LEDGER_URL_BEFORE_MIGRATION "$LEDGER_URL"
  env_set LEDGER_DATABASE_URL "postgresql://zorhire:${PGPASS}@postgres:5432/ledger"
fi
cp "$WORK/env.before" "$DIR/.env.neon-backup"
chmod 600 "$DIR/.env.neon-backup" "$ENV_FILE"

docker compose up -d --build
for i in $(seq 1 36); do
  if timeout 10 docker compose exec -T backend node -e \
    "const r=require('http').get('http://localhost:8080/v1/health',res=>process.exit(res.statusCode===200?0:1));r.setTimeout(5000,()=>{r.destroy();process.exit(1)});r.on('error',()=>process.exit(1))" \
    >/dev/null 2>&1; then
    trap - ERR
    ok "backend healthy on the local database after $((i * 5))s"
    say "Taking the first backup"
    docker compose run --rm db-backup /usr/local/bin/backup.sh || warn "first backup failed; check the R2_* settings"
    say "DONE. ZorHire now runs on Postgres on this VPS."
    echo "    Migration files: $WORK"
    echo "    Undo: bash $DIR/ops/rollback-to-neon.sh"
    exit 0
  fi
  sleep 5
done
docker compose logs backend --tail=50 || true
echo "backend did not become healthy on the local database"
false
