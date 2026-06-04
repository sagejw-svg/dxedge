#!/bin/bash
# Auto-deploy script - polls GitHub every 5 min for new commits
# Smart deploy:
#   - Frontend changed → npm install + build + nginx restart
#   - Backend changed  → docker rebuild + wait healthy + nginx restart
#   - Both changed     → frontend then backend, with health gating

set -uo pipefail

REPO_DIR="/opt/dxedge"
LOG="/var/log/dxedge_deploy.log"
LOCK="/tmp/dxedge_deploy.lock"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG"
}

# Prevent concurrent runs
if [ -f "$LOCK" ]; then
    PID=$(cat "$LOCK" 2>/dev/null)
    if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
        exit 0
    fi
    log "Stale lock detected (PID $PID) - removing"
fi
echo "$$" > "$LOCK"
trap "rm -f $LOCK" EXIT

cd "$REPO_DIR" || exit 1

# Get current and remote commit
LOCAL=$(git rev-parse HEAD 2>/dev/null)
git fetch origin main --quiet 2>/dev/null
REMOTE=$(git rev-parse origin/main 2>/dev/null)

if [ "$LOCAL" = "$REMOTE" ]; then
    exit 0
fi

log "=========================================="
log "New version: ${LOCAL:0:7} -> ${REMOTE:0:7}"
log "Changes:"
git log --oneline "${LOCAL}..${REMOTE}" 2>&1 | head -10 | tee -a "$LOG"

# Detect what changed BEFORE pulling
BACKEND_CHANGED=$(git diff "${LOCAL}..${REMOTE}" --name-only | grep -cE '^backend/|^docker-compose|^nginx/' || true)
FRONTEND_CHANGED=$(git diff "${LOCAL}..${REMOTE}" --name-only | grep -cE '^frontend/' || true)
PACKAGE_CHANGED=$(git diff "${LOCAL}..${REMOTE}" --name-only | grep -cE '^frontend/package(-lock)?\.json' || true)

log "Backend: $BACKEND_CHANGED files | Frontend: $FRONTEND_CHANGED files | package.json: $PACKAGE_CHANGED"

# Pull
git pull origin main --quiet
if [ $? -ne 0 ]; then
    log "ERROR: git pull failed - aborting"
    exit 1
fi

# Ensure swapfile for 1GB droplet build
if [ ! -f /swapfile ]; then
    log "Creating 1GB swapfile for build..."
    fallocate -l 1G /swapfile && chmod 600 /swapfile
    mkswap /swapfile >/dev/null && swapon /swapfile
fi

# === Frontend build (always when frontend changed) ===
if [ "$FRONTEND_CHANGED" -gt 0 ]; then
    cd "$REPO_DIR/frontend"

    # npm install only when package.json changed (saves ~10s otherwise)
    if [ "$PACKAGE_CHANGED" -gt 0 ]; then
        log "package.json changed - running npm install..."
        npm install --silent 2>&1 | tail -3 | tee -a "$LOG"
        if [ $? -ne 0 ]; then
            log "ERROR: npm install failed - rolling back"
            git reset --hard "$LOCAL"
            exit 1
        fi
    fi

    log "Building frontend..."
    NODE_OPTIONS="--max-old-space-size=768" npm run build 2>&1 | tail -10 | tee -a "$LOG"
    if [ $? -ne 0 ]; then
        log "ERROR: frontend build failed - rolling back"
        git reset --hard "$LOCAL"
        exit 1
    fi
    log "Frontend built OK"
fi

# === Backend rebuild ===
cd "$REPO_DIR"
if [ "$BACKEND_CHANGED" -gt 0 ]; then
    log "Backend changed - rebuilding container..."
    docker compose build --no-cache backend 2>&1 | tail -5 | tee -a "$LOG"
    if [ $? -ne 0 ]; then
        log "ERROR: backend docker build failed"
        exit 1
    fi

    docker compose up -d --no-deps backend 2>&1 | tail -3 | tee -a "$LOG"

    # Wait for backend healthy before touching nginx
    log "Waiting for backend healthy..."
    for i in $(seq 1 12); do
        sleep 5
        STATUS=$(docker inspect --format='{{.State.Health.Status}}' dxedge-backend 2>/dev/null)
        if [ "$STATUS" = "healthy" ]; then
            log "Backend healthy after ${i}x5s"
            break
        fi
        if [ "$i" = "12" ]; then
            log "WARNING: backend not healthy after 60s - restarting nginx anyway"
        fi
    done
fi

# === Nginx restart (frontend or backend changed) ===
if [ "$FRONTEND_CHANGED" -gt 0 ] || [ "$BACKEND_CHANGED" -gt 0 ]; then
    log "Restarting nginx to pick up changes..."
    docker compose restart nginx 2>&1 | tail -2 | tee -a "$LOG"
fi

# === Verify health ===
sleep 3
HEALTH=$(curl -sk -o /dev/null -w "%{http_code}" --max-time 5 https://localhost/api/health 2>/dev/null)
if [ "$HEALTH" = "200" ]; then
    log "✓ Deploy complete and verified: $(git rev-parse --short HEAD)"
else
    log "⚠ Deploy complete but health check returned $HEALTH"
fi
log "=========================================="
