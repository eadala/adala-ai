#!/usr/bin/env bash
# Production/staging health probe. Never logs response bodies that may contain legal data.
set -euo pipefail
BASE="${HEALTH_BASE_URL:-${STAGING_BASE_URL:-}}"
if [[ -z "$BASE" ]]; then
  echo "RESULT=BLOCKED reason=HEALTH_BASE_URL_unset"
  exit 2
fi
BASE="${BASE%/}"
code=$(curl -sS -o /tmp/rg-hc.json -w "%{http_code}" --max-time 15 "$BASE/api/healthz" || echo 000)
latency=$(curl -sS -o /dev/null -w "%{time_total}" --max-time 15 "$BASE/api/healthz" || echo 9)
echo "http_status=$code"
echo "latency_seconds=$latency"
if [[ "$code" != "200" ]]; then
  echo "RESULT=VERIFIED_FAIL"
  exit 1
fi
echo "RESULT=VERIFIED_PASS"
exit 0
