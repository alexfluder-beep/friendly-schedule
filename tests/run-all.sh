#!/bin/sh
export TZ=UTC   # tests make dates with toISOString (UTC); the browser must use the same clock or tests fail 00:00-04:00 Tbilisi time (18 Nov)
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
LIST=${1:-"t1 t10 t13 t49 t80 t82 t112 t113 t114 t115 t117 t118 t119 t120 t121 t122 t123 t124 t125 t126 t127 t128 t129 t130 t131 t132 t133 t134 t135 t136 t137 t138 t139 t140 t141 t142 t143 t144 t145 t146 t147 t148 t149 t150 t151 t152 t153 t154 t155 t156 t157 t158 t159 t160 t161 t162 t163 t164 t165 t166 t167 t168 t169 t170 t171 t172 t173 t174 t175 t176 t177 t178 t179 t180 t181 t182 t183 t184 t185 t186"}
BAD=0
for t in $LIST; do
  R=$(timeout 170 node "$ROOT/tests/$t.js" 2>&1); CODE=$?
  if [ $CODE -ne 0 ] || echo "$R" | grep -qE "^\s+FAIL|^FAIL|[1-9][0-9]* failed"; then echo "FAIL $t"; echo "$R" | grep -E "FAIL|failed" | head -3; BAD=1; else echo "ok   $t"; fi
done
pkill -f "http.server 8765" 2>/dev/null
[ $BAD -eq 0 ] && echo "ALL TESTS PASSED" || echo "SOME TESTS FAILED"
exit $BAD
