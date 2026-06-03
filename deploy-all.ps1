# deploy-all.ps1 — Run from repo root: .\deploy-all.ps1
# Uploads all backend fixes, builds frontend, and triggers VPS setup.

$VPS = "root@147.93.168.167"
$ZORTECH = "/opt/zortech"
$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "====== ZORTECH FULL DEPLOY ======" -ForegroundColor Cyan

# ── Step 1: Build frontend ────────────────────────────────────────────────────
Write-Host ""
Write-Host "[1/5] Building frontend..." -ForegroundColor Yellow
Set-Location "$PSScriptRoot\frontend"
npm run build
Set-Location $PSScriptRoot
Write-Host "  Frontend build complete." -ForegroundColor Green

# ── Step 2: Upload frontend dist ─────────────────────────────────────────────
Write-Host ""
Write-Host "[2/5] Uploading frontend dist to VPS..." -ForegroundColor Yellow
scp -r frontend/dist/* "${VPS}:${ZORTECH}/frontend/dist/"
Write-Host "  Frontend dist uploaded." -ForegroundColor Green

# ── Step 3: Upload backend changes ───────────────────────────────────────────
Write-Host ""
Write-Host "[3/5] Uploading backend files to VPS..." -ForegroundColor Yellow

# Core backend files
scp backend/Dockerfile                                          "${VPS}:${ZORTECH}/backend/Dockerfile"
scp backend/start.sh                                            "${VPS}:${ZORTECH}/backend/start.sh"
scp backend/src/index.ts                                        "${VPS}:${ZORTECH}/backend/src/index.ts"
scp backend/src/config/env.ts                                   "${VPS}:${ZORTECH}/backend/src/config/env.ts"
scp backend/src/modules/auth/auth.controller.ts                 "${VPS}:${ZORTECH}/backend/src/modules/auth/auth.controller.ts"
scp backend/src/modules/email/email.controller.ts               "${VPS}:${ZORTECH}/backend/src/modules/email/email.controller.ts"
scp backend/src/modules/email/campaigns.routes.ts               "${VPS}:${ZORTECH}/backend/src/modules/email/campaigns.routes.ts"
scp backend/src/modules/dashboard/dashboard.controller.ts       "${VPS}:${ZORTECH}/backend/src/modules/dashboard/dashboard.controller.ts"
scp backend/src/modules/dashboard/dashboard.routes.ts           "${VPS}:${ZORTECH}/backend/src/modules/dashboard/dashboard.routes.ts"

# Onboarding module (create dir first)
ssh $VPS "mkdir -p ${ZORTECH}/backend/src/modules/onboarding"
scp backend/src/modules/onboarding/onboarding.controller.ts     "${VPS}:${ZORTECH}/backend/src/modules/onboarding/onboarding.controller.ts"
scp backend/src/modules/onboarding/onboarding.routes.ts         "${VPS}:${ZORTECH}/backend/src/modules/onboarding/onboarding.routes.ts"

# Admin module
ssh $VPS "mkdir -p ${ZORTECH}/backend/src/modules/admin"
scp backend/src/modules/admin/admin.routes.ts                   "${VPS}:${ZORTECH}/backend/src/modules/admin/admin.routes.ts"
scp backend/src/modules/admin/admin.controller.ts               "${VPS}:${ZORTECH}/backend/src/modules/admin/admin.controller.ts"
scp backend/src/modules/admin/analytics.controller.ts           "${VPS}:${ZORTECH}/backend/src/modules/admin/analytics.controller.ts"

# VPS setup + rollback scripts
scp vps-setup.sh                                                "${VPS}:${ZORTECH}/vps-setup.sh"
scp rollback.sh                                                 "${VPS}:${ZORTECH}/rollback.sh"

# Infrastructure config (version-controlled, now synced on every deploy)
scp docker-compose.yml                                          "${VPS}:${ZORTECH}/docker-compose.yml"
ssh $VPS "mkdir -p ${ZORTECH}/nginx"
scp nginx/nginx.conf                                            "${VPS}:${ZORTECH}/nginx/nginx.conf"

Write-Host "  Backend files uploaded." -ForegroundColor Green

# ── Step 4: Run VPS setup (swap, redis, nginx check, logs) ───────────────────
Write-Host ""
Write-Host "[4/5] Running VPS infrastructure setup..." -ForegroundColor Yellow
ssh $VPS "bash ${ZORTECH}/vps-setup.sh"

# ── Step 5: Fix frontend permissions, rebuild backend, restart all ────────────
Write-Host ""
Write-Host "[5/5] Fixing permissions, rebuilding backend, restarting services..." -ForegroundColor Yellow
ssh $VPS @"
find ${ZORTECH}/frontend/dist -type f -exec chmod 644 {} \;
find ${ZORTECH}/frontend/dist -type d -exec chmod 755 {} \;
chmod +x ${ZORTECH}/backend/start.sh
cd ${ZORTECH}
docker compose build backend
docker compose up -d
echo '--- Container status ---'
docker compose ps
echo '--- Health check ---'
sleep 8
curl -sf https://zorhire.zortechs.in/v1/health && echo 'Backend OK' || echo 'WARNING: health check failed'
"@

Write-Host ""
Write-Host "====== DEPLOY COMPLETE ======" -ForegroundColor Cyan
Write-Host "Site: https://zorhire.zortechs.in" -ForegroundColor Green
