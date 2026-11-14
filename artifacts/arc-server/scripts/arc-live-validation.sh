#!/usr/bin/env bash
# ARC controlled live validation — READ-ONLY
# Directive: ARC-LIVE-HANDOFF-001
#
# DOES NOT RUN LIVE CHECKS unless:
#   ARC_LIVE_VALIDATION_AUTHORIZED=true
#
# Never prints secret values. Never calls deploy/mutation endpoints.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPORT_DIR="${ARC_LIVE_EVIDENCE_DIR:-/tmp/arc-live-evidence}"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
REPORT="${REPORT_DIR}/arc-live-validation-${TS}.md"
BASE_URL="${ARC_BASE_URL:-http://127.0.0.1:8787}"

mkdir -p "$REPORT_DIR"

redact() {
  sed -E \
    -e 's/(Bearer )[A-Za-z0-9._\-]+/\1[REDACTED]/gi' \
    -e 's/(ghp_|gho_|ghu_|ghs_|ghr_)[A-Za-z0-9_]+/[REDACTED]/g' \
    -e 's/("ARC_GITHUB_TOKEN"[[:space:]]*:[[:space:]]*")[^"]*"/\1[REDACTED]"/g' \
    -e 's/("ARC_GITHUB_APP_PRIVATE_KEY"[[:space:]]*:[[:space:]]*")[^"]*"/\1[REDACTED]"/g'
}

echo "# ARC Live Validation Evidence" >"$REPORT"
echo "" >>"$REPORT"
echo "- generated_at_utc: ${TS}" >>"$REPORT"
echo "- base_url: ${BASE_URL}" >>"$REPORT"
echo "- authorized: ${ARC_LIVE_VALIDATION_AUTHORIZED:-false}" >>"$REPORT"
echo "- deployment_execution: DISABLED (script refuses deploy routes)" >>"$REPORT"
echo "" >>"$REPORT"

if [[ "${ARC_LIVE_VALIDATION_AUTHORIZED:-}" != "true" ]]; then
  cat <<EOF | tee -a "$REPORT"
## Status: NOT EXECUTED — AUTHORIZATION REQUIRED

Set the following only after human approval documented in ARC_LIVE_INTEGRATION_CHECKLIST.md:

\`\`\`bash
export ARC_LIVE_VALIDATION_AUTHORIZED=true
# plus live OIDC/GitHub env from secret store (never echo secrets)
\`\`\`

Then re-run:

\`\`\`bash
./artifacts/arc-server/scripts/arc-live-validation.sh
\`\`\`

Dry-run complete. No live provider calls were made.
EOF
  echo "Report: $REPORT"
  exit 0
fi

echo "## Preflight (authorized)" >>"$REPORT"

# Local regression still required
(
  cd "$ROOT"
  pnpm test 2>&1 | tail -20
) | redact | tee -a "$REPORT" >/dev/null || {
  echo "SECURITY_TESTS: FAILED" | tee -a "$REPORT"
  exit 1
}

echo "" >>"$REPORT"
echo "## Healthz (redacted)" >>"$REPORT"
curl -fsS "${BASE_URL}/api/arc/healthz" | redact >>"$REPORT" || {
  echo "healthz unreachable — start ARC on ARC_PORT/base URL first" | tee -a "$REPORT"
  exit 1
}

echo "" >>"$REPORT"
echo "## Integration config (must already redact secrets server-side)" >>"$REPORT"
curl -fsS "${BASE_URL}/api/arc/integration/config" | redact >>"$REPORT"

echo "" >>"$REPORT"
echo "## Integration harness" >>"$REPORT"
HARNESS="$(curl -fsS "${BASE_URL}/api/arc/integration/harness" | redact)"
echo "$HARNESS" >>"$REPORT"

# Refuse deploy paths
echo "" >>"$REPORT"
echo "## Deployment isolation probes (expect 403)" >>"$REPORT"
for path in \
  /api/arc/deployments/execute \
  /api/arc/webhooks/deploy \
  /api/arc/jobs/deploy \
  /api/arc/internal/execute-deploy
do
  code="$(curl -sS -o /dev/null -w '%{http_code}' -X POST "${BASE_URL}${path}" \
    -H 'content-type: application/json' -d '{}' || true)"
  echo "- POST ${path} → HTTP ${code}" >>"$REPORT"
  if [[ "$code" != "401" && "$code" != "403" ]]; then
    echo "FAIL: unexpected status ${code} for ${path}" | tee -a "$REPORT"
    exit 1
  fi
done

echo "" >>"$REPORT"
echo "## Classification rules" >>"$REPORT"
echo "- Accept VERIFIED_LIVE_TEST only for cases actually live-exercised." >>"$REPORT"
echo "- Fixture results must remain VERIFIED_FIXTURE / not relabeled." >>"$REPORT"
echo "- Coolify production must remain NOT_CONNECTED." >>"$REPORT"
echo "" >>"$REPORT"
echo "## End" >>"$REPORT"
echo "Report: $REPORT"
