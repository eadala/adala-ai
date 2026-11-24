#!/usr/bin/env bash
# Staging smoke tests against a live base URL.
# Usage: STAGING_BASE_URL=https://staging.example ./scripts/release-guardian/smoke-staging.sh
# Fail-closed: missing URL => BLOCKED (exit 2), not PASS.
set -euo pipefail
BASE="${STAGING_BASE_URL:-}"
if [[ -z "$BASE" ]]; then
  echo "RESULT=BLOCKED reason=STAGING_BASE_URL_unset"
  exit 2
fi
BASE="${BASE%/}"
PASS=0; FAIL=0
ok(){ echo "  ✅ $*"; PASS=$((PASS+1)); }
bad(){ echo "  ❌ $*"; FAIL=$((FAIL+1)); }

echo "=== staging-smoke BASE=$BASE ==="

code=$(curl -sS -o /tmp/rg-health.json -w "%{http_code}" --max-time 20 "$BASE/api/healthz" || echo 000)
if [[ "$code" == "200" ]] && grep -q '"ok":\s*true\|"status":\s*"healthy"' /tmp/rg-health.json; then
  ok "healthz 200"
else
  bad "healthz code=$code body=$(head -c 200 /tmp/rg-health.json 2>/dev/null || true)"
fi

# Unauthenticated sensitive routes must not return 200 with data
for path in /api/cases /api/clients /api/ai/query; do
  c=$(curl -sS -o /tmp/rg-auth.json -w "%{http_code}" --max-time 20 -X GET "$BASE$path" || echo 000)
  if [[ "$c" == "401" || "$c" == "403" || "$c" == "404" || "$c" == "405" ]]; then
    ok "$path fail-closed ($c)"
  elif [[ "$c" == "200" ]]; then
    bad "$path returned 200 without auth"
  else
    ok "$path non-open status $c"
  fi
done

echo "RESULT_PASS=$PASS RESULT_FAIL=$FAIL"
if [[ "$FAIL" -ne 0 ]]; then
  echo "RESULT=VERIFIED_FAIL"
  exit 1
fi
echo "RESULT=VERIFIED_PASS"
exit 0
