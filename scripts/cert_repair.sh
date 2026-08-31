#!/bin/bash
# DXEdge certificate guard.
# Runs on the droplet from the deploy workflow. Safe and idempotent: it exits
# immediately unless the certificate is expired or within DAYS_THRESHOLD of it.
#
# Why this exists:
#   bootstrap.sh issued the original certificate with "certbot certonly
#   --standalone", which recorded "authenticator = standalone" in
#   /etc/letsencrypt/renewal/dxedge.net.conf. The certbot container then ran
#   "certbot renew --webroot -w /var/www/certbot". But "certbot renew" reads the
#   authenticator from the saved renewal config and ignores that command line
#   flag, so every renewal attempted standalone mode, tried to bind port 80,
#   found the nginx container already holding it, and failed. --quiet hid it.
#   Separately, nginx only reads certificates at startup, so even a successful
#   renewal would have kept serving the old certificate from memory.

set -uo pipefail

DOMAIN=dxedge.net
EMAIL=james@wilsonhaven.com
RENEWAL_CONF=/etc/letsencrypt/renewal/${DOMAIN}.conf
CERT=/etc/letsencrypt/live/${DOMAIN}/fullchain.pem
COMPOSE_DIR=/opt/dxedge
LOG=/var/log/dxedge_cert.log
DAYS_THRESHOLD=30

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"; }

cd "$COMPOSE_DIR" 2>/dev/null || { log "compose dir $COMPOSE_DIR missing, skipping"; exit 0; }

if [ -f "$CERT" ]; then
    if openssl x509 -checkend $((DAYS_THRESHOLD * 86400)) -noout -in "$CERT" >/dev/null 2>&1; then
        log "certificate valid for more than ${DAYS_THRESHOLD} days, nothing to do"
        exit 0
    fi
    log "certificate is expired or expires within ${DAYS_THRESHOLD} days, repairing"
else
    log "no certificate found at $CERT, requesting one"
fi

# 1. Repair the renewal config so unattended renewals use webroot from now on.
if [ -f "$RENEWAL_CONF" ] && grep -qE '^authenticator[[:space:]]*=[[:space:]]*standalone' "$RENEWAL_CONF"; then
    cp "$RENEWAL_CONF" "${RENEWAL_CONF}.bak.$(date +%s)"
    sed -i -E 's|^authenticator[[:space:]]*=[[:space:]]*standalone|authenticator = webroot|' "$RENEWAL_CONF"
    grep -q '^webroot_path' "$RENEWAL_CONF" || echo "webroot_path = /var/www/certbot," >> "$RENEWAL_CONF"
    log "renewal config authenticator switched from standalone to webroot"
fi

# 2. Make sure the ACME challenge webroot exists on the host and nginx is up to
#    serve it. nginx serves /.well-known/acme-challenge/ from /var/www/certbot.
mkdir -p /var/www/certbot
docker compose up -d nginx >>"$LOG" 2>&1

# 3. Issue through the host certbot using the webroot nginx is serving.
log "requesting certificate via webroot"
certbot certonly \
    --webroot -w /var/www/certbot \
    --non-interactive --agree-tos --email "$EMAIL" \
    --cert-name "$DOMAIN" \
    -d "$DOMAIN" -d "www.${DOMAIN}" >>"$LOG" 2>&1
ISSUE_RC=$?

if [ $ISSUE_RC -ne 0 ]; then
    log "certbot exited $ISSUE_RC, see $LOG for detail"
fi

# 4. nginx caches certificates in memory, so it must be restarted to pick up
#    the new one. This is the step whose absence hid the original failure.
log "restarting nginx to load the certificate"
docker compose restart nginx >>"$LOG" 2>&1

sleep 5
if openssl x509 -checkend 0 -noout -in "$CERT" >/dev/null 2>&1; then
    NOT_AFTER=$(openssl x509 -enddate -noout -in "$CERT" | cut -d= -f2)
    log "SUCCESS: certificate valid, expires $NOT_AFTER"
else
    log "FAILURE: certificate still invalid after repair attempt"
fi

# 5. Install a host cron entry so renewal happens on its own schedule and
#    reloads nginx afterwards. Idempotent: rewritten each run, never duplicated.
CRON_FILE=/etc/cron.d/dxedge-certbot
cat > "$CRON_FILE" <<'CRON'
# DXEdge certificate renewal. Twice daily is the Let's Encrypt recommendation.
# The deploy hook is the critical part: nginx reads certificates only at
# startup, so a renewal without a restart changes nothing a visitor can see.
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
17 3,15 * * * root certbot renew --webroot -w /var/www/certbot --deploy-hook "docker restart dxedge-nginx" >> /var/log/dxedge_cert.log 2>&1
CRON
chmod 0644 "$CRON_FILE"
log "installed renewal cron at $CRON_FILE"

# Never fail the deploy because of this script.
exit 0
