#!/usr/bin/env bash
# Emergency stop helper — documents how to halt CD without code deploy.
# Does not modify production by itself.
set -euo pipefail
echo "=== ADALA CD emergency stop ==="
echo "1) Set GitHub Actions variable/secret ADALA_CD_KILL_SWITCH=1"
echo "2) Set ADALA_CD_ACTIVE=false (or unset)"
echo "3) In Coolify: disable automatic deployments / pause application"
echo "4) Optional: rotate COOLIFY_DEPLOY_WEBHOOK_URL"
echo "RESULT=INSTRUCTIONS_PRINTED"
echo "NOTE: This script does not call Coolify or GitHub APIs."
exit 0
