#!/usr/bin/env bash
# Isolated end-to-end CD simulation — never calls Coolify; never activates prod.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
PASS=0; FAIL=0
ok(){ echo "  ✅ $*"; PASS=$((PASS+1)); }
bad(){ echo "  ❌ $*"; FAIL=$((FAIL+1)); }

echo "=== cd-simulate-pipeline ==="

export CD_SIMULATION=1
export ADALA_CD_KILL_SWITCH=0
export ADALA_CREDENTIAL_INCIDENT_CLEARED=false
export ADALA_CD_ACTIVE=false

echo "--- S1 preflight blocks when credential uncleared ---"
if ./scripts/cd/preflight.sh HEAD >/tmp/cd-s1.json 2>&1; then
  bad "preflight unexpectedly passed"
else
  grep -q credential_incident_not_cleared /tmp/cd-s1.json && ok "preflight blocks uncleared credential" || bad "missing credential blocker"
fi

echo "--- S2 kill switch blocks ---"
if ADALA_CD_KILL_SWITCH=1 ADALA_CREDENTIAL_INCIDENT_CLEARED=true ./scripts/cd/preflight.sh HEAD >/tmp/cd-s2.json 2>&1; then
  bad "kill switch did not block"
else
  grep -q kill_switch_active /tmp/cd-s2.json && ok "kill switch blocks" || bad "kill switch missing"
fi

echo "--- S3 contaminated history blocks ---"
if ADALA_CREDENTIAL_INCIDENT_CLEARED=true ADALA_CD_KILL_SWITCH=0 ./scripts/cd/preflight.sh HEAD >/tmp/cd-s3.json 2>&1; then
  bad "contaminated history unexpectedly allowed"
else
  grep -q contaminated_history_reachable /tmp/cd-s3.json && ok "contaminated history blocks" || bad "contam blocker missing"
fi

echo "--- S4 trigger blocked when CD inactive (no simulation) ---"
if env -u CD_SIMULATION ADALA_CREDENTIAL_INCIDENT_CLEARED=true ADALA_CD_ACTIVE=false ADALA_CD_KILL_SWITCH=0 \
  ./scripts/cd/trigger-coolify.sh >/tmp/cd-s4.out 2>&1; then
  bad "trigger ran without activation unexpectedly"
else
  grep -q cd_not_activated /tmp/cd-s4.out && ok "trigger blocked when CD inactive" || bad "expected cd_not_activated: $(head -2 /tmp/cd-s4.out)"
fi

echo "--- S5 simulated trigger path ---"
if CD_SIMULATION=1 ADALA_CREDENTIAL_INCIDENT_CLEARED=true ADALA_CD_ACTIVE=true ADALA_CD_KILL_SWITCH=0 \
  ./scripts/cd/trigger-coolify.sh >/tmp/cd-s5.out 2>&1; then
  grep -q SIMULATED_DEPLOY /tmp/cd-s5.out && ok "simulation deploy path" || bad "missing SIMULATED_DEPLOY"
else
  bad "simulation trigger failed: $(cat /tmp/cd-s5.out)"
fi

echo "--- S6 post-deploy without URL blocked ---"
if ./scripts/cd/post-deploy-verify.sh >/tmp/cd-s6.out 2>&1; then
  bad "post-deploy passed without URL"
else
  grep -q BLOCKED /tmp/cd-s6.out && ok "post-deploy BLOCKED without URL" || bad "post-deploy unexpected"
fi

echo "--- S7 release registry retains 3 ---"
REG=release-guardian/releases/registry.json
cp "$REG" /tmp/cd-registry-backup.json
trap 'cp /tmp/cd-registry-backup.json "$REG"' EXIT
node scripts/cd/release-registry.mjs record --commit aaa --digest d1 --status success >/dev/null
node scripts/cd/release-registry.mjs record --commit bbb --digest d2 --status success >/dev/null
node scripts/cd/release-registry.mjs record --commit ccc --digest d3 --status success >/dev/null
node scripts/cd/release-registry.mjs record --commit ddd --digest d4 --status success >/dev/null
count=$(node -e "console.log(JSON.parse(require('fs').readFileSync('release-guardian/releases/registry.json','utf8')).releases.length)")
[[ "$count" == "3" ]] && ok "registry retains 3" || bad "registry count=$count"
node scripts/cd/release-registry.mjs previous >/tmp/cd-prev.json
grep -q '"digest": "d3"' /tmp/cd-prev.json && ok "previous release points to d3" || bad "previous mismatch"
cp /tmp/cd-registry-backup.json "$REG"
trap - EXIT

echo "--- S8 emergency stop instructions ---"
./scripts/cd/emergency-stop.sh >/tmp/cd-s8.out
grep -q ADALA_CD_KILL_SWITCH /tmp/cd-s8.out && ok "emergency stop instructions" || bad "emergency stop missing"

echo "--- S9 backup gate blocks when uncleared ---"
if ADALA_CREDENTIAL_INCIDENT_CLEARED=true ADALA_CD_KILL_SWITCH=0 ADALA_DB_BACKUP_VERIFIED=false \
  ./scripts/cd/preflight.sh HEAD >/tmp/cd-s9.json 2>&1; then
  bad "preflight passed without backup verification"
else
  grep -q db_backup_not_verified /tmp/cd-s9.json && ok "backup gate blocks" || bad "backup gate missing"
fi

echo "RESULT_PASS=$PASS RESULT_FAIL=$FAIL"
[[ "$FAIL" -eq 0 ]] && echo "RESULT=VERIFIED_PASS" && exit 0
echo "RESULT=VERIFIED_FAIL"
exit 1
