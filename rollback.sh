#!/bin/bash
# Rollback to the previous Docker image of zortech-backend.
# Usage: bash rollback.sh
set -e

COMPOSE_FILE="/opt/zortech/docker-compose.yml"
SERVICE="backend"
CONTAINER="zortech-backend-1"

echo "[rollback] Finding previous image for $SERVICE..."
PREV_IMAGE=$(docker images zortech-backend --format "{{.ID}}" | sed -n '2p')

if [ -z "$PREV_IMAGE" ]; then
  echo "[rollback] ERROR: No previous image found. Cannot roll back."
  exit 1
fi

echo "[rollback] Stopping current container..."
docker compose -f "$COMPOSE_FILE" stop "$SERVICE"

echo "[rollback] Tagging previous image as rollback target..."
docker tag "$PREV_IMAGE" zortech-backend:rollback

echo "[rollback] Updating compose to use rollback image..."
docker compose -f "$COMPOSE_FILE" up -d --no-build "$SERVICE" --image zortech-backend:rollback 2>/dev/null || \
  docker run -d --name "${CONTAINER}_rollback" --network zortech_default \
    --env-file /opt/zortech/.env \
    -p 8080:8080 \
    zortech-backend:rollback ./start.sh

echo "[rollback] Done. Verify with: docker compose -f $COMPOSE_FILE ps"
