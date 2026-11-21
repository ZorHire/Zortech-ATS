#!/bin/sh
# ZorHire database backup.
#   backup.sh            -> one backup now, then exit (used by "backup-now")
#   backup.sh --daemon   -> one backup every night at DB_BACKUP_TIME (default 02:30, TZ from env)
#
# Each run dumps every database listed in DB_BACKUP_DATABASES (default: zorhire, plus
# ledger if it exists) in pg_dump custom format to /backups, keeps the newest
# DB_BACKUP_LOCAL_KEEP (default 7) per database there, and uploads to
# r2://$DB_BACKUP_R2_BUCKET (default $R2_BUCKET)/db-backups/<db>/<db>-<timestamp>.dump,
# deleting R2 copies older than DB_BACKUP_KEEP_DAYS (default 30).
# R2 credentials come from the same R2_* settings the backend uses for resumes.
set -eu

BACKUP_DIR=/backups
LOCAL_KEEP="${DB_BACKUP_LOCAL_KEEP:-7}"
KEEP_DAYS="${DB_BACKUP_KEEP_DAYS:-30}"
RUN_AT="${DB_BACKUP_TIME:-02:30}"
BUCKET="${DB_BACKUP_R2_BUCKET:-${R2_BUCKET:-}}"
PGHOST="${PGHOST:-postgres}"; export PGHOST
PGUSER="${PGUSER:-zorhire}"; export PGUSER

log() { echo "[db-backup $(date '+%Y-%m-%d %H:%M:%S %Z')] $*"; }

r2_ready() {
  [ -n "$BUCKET" ] && [ -n "${R2_ACCOUNT_ID:-}" ] && [ -n "${R2_ACCESS_KEY_ID:-}" ] && [ -n "${R2_SECRET_ACCESS_KEY:-}" ]
}

r2() {
  AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
  AWS_DEFAULT_REGION=auto AWS_EC2_METADATA_DISABLED=true \
    aws --endpoint-url "https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com" "$@"
}

databases() {
  if [ -n "${DB_BACKUP_DATABASES:-}" ]; then
    echo "$DB_BACKUP_DATABASES" | tr ',' ' '
  else
    psql -d postgres -Atc "SELECT datname FROM pg_database WHERE datname IN ('zorhire','ledger') ORDER BY 1"
  fi
}

backup_once() {
  mkdir -p "$BACKUP_DIR"
  status=0
  stamp="$(date '+%Y%m%d-%H%M')"
  for db in $(databases); do
    file="$BACKUP_DIR/${db}-${stamp}.dump"
    log "dumping $db -> $file"
    if ! pg_dump -d "$db" -Fc -Z 6 --no-owner --no-acl -f "$file.part"; then
      log "ERROR: pg_dump of $db failed"; rm -f "$file.part"; status=1; continue
    fi
    # A dump that pg_restore cannot list is useless; check before trusting it.
    if ! pg_restore -l "$file.part" >/dev/null; then
      log "ERROR: $db dump is unreadable"; rm -f "$file.part"; status=1; continue
    fi
    mv "$file.part" "$file"
    log "ok: $db $(du -h "$file" | cut -f1)"

    # Local retention: newest $LOCAL_KEEP per database.
    ls -1t "$BACKUP_DIR/${db}-"*.dump 2>/dev/null | tail -n +"$((LOCAL_KEEP + 1))" | xargs -r rm -f

    if r2_ready; then
      key="db-backups/${db}/$(basename "$file")"
      if r2 s3 cp "$file" "s3://${BUCKET}/${key}" --only-show-errors; then
        log "uploaded to r2://${BUCKET}/${key}"
        cutoff="$(date -d "@$(( $(date +%s) - KEEP_DAYS * 86400 ))" '+%Y%m%d' 2>/dev/null || echo 0)"
        r2 s3 ls "s3://${BUCKET}/db-backups/${db}/" 2>/dev/null | awk '{print $4}' | while read -r name; do
          d="$(echo "$name" | sed -n "s/^${db}-\([0-9]\{8\}\)-.*/\1/p")"
          if [ -n "$d" ] && [ "$d" -lt "$cutoff" ]; then
            r2 s3 rm "s3://${BUCKET}/db-backups/${db}/${name}" --only-show-errors && log "pruned old r2 copy $name"
          fi
        done
      else
        log "ERROR: upload of $db to R2 failed (local copy kept)"; status=1
      fi
    else
      log "WARNING: R2 not configured (R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET); backup kept on the VPS only"
    fi
  done
  date '+%Y-%m-%dT%H:%M:%S%z' > "$BACKUP_DIR/.last-run"
  echo "$status" > "$BACKUP_DIR/.last-status"
  return "$status"
}

seconds_until() {
  now="$(date +%s)"
  target="$(date -d "$(date '+%Y-%m-%d') ${RUN_AT}" +%s)"
  [ "$target" -le "$now" ] && target=$((target + 86400))
  echo $((target - now))
}

if [ "${1:-}" = "--daemon" ]; then
  log "scheduler started; daily backup at ${RUN_AT} ${TZ:-UTC}"
  while true; do
    wait_s="$(seconds_until)"
    log "next backup in $((wait_s / 3600))h $(((wait_s % 3600) / 60))m"
    sleep "$wait_s"
    backup_once || log "backup finished with errors"
  done
else
  backup_once
fi
