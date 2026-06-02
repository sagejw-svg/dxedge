#!/bin/bash
echo "======================================"
echo "DXEdge Diagnostics - $(date -u)"
echo "======================================"

echo ""
echo "--- Docker Container Status ---"
docker compose -f /opt/dxedge/docker-compose.yml ps

echo ""
echo "--- Memory / CPU ---"
docker stats --no-stream 2>/dev/null

echo ""
echo "--- Backend Logs (last 30 lines) ---"
docker logs dxedge-backend --tail 30 2>&1

echo ""
echo "--- API Checks (direct to backend) ---"
for ep in "health" "solar" "dashboard?grid=CM95"; do
    code=$(curl -s -o /tmp/resp.txt -w "%{http_code}" --max-time 8 "http://localhost:8000/api/$ep")
    size=$(wc -c < /tmp/resp.txt)
    first=$(head -c 1 /tmp/resp.txt)
    if [ "$first" = "{" ] || [ "$first" = "[" ]; then
        echo "  OK   /api/$ep → HTTP $code (${size}b)"
    else
        echo "  FAIL /api/$ep → HTTP $code: $(cat /tmp/resp.txt | head -c 100)"
    fi
done

echo ""
echo "--- Static Files (direct to backend) ---"
for f in "/" "/world.json" "/sw.js" "/manifest.json" "/assets/index-D4zQxphD.js"; do
    code=$(curl -s -o /tmp/resp.txt -w "%{http_code}" --max-time 8 "http://localhost:8000$f")
    size=$(wc -c < /tmp/resp.txt)
    echo "  $f → HTTP $code (${size}b)"
done

echo ""
echo "--- Nginx Checks (via HTTPS) ---"
for ep in "/" "/api/health" "/api/solar" "/world.json" "/assets/index-D4zQxphD.js"; do
    code=$(curl -sk -o /tmp/resp.txt -w "%{http_code}" --max-time 8 "https://localhost$ep")
    size=$(wc -c < /tmp/resp.txt)
    echo "  $ep → HTTP $code (${size}b)"
done

echo ""
echo "--- dist/ Contents ---"
ls -lh /opt/dxedge/frontend/dist/
echo ""
ls -lh /opt/dxedge/frontend/dist/assets/

echo ""
echo "--- Git Status ---"
cd /opt/dxedge && git log --oneline -5

echo ""
echo "--- world.json served correctly? ---"
curl -s http://localhost:8000/world.json | head -c 60

echo ""
echo ""
echo "--- Debug endpoint ---"
curl -s http://localhost:8000/api/debug | python3 -m json.tool

echo ""
echo "======================================"
echo "Done"
echo "======================================"
