#!/bin/bash
# Installs the daily host health snapshot (scripts/health/host_check.py) as a
# systemd timer. Called from deploy.yml on every deploy; idempotent and never
# fails the deploy (always exits 0).
#
# Runs at 18:20 Pacific every day, so a fresh snapshot is in place before the
# weekly Claude review on Sunday evening. Persistent=true: a run missed while
# the droplet was off happens at the next boot.
#
# The public summary is only published when /etc/dxedge/health_token holds a
# token. Set it once on the droplet; it is never committed:
#   install -d -m 700 /etc/dxedge
#   printf '%s\n' '<token>' > /etc/dxedge/health_token && chmod 600 /etc/dxedge/health_token

set -uo pipefail
LOG=/var/log/dxedge_hostcheck.log
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG"; }

SERVICE=/etc/systemd/system/dxedge-hostcheck.service
TIMER=/etc/systemd/system/dxedge-hostcheck.timer

want_service='[Unit]
Description=DXEdge daily host health snapshot
After=docker.service network-online.target

[Service]
Type=oneshot
ExecStart=/usr/bin/python3 -I /opt/dxedge/scripts/health/host_check.py
User=root
Nice=10
IOSchedulingClass=idle
TimeoutStartSec=20min
StandardOutput=append:/var/log/dxedge_hostcheck.log
StandardError=append:/var/log/dxedge_hostcheck.log'

want_timer='[Unit]
Description=DXEdge daily host health snapshot (18:20 Pacific)

[Timer]
OnCalendar=*-*-* 18:20:00 America/Los_Angeles
Persistent=true

[Install]
WantedBy=timers.target'

changed=0
if [ "$(cat "$SERVICE" 2>/dev/null)" != "$want_service" ]; then
  printf '%s\n' "$want_service" > "$SERVICE"; changed=1
fi
if [ "$(cat "$TIMER" 2>/dev/null)" != "$want_timer" ]; then
  printf '%s\n' "$want_timer" > "$TIMER"; changed=1
fi

if [ "$changed" = "1" ]; then
  systemctl daemon-reload
  systemctl enable --now dxedge-hostcheck.timer >/dev/null 2>&1
  log "installed or updated dxedge-hostcheck timer"
  # First snapshot right away, without holding the deploy.
  systemctl start --no-block dxedge-hostcheck.service
else
  systemctl is-enabled --quiet dxedge-hostcheck.timer || systemctl enable --now dxedge-hostcheck.timer >/dev/null 2>&1
fi

if [ ! -s /etc/dxedge/health_token ]; then
  log "no /etc/dxedge/health_token yet; snapshots stay private until it is set"
fi
exit 0
