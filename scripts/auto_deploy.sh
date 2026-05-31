#!/bin/bash
# Auto-deploy script - checks GitHub every 5 minutes for new commits
# Smart rebuild: only rebuilds backend container when Python files change

REPO_DIR="/opt/dxedge"
LOG="/var/log/dxedge_deploy.log"
LOCK="/tmp/dxedge_deploy.lock"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG"
}

# Prevent concurrent runs
if [ -f "$LOCK" ]; then
    exit 0
fi
touch "$LOCK"
trap "rm -f $LOCK" EXIT

cd "$REPO_DIR" || exit 1

# Get current and remote commit
LOCAL=$(git rev-parse HEAD 2>/dev/null)
git fetch origin main --quiet 2>/dev/null
REMOTE=$(git rev-parse origin/main 2>/dev/null)

if [ "$LOCAL" = "$REMOTE" ]; then
    exit 0
fi

log "New version detected: ${LOCAL:0:7} -> ${REMOTE:0:7}"
log "Changes: $(git log --oneline ${LOCAL}..${REMOTE} | head -5)"

git pull origin main --quiet
if [ $? -ne 0 ]; then
    log "ERROR: git pull failed"
    exit 1
fi

# Check what changed to decide what to rebuild
BACKEND_CHANGED=$(git diff ${LOCAL}..${REMOTE} --name-only | grep -E '^backend/|^docker-compose|^nginx/' | wc -l)
FRONTEND_CHANGED=$(git diff ${LOCAL}..${REMOTE} --name-only | grep -E '^frontend/' | wc -l)

log "Backend changes: $BACKEND_CHANGED files | Frontend changes: $FRONTEND_CHANGED files"

# Rebuild frontend if needed
if [ "$FRONTEND_CHANGED" -gt 0 ] || [ "$BACKEND_CHANGED" -gt 0 ]; then
    log "Building frontend..."
    cd "$REPO_DIR/frontend"
    npm run build --silent
    if [ $? -ne 0 ]; then
        log "ERROR: frontend build failed - rolling back"
        git reset --hard "$LOCAL"
        exit 1
    fi
    log "Frontend built successfully"
fi

# Restart containers
cd "$REPO_DIR"
if [ "$BACKEND_CHANGED" -gt 0 ]; then
    log "Backend changed - rebuilding container (no-cache)..."
    docker compose build --no-cache backend 2>&1 | tail -5 | tee -a "$LOG"
    if [ $? -ne 0 ]; then
        log "ERROR: backend build failed"
        exit 1
    fi
    docker compose up -d 2>&1 | tail -3 | tee -a "$LOG"
else
    log "Frontend only - restarting nginx (no backend rebuild needed)"
    docker compose restart nginx 2>&1 | tail -2 | tee -a "$LOG"
fi

log "Deploy complete. Running: $(git rev-parse --short HEAD)"
