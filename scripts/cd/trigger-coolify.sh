#!/usr/bin/env bash
# CI-controlled Coolify deploy trigger. Never prints secrets.
# Requires: COOLIFY_DEPLOY_WEBHOOK_URL (or API trio). Honors kill switch + CD_SIMULATION.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

if [[ "${ADALA_CD_KILL_SWITCH:-}" == "1" || "${ADALA_CD_KILL_SWITCH:-}" == "true" ]]; then
  echo "RESULT=BLOCKED reason=kill_switch"
  exit 2
fi
if [[ "${ADALA_CREDENTIAL_INCIDENT_CLEARED:-}" != "true" && "${ADALA_CREDENTIAL_INCIDENT_CLEARED:-}" != "1" ]]; then
  echo "RESULT=BLOCKED reason=credential_incident_not_cleared"
  exit 2
fi
if [[ "${CD_SIMULATION:-}" == "1" ]]; then
  echo "RESULT=SIMULATED_DEPLOY commit=$(git rev-parse HEAD)"
  echo "NOTE: no Coolify webhook called"
  exit 0
fi
if [[ "${ADALA_CD_ACTIVE:-}" != "true" && "${ADALA_CD_ACTIVE:-}" != "1" ]]; then
  echo "RESULT=BLOCKED reason=cd_not_activated"
  exit 2
fi

URL="${COOLIFY_DEPLOY_WEBHOOK_URL:-}"
if [[ -z "$URL" ]]; then
  echo "RESULT=BLOCKED reason=missing_COOLIFY_DEPLOY_WEBHOOK_URL"
  exit 2
fi

# Redact URL credentials in logs
SAFE_URL="$(echo "$URL" | sed -E 's#://([^:@/]+):([^@/]+)@#://***:***@#; s/([?&](token|key|secret)=)[^&]*/\1***/gi')"
echo "TRIGGERING Coolify webhook (redacted)=$SAFE_URL"
code=$(curl -sS -o /tmp/coolify-deploy.out -w "%{http_code}" -X POST "$URL" --max-time 60 || echo 000)
echo "http_status=$code"
if [[ "$code" != "200" && "$code" != "201" && "$code" != "204" ]]; then
  echo "RESULT=VERIFIED_FAIL"
  exit 1
fi
echo "RESULT=VERIFIED_PASS"
exit 0
