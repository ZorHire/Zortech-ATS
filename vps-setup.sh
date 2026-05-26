#!/bin/bash
# Run this ON the VPS: bash /opt/zortech/vps-setup.sh
set -e

ZORTECH_DIR="/opt/zortech"
COMPOSE_FILE="$ZORTECH_DIR/docker-compose.yml"
ENV_FILE="$ZORTECH_DIR/.env"

echo "====== ZORTECH VPS SETUP ======"

# ── 1. Swap space ──────────────────────────────────────────────────────────────
echo ""
echo "[1/6] Checking swap space..."
SWAP_TOTAL=$(free -b | awk '/Swap:/{print $2}')
if [ "$SWAP_TOTAL" = "0" ]; then
  echo "  No swap found. Creating 2GB swap file..."
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "  Swap created: $(free -h | awk '/Swap:/{print $2}')"
else
  echo "  Swap already present: $(free -h | awk '/Swap:/{print $2}')"
fi

# ── 2. Nginx syntax check ─────────────────────────────────────────────────────
echo ""
echo "[2/6] Checking nginx config syntax..."
docker exec zortech-nginx-1 nginx -t 2>&1 && echo "  Nginx config OK" || {
  echo "  WARNING: nginx config has syntax errors — check logs above"
}

# ── 3. Redis password ─────────────────────────────────────────────────────────
echo ""
echo "[3/6] Checking Redis password..."
if grep -q '^REDIS_PASS=' "$ENV_FILE" 2>/dev/null; then
  echo "  Redis password already configured in .env (REDIS_PASS present)"
else
  echo "  Generating Redis password..."
  REDIS_PASS=$(openssl rand -hex 20)

  # Write REDIS_PASS so docker-compose.yml can interpolate it
  echo "REDIS_PASS=${REDIS_PASS}" >> "$ENV_FILE"

  # Write / update REDIS_URL so the backend can connect with auth
  if grep -q '^REDIS_URL=' "$ENV_FILE" 2>/dev/null; then
    sed -i "s|^REDIS_URL=.*|REDIS_URL=redis://:${REDIS_PASS}@redis:6379|" "$ENV_FILE"
  else
    echo "REDIS_URL=redis://:${REDIS_PASS}@redis:6379" >> "$ENV_FILE"
  fi

  echo "  REDIS_PASS and REDIS_URL written to .env."
  echo "  docker-compose.yml reads REDIS_PASS at startup — no file patching needed."
fi

# ── 4. Docker log rotation ────────────────────────────────────────────────────
echo ""
echo "[4/6] Configuring Docker log rotation..."
mkdir -p /etc/docker
if [ -f /etc/docker/daemon.json ]; then
  echo "  daemon.json already exists:"
  cat /etc/docker/daemon.json
else
  cat > /etc/docker/daemon.json << 'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF
  echo "  Docker log rotation configured: 10MB × 3 files per container."
  echo "  NOTE: Restart Docker daemon to apply: systemctl restart docker (will restart containers)"
fi

# ── 5. Logrotate ──────────────────────────────────────────────────────────────
echo ""
echo "[5/6] Configuring logrotate for /var/log/zortech..."
mkdir -p /var/log/zortech
cat > /etc/logrotate.d/zortech << 'EOF'
/var/log/zortech/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0640 root root
    sharedscripts
}
EOF
echo "  Logrotate config written to /etc/logrotate.d/zortech"

# ── 6. Rollback script ────────────────────────────────────────────────────────
echo ""
echo "[6/6] Installing rollback script..."
chmod +x "$ZORTECH_DIR/rollback.sh" 2>/dev/null && echo "  rollback.sh is executable" || echo "  rollback.sh not found yet (upload it first)"

echo ""
echo "====== SETUP COMPLETE ======"
echo ""
echo "Next step — rebuild and restart all services:"
echo "  cd /opt/zortech && docker compose build backend && docker compose up -d"
