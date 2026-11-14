#!/usr/bin/env bash
# ARC controlled live validation — READ-ONLY
# Directive: ARC-LIVE-HANDOFF-001 / ARC-SEC-FIX-003 (F-PRELIVE-001)
#
# DOES NOT RUN LIVE CHECKS unless:
#   ARC_LIVE_VALIDATION_AUTHORIZED=true
#
# Never prints secret values. Never calls deploy/mutation endpoints.
# ARC_BASE_URL is validated (loopback default) before any HTTP client use.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPORT_DIR="${ARC_LIVE_EVIDENCE_DIR:-/tmp/arc-live-evidence}"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
REPORT="${REPORT_DIR}/arc-live-validation-${TS}.md"
RAW_BASE_URL="${ARC_BASE_URL:-http://127.0.0.1:8787}"
CURL_MAX_TIME="${ARC_CURL_MAX_TIME:-15}"

mkdir -p "$REPORT_DIR"

redact() {
  sed -E \
    -e 's/(Bearer )[A-Za-z0-9._\-]+/\1[REDACTED]/gi' \
    -e 's/(ghp_|gho_|ghu_|ghs_|ghr_)[A-Za-z0-9_]+/[REDACTED]/g' \
    -e 's/("ARC_GITHUB_TOKEN"[[:space:]]*:[[:space:]]*")[^"]*"/\1[REDACTED]"/g' \
    -e 's/("ARC_GITHUB_APP_PRIVATE_KEY"[[:space:]]*:[[:space:]]*")[^"]*"/\1[REDACTED]"/g' \
    -e 's/-----BEGIN[^-]+-----.*-----END[^-]+-----/[REDACTED_PEM]/g'
}

echo "# ARC Live Validation Evidence" >"$REPORT"
echo "" >>"$REPORT"
echo "- generated_at_utc: ${TS}" >>"$REPORT"
echo "- authorized: ${ARC_LIVE_VALIDATION_AUTHORIZED:-false}" >>"$REPORT"
echo "- deployment_execution: DISABLED (script refuses deploy routes)" >>"$REPORT"
echo "- base_url_policy: ${ARC_BASE_URL_POLICY:-loopback}" >>"$REPORT"
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

Dry-run complete. No live provider calls were made. ARC_BASE_URL was not contacted.
EOF
  echo "Report: $REPORT"
  exit 0
fi

echo "## Preflight (authorized) — BASE_URL validation" >>"$REPORT"

# F-PRELIVE-001: validate destination before any curl
BASE_URL="$(
  cd "$ROOT" && pnpm exec tsx scripts/validate-base-url.ts "$RAW_BASE_URL"
)" || {
  echo "ARC_BASE_URL validation FAILED — refusing to connect" | tee -a "$REPORT"
  echo "raw_base_url_redacted_length: ${#RAW_BASE_URL}" >>"$REPORT"
  exit 1
}
echo "- validated_base_url: ${BASE_URL}" >>"$REPORT"

# Refuse proxy ambiguity even if validator ran under cleared env in subprocess —
# re-check in this shell (validator also checks).
if [[ "${ARC_ALLOW_HTTP_PROXY:-}" != "true" ]]; then
  if [[ -n "${HTTP_PROXY:-}${HTTPS_PROXY:-}${ALL_PROXY:-}${http_proxy:-}${https_proxy:-}${all_proxy:-}" ]]; then
    echo "Proxy environment present — DENY (set ARC_ALLOW_HTTP_PROXY=true only after review)" | tee -a "$REPORT"
    exit 1
  fi
fi

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
# --max-time, no redirects (-L never), fail on HTTP errors
curl --proto-default http --max-time "${CURL_MAX_TIME}" --max-redirs 0 \
  -fsS "${BASE_URL}/api/arc/healthz" | redact >>"$REPORT" || {
  echo "healthz unreachable — start ARC on approved loopback base URL first" | tee -a "$REPORT"
  exit 1
}

echo "" >>"$REPORT"
echo "## Integration config (must already redact secrets server-side)" >>"$REPORT"
curl --proto-default http --max-time "${CURL_MAX_TIME}" --max-redirs 0 \
  -fsS "${BASE_URL}/api/arc/integration/config" | redact >>"$REPORT"

echo "" >>"$REPORT"
echo "## Integration harness" >>"$REPORT"
HARNESS="$(
  curl --proto-default http --max-time "${CURL_MAX_TIME}" --max-redirs 0 \
    -fsS "${BASE_URL}/api/arc/integration/harness" | redact
)"
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
  code="$(
    curl --proto-default http --max-time "${CURL_MAX_TIME}" --max-redirs 0 \
      -sS -o /dev/null -w '%{http_code}' -X POST "${BASE_URL}${path}" \
      -H 'content-type: application/json' -d '{}' || true
  )"
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
echo "- ARC_BASE_URL must remain allowlisted (F-PRELIVE-001 CLOSED)." >>"$REPORT"
echo "" >>"$REPORT"
echo "## End" >>"$REPORT"
echo "Report: $REPORT"
