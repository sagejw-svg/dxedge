#!/bin/bash
# Run once to set up log rotation for dxedge deploy log

cat > /etc/logrotate.d/dxedge << 'LOGROTATE'
/var/log/dxedge_deploy.log {
    size 10M
    rotate 5
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}
LOGROTATE

echo "Log rotation configured: 10MB max, 5 rotations, compressed"
