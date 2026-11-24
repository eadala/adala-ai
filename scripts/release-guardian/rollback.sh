#!/usr/bin/env bash
# Controlled application-image rollback helper for Coolify.
# Does NOT reverse database migrations. Does NOT run unless ROLLBACK_CONFIRM=YES.
set -euo pipefail
PREV_DIGEST="${ROLLBACK_IMAGE_DIGEST:-}"
COOLIFY_APP="${COOLIFY_APP_UUID:-}"
COOLIFY_TOKEN="${COOLIFY_API_TOKEN:-}"
COOLIFY_URL="${COOLIFY_API_URL:-}"

echo "=== release-guardian rollback ==="
echo "policy: application_image_only=true; never_auto_reverse_migrations=true"

if [[ -z "$PREV_DIGEST" ]]; then
  echo "RESULT=BLOCKED reason=missing_ROLLBACK_IMAGE_DIGEST"
  exit 2
fi
if [[ "${ROLLBACK_CONFIRM:-}" != "YES" ]]; then
  echo "DRY_RUN: would request Coolify redeploy of digest=$PREV_DIGEST app=$COOLIFY_APP"
  echo "RESULT=BLOCKED reason=ROLLBACK_CONFIRM_not_YES"
  exit 2
fi
if [[ -z "$COOLIFY_APP" || -z "$COOLIFY_TOKEN" || -z "$COOLIFY_URL" ]]; then
  echo "RESULT=BLOCKED reason=missing_coolify_credentials"
  exit 2
fi

echo "FAIL-CLOSED: live Coolify rollback API call is intentionally not hard-coded."
echo "Owner/ops must map digest=$PREV_DIGEST to the previous known-good Coolify deployment"
echo "via Coolify UI or approved API after verifying migrations were non-destructive."
echo "RESULT=BLOCKED reason=requires_human_coolify_mapping"
exit 2
