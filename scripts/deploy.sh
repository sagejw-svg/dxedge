#!/bin/bash
# Safe deploy script - waits for backend healthy before restarting nginx
set -e
cd /opt/dxedge
LOG=/var/log/dxedge_deploy.log

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Deploy starting" | tee -a $LOG
git pull origin main

# Detect what changed
CHANGED=$(git diff --name-only HEAD~1 HEAD 2>/dev/null || echo "unknown")
echo "[$(date)] Changed: $CHANGED" | tee -a $LOG

# Always rebuild backend
docker compose build --no-cache backend

# Bring up - backend starts and healthcheck runs
docker compose up -d --no-deps backend
echo "[$(date)] Waiting for backend healthy..." | tee -a $LOG

# Wait up to 60s for healthy
for i in $(seq 1 12); do
    sleep 5
    STATUS=$(docker inspect --format='{{.State.Health.Status}}' dxedge-backend 2>/dev/null)
    echo "  Health: $STATUS" | tee -a $LOG
    if [ "$STATUS" = "healthy" ]; then
        echo "[$(date)] Backend healthy - restarting nginx" | tee -a $LOG
        docker compose restart nginx
        echo "[$(date)] Deploy complete: $(git rev-parse --short HEAD)" | tee -a $LOG
        exit 0
    fi
done

echo "[$(date)] ERROR: Backend did not become healthy in 60s" | tee -a $LOG
exit 1
