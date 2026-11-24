#!/usr/bin/env bash
# Start-of-session continuity: identity, HEAD, latest checkpoint, blockers.
# LOCAL ONLY — does not push, deploy, or modify remotes.
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
STATE="docs/engineering/continuity/ENGINEERING_STATE.json"
echo "=== ADALA session-continuity ==="
echo "REPO_ROOT=$ROOT"
echo "REMOTE_ORIGIN=$(git remote get-url origin 2>/dev/null | sed -E 's#https://[^@]+@#https://#')"
echo "BRANCH=$(git branch --show-current)"
echo "HEAD=$(git rev-parse HEAD)"
echo "TREE=$(git rev-parse 'HEAD^{tree}')"
DIRTY="$(git status --porcelain || true)"
if [[ -n "$DIRTY" ]]; then
  echo "WORKING_TREE=DIRTY"
  echo "$DIRTY" | head -40
else
  echo "WORKING_TREE=CLEAN"
fi
if [[ -f "$STATE" ]]; then
  echo "ENGINEERING_STATE=$STATE"
  python3 - "$STATE" <<'PY'
import json,sys
d=json.load(open(sys.argv[1],encoding="utf-8"))
for k in ("last_verified_milestone","last_local_backup","last_remotely_verified_backup","test_status","security_status","known_blockers","next_executable_task"):
  v=d.get(k)
  print(f"{k.upper()}={v if not isinstance(v,list) else '; '.join(map(str,v))}")
PY
else
  echo "ENGINEERING_STATE=MISSING"
fi
LATEST_BUNDLE="$(ls -1t docs/engineering/continuity/artifacts/*.bundle 2>/dev/null | head -1 || true)"
if [[ -n "$LATEST_BUNDLE" ]]; then
  echo "LATEST_LOCAL_BUNDLE=$LATEST_BUNDLE"
else
  echo "LATEST_LOCAL_BUNDLE=NONE"
fi
echo "PHASE_031_BACKUP_HINT=adalahai/adala-ai-private-recovery-2026@backup/phase-031-clean"
echo "RESULT=SESSION_CONTINUITY_READ"
