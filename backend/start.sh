#!/bin/sh
set -e
echo "[startup] Running database migrations..."
node dist/db/migrate.js
echo "[startup] Migrations complete. Starting server..."
exec node dist/index.js
