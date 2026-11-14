#!/bin/sh
# Runs every test against a throw-away demo copy of the app (sample data, no database).
# Needs: node, python3, and Playwright for node (npm i -g playwright; npx playwright install chromium).
# Use: sh tests/run-all.sh           (all tests)      sh tests/run-all.sh t120   (one test)
ROOT=$(cd "$(dirname "$0")/.." && pwd)
OUT=$(mktemp -d)
mkdir "$OUT/site" && cd "$ROOT" && cp -R . "$OUT/site" && rm -rf "$OUT/site/.git" "$OUT/site/tests"
cp "$ROOT/tests/demo-config.js" "$OUT/site/config.js"
(cd "$OUT/site" && python3 -m http.server 8765 >/dev/null 2>&1 &) ; sleep 1
export NODE_PATH="$(npm root -g 2>/dev/null)"
cd "$OUT"   # screenshots land here, not in the repo
LIST=${1:-"t1 t10 t13 t49 t80 t82 t112 t113 t114 t115 t117 t118 t119 t120 t121 t122 t123 t124 t125 t126 t127 t128 t129 t130"}
BAD=0
for t in $LIST; do
  R=$(timeout 170 node "$ROOT/tests/$t.js" 2>&1); CODE=$?
  if [ $CODE -ne 0 ] || echo "$R" | grep -qE "^\s+FAIL|^FAIL|[1-9][0-9]* failed"; then echo "FAIL $t"; echo "$R" | grep -E "FAIL|failed" | head -3; BAD=1; else echo "ok   $t"; fi
done
pkill -f "http.server 8765" 2>/dev/null
[ $BAD -eq 0 ] && echo "ALL TESTS PASSED" || echo "SOME TESTS FAILED"
exit $BAD
