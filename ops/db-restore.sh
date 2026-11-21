#!/bin/bash
# Restore a ZorHire database from a backup (disaster recovery).
#   bash /opt/zortech/ops/db-restore.sh                     # list available backups
#   bash /opt/zortech/ops/db-restore.sh backups/zorhire-20261205-0230.dump
#   bash /opt/zortech/ops/db-restore.sh r2:db-backups/zorhire/zorhire-20261205-0230.dump
# The database (zorhire / ledger) is taken from the file name. The current database is first
# saved to backups/<db>-before-restore-<time>.dump, so a restore can itself be undone.
set -euo pipefail
cd /opt/zortech
pg() { docker compose exec -T postgres "$@"; }
R2_SH='export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" AWS_DEFAULT_REGION=auto;
       R2="aws --endpoint-url https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com"; B="${DB_BACKUP_R2_BUCKET:-$R2_BUCKET}";'

if [ $# -eq 0 ]; then
  echo "Backups on this VPS:"
  ls -1t backups/*.dump 2>/dev/null | head -20 | sed 's/^/  /' || true
  echo
  echo "Backups in R2:"
  docker compose run --rm --entrypoint sh db-backup -c "$R2_SH \$R2 s3 ls --recursive s3://\$B/db-backups/" 2>/dev/null \
    | awk '{print "  r2:"$4}' | sort -r | head -20 || echo "  (R2 not configured)"
  exit 0
fi

SRC="$1"
NAME="$(basename "${SRC#r2:}")"
DB="${NAME%%-*}"
case "$DB" in zorhire|ledger) ;; *) echo "Cannot tell the database from '$NAME' (expected zorhire-... or ledger-...)"; exit 1;; esac

if [[ "$SRC" == r2:* ]]; then
  mkdir -p backups
  docker compose run --rm --entrypoint sh -e KEY="${SRC#r2:}" -e OUT="/backups/$NAME" db-backup \
    -c "$R2_SH \$R2 s3 cp s3://\$B/\$KEY \$OUT --only-show-errors"
  SRC="backups/$NAME"
fi
[ -f "$SRC" ] || { echo "File not found: $SRC"; exit 1; }

if [ "${CONFIRM:-}" != "RESTORE" ]; then
  read -r -p "Replace the '$DB' database with $SRC? The backend stops briefly. Type RESTORE to continue: " answer
  [ "$answer" = "RESTORE" ] || { echo "Cancelled."; exit 1; }
fi

SAFETY="backups/${DB}-before-restore-$(date +%Y%m%d-%H%M%S).dump"
pg pg_dump -U zorhire -d "$DB" -Fc -f /tmp/safety.dump
pg cat /tmp/safety.dump > "$SAFETY"
pg rm -f /tmp/safety.dump
echo "Current database saved to $SAFETY"

docker compose stop backend
docker compose cp "$SRC" postgres:/tmp/restore.dump
pg psql -U zorhire -d postgres -v ON_ERROR_STOP=1 -q -c "DROP DATABASE IF EXISTS \"$DB\" WITH (FORCE)" -c "CREATE DATABASE \"$DB\" OWNER zorhire"
pg psql -U zorhire -d "$DB" -q -c "CREATE EXTENSION IF NOT EXISTS vector"
pg pg_restore -U zorhire -d "$DB" --no-owner --no-acl /tmp/restore.dump || echo "pg_restore reported warnings (usually harmless)."
pg rm -f /tmp/restore.dump
docker compose up -d backend
echo "Restored $DB from $SRC. Undo with: CONFIRM=RESTORE bash ops/db-restore.sh $SAFETY"
