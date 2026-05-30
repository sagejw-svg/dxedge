#!/bin/bash
# Run once on the droplet to install auto-deploy and auto-patch
# Usage: bash /opt/dxedge/scripts/install_automation.sh

set -e
echo "=== Installing DXEdge automation ==="

# --- 1. Auto-deploy systemd service (checks GitHub every 5 min) ---
cat > /etc/systemd/system/dxedge-deploy.service << 'SERVICE'
[Unit]
Description=DXEdge Auto-Deploy
After=docker.service network-online.target

[Service]
Type=oneshot
ExecStart=/opt/dxedge/scripts/auto_deploy.sh
User=root
StandardOutput=journal
StandardError=journal
SERVICE

cat > /etc/systemd/system/dxedge-deploy.timer << 'TIMER'
[Unit]
Description=DXEdge Auto-Deploy Timer (every 5 min)
Requires=dxedge-deploy.service

[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
Persistent=true

[Install]
WantedBy=timers.target
TIMER

systemctl daemon-reload
systemctl enable --now dxedge-deploy.timer
echo "Auto-deploy timer: enabled (every 5 min)"

# --- 2. Nightly OS patching via cron (3 AM Pacific = 11 AM UTC in summer) ---
# Pacific time is UTC-7 (PDT) or UTC-8 (PST)
# 3 AM PDT = 10:00 UTC, 3 AM PST = 11:00 UTC
# Use 11 UTC to be safe (always after 3 AM Pacific)
CRON_LINE="0 11 * * * root /opt/dxedge/scripts/auto_patch.sh"
CRON_FILE="/etc/cron.d/dxedge-patch"

echo "$CRON_LINE" > "$CRON_FILE"
chmod 644 "$CRON_FILE"
echo "Nightly patching: enabled (03:00-04:00 AM Pacific)"

# --- 3. Log rotation ---
cat > /etc/logrotate.d/dxedge << 'LOGROTATE'
/var/log/dxedge_*.log {
    daily
    rotate 14
    compress
    missingok
    notifempty
    create 644 root root
}
LOGROTATE

echo ""
echo "=== Automation installed ==="
echo ""
echo "Auto-deploy: every 5 min (systemd timer)"
echo "  Status:  systemctl status dxedge-deploy.timer"
echo "  Logs:    tail -f /var/log/dxedge_deploy.log"
echo "  Manual:  bash /opt/dxedge/scripts/auto_deploy.sh"
echo ""
echo "Nightly patch: 11:00 UTC (3 AM Pacific)"
echo "  Logs:    tail -f /var/log/dxedge_patch.log"
echo "  Manual:  bash /opt/dxedge/scripts/auto_patch.sh"
echo ""
echo "From now on, just push to GitHub and the site updates automatically."
