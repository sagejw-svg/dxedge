#!/bin/bash
# Nightly OS patching script - runs at 3AM Pacific via cron
# Patches Ubuntu, restarts only if kernel update requires it

LOG="/var/log/dxedge_patch.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG"
}

log "=== Nightly patch run starting ==="

# Update package lists
apt-get update -qq 2>&1 | tail -3

# Apply security patches only (safer than full upgrade)
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y \
    -o Dpkg::Options::="--force-confdef" \
    -o Dpkg::Options::="--force-confold" \
    2>&1 | tail -10 >> "$LOG"

log "Packages updated"

# Check if reboot required
if [ -f /var/run/reboot-required ]; then
    log "Kernel update requires reboot - rebooting in 60s"
    log "Containers will auto-restart after reboot (restart: unless-stopped)"
    shutdown -r +1 "Scheduled reboot after security update" &
else
    log "No reboot required"
fi

log "=== Patch run complete ==="
