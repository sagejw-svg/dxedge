#!/bin/bash
# DXEdge Bootstrap Script
# Run once on a fresh Ubuntu 24.04 droplet as root
# Usage: bash bootstrap.sh

set -e
echo "=== DXEdge Bootstrap ==="

# Update system
apt-get update -qq && apt-get upgrade -y -qq

# Install dependencies
apt-get install -y -qq \
    docker.io \
    docker-compose-v2 \
    nodejs \
    npm \
    certbot \
    git \
    ufw

# Enable Docker
systemctl enable --now docker

# Firewall
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
echo "Firewall configured"

# Clone repo (update this URL after you push to GitHub)
if [ ! -d "/opt/dxedge" ]; then
    git clone https://github.com/sagejw-svg/dxedge.git /opt/dxedge
fi
cd /opt/dxedge

# Build frontend
cd frontend
npm install --silent
npm run build
cd ..

# Get SSL certificate (HTTP must be reachable first)
echo "Getting SSL certificate for dxedge.com..."
certbot certonly \
    --standalone \
    --non-interactive \
    --agree-tos \
    --email james@wilsonhaven.com \
    -d dxedge.com \
    -d www.dxedge.com

# Start the stack
docker compose up -d --build

echo ""
echo "=== DXEdge is live ==="
echo "https://dxedge.com"
echo ""
echo "Useful commands:"
echo "  docker compose logs -f        # watch logs"
echo "  docker compose restart        # restart all"
echo "  docker compose pull && docker compose up -d  # update"
