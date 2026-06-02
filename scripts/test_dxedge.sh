#!/bin/bash
# DXEdge diagnostic script
# Tests via nginx (HTTPS) since backend is not on host localhost

echo "======================================"
echo "DXEdge Diagnostics - $(date -u)"
echo "======================================"

echo ""
echo "--- Container Status ---"
docker compose -f /opt/dxedge/docker-compose.yml ps

echo ""
echo "--- Memory / CPU ---"
docker stats --no-stream

echo ""
echo "--- Git Status ---"
cd /opt/dxedge && git log --oneline -5

echo ""
echo "--- dist/ Contents ---"
ls -lh /opt/dxedge/frontend/dist/
echo ""
ls -lh /opt/dxedge/frontend/dist/assets/ 2>/dev/null

echo ""
echo "--- API Checks (via nginx HTTPS) ---"
for ep in "health" "solar" "dashboard?grid=CM95" "debug"; do
    result=$(curl -sk --max-time 10 "https://localhost/api/$ep")
    code=$(curl -sk -o /dev/null -w "%{http_code}" --max-time 10 "https://localhost/api/$ep")
    size=${#result}
    first="${result:0:1}"
    if [ "$first" = "{" ] || [ "$first" = "[" ]; then
        echo "  OK   /api/$ep → HTTP $code (${size}b)"
    else
        echo "  FAIL /api/$ep → HTTP $code: ${result:0:80}"
    fi
done

echo ""
echo "--- Static Files (via nginx HTTPS) ---"
for f in "/" "/world.json" "/sw.js" "/manifest.json" "/assets/index-D4zQxphD.js" "/diag.html"; do
    code=$(curl -sk -o /dev/null -w "%{http_code}" --max-time 10 "https://localhost$f")
    size=$(curl -sk --max-time 10 "https://localhost$f" | wc -c)
    echo "  $f → HTTP $code (${size}b)"
done

echo ""
echo "--- Backend container exec check ---"
docker exec dxedge-backend python3 -c "
import sys
sys.path.insert(0, '/app')
from cache import cache
solar = cache.get('solar')
print(f'solar in cache: {bool(solar)}')
print(f'sfi: {solar.get(\"sfi\") if solar else None}')
print(f'cache keys: {cache.keys()}')
import os
dist = '/app/frontend/dist'
print(f'dist exists: {os.path.isdir(dist)}')
print(f'world.json: {os.path.isfile(dist+\"/world.json\")} ({os.path.getsize(dist+\"/world.json\") if os.path.isfile(dist+\"/world.json\") else 0}b)')
print(f'index.html: {os.path.isfile(dist+\"/index.html\")}')
print(f'assets: {os.listdir(dist+\"/assets\") if os.path.isdir(dist+\"/assets\") else \"MISSING\"}')
" 2>&1

echo ""
echo "--- Backend logs (last 20) ---"
docker logs dxedge-backend --tail 20 2>&1

echo ""
echo "======================================"
echo "Done"
echo "======================================"
