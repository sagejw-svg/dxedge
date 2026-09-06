#!/usr/bin/env bash
# Both suites. The first needs nothing; the second needs playwright and a server.
set -u
cd "$(dirname "$0")/.."
echo "== regression suite (no browser) =="
node test/regress.mjs
REG=$?
echo
echo "== browser smoke test =="
if node --input-type=module -e "await import('playwright')" >/dev/null 2>&1; then
  python3 -m http.server 8080 >/dev/null 2>&1 &
  SRV=$!
  sleep 1
  node test/smoke.mjs
  SMOKE=$?
  echo
  echo "== console layout sweep =="
  node test/layout.mjs
  SMOKE=$(( SMOKE || $? ))
  kill $SRV 2>/dev/null
else
  echo "SKIP  playwright not importable from here; run test/smoke.mjs where it is"
  SMOKE=0
fi
exit $(( REG || SMOKE ))
