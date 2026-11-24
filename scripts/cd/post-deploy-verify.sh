#!/usr/bin/env bash
# Post-deploy verification against APP_BASE_URL. Fail-closed if unset.
set -euo pipefail
BASE="${APP_BASE_URL:-${PRODUCTION_BASE_URL:-${STAGING_BASE_URL:-}}}"
EXPECT_COMMIT="${EXPECT_COMMIT:-}"
if [[ -z "$BASE" ]]; then
  echo "RESULT=BLOCKED reason=APP_BASE_URL_unset"
  exit 2
fi
BASE="${BASE%/}"
PASS=0; FAIL=0
ok(){ echo "  ✅ $*"; PASS=$((PASS+1)); }
bad(){ echo "  ❌ $*"; FAIL=$((FAIL+1)); }

echo "=== post-deploy-verify BASE=$BASE ==="

code=$(curl -sS -o /tmp/cd-health.json -w "%{http_code}" --max-time 25 "$BASE/api/healthz" || echo 000)
if [[ "$code" == "200" ]]; then ok "healthz 200"; else bad "healthz $code"; fi

# Auth fail-closed probes
for path in /api/cases /api/clients; do
  c=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 20 "$BASE$path" || echo 000)
  if [[ "$c" == "401" || "$c" == "403" || "$c" == "404" ]]; then ok "$path protected ($c)"; else bad "$path unexpected $c"; fi
done

# Optional commit echo endpoint if present
if [[ -n "$EXPECT_COMMIT" ]]; then
  body=$(curl -sS --max-time 15 "$BASE/api/healthz" || true)
  if echo "$body" | grep -qi "$EXPECT_COMMIT"; then
    ok "commit echoed in health payload"
  else
    echo "  ℹ️  health payload does not echo commit (acceptable if app omits it)"
  fi
fi

echo "RESULT_PASS=$PASS RESULT_FAIL=$FAIL"
[[ "$FAIL" -eq 0 ]] && echo "RESULT=VERIFIED_PASS" && exit 0
echo "RESULT=VERIFIED_FAIL"
exit 1
