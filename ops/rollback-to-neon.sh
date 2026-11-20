#!/bin/bash
# Point ZorHire back at Neon using the .env saved by migrate-neon-to-local.sh.
# The local Postgres container and its data are kept (stopped), so you can switch again later.
# Note: anything written to the local DB after the migration is NOT copied back to Neon.
set -euo pipefail
cd /opt/zortech
[ -f .env.neon-backup ] || { echo "No .env.neon-backup found; nothing to roll back."; exit 1; }
cp .env ".env.local-db-$(date +%Y%m%d-%H%M%S)"
cp .env.neon-backup .env
chmod 600 .env
docker compose --profile localdb stop db-backup postgres || true
docker compose up -d
echo "Rolled back: the backend uses Neon again. The local database is stopped, not deleted."
