#!/bin/bash
# Auto-deploy script - checks GitHub every 5 minutes for new commits
# Runs as a systemd service

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

log "New version detected: $LOCAL -> $REMOTE"
log "Pulling changes..."

git pull origin main --quiet
if [ $? -ne 0 ]; then
    log "ERROR: git pull failed"
    exit 1
fi

# Show what changed
log "Changes: $(git log --oneline ${LOCAL}..${REMOTE} | head -5)"

# Rebuild frontend
log "Building frontend..."
cd "$REPO_DIR/frontend"
npm run build --silent
if [ $? -ne 0 ]; then
    log "ERROR: frontend build failed - rolling back"
    git reset --hard "$LOCAL"
    exit 1
fi

# Restart containers
cd "$REPO_DIR"
log "Restarting containers..."
docker compose up -d --build 2>&1 | tail -20 | tee -a "$LOG"

if [ $? -eq 0 ]; then
    log "Deploy complete. Running: $(git rev-parse --short HEAD)"
else
    log "ERROR: docker compose failed"
    exit 1
fi
