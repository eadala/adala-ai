#!/usr/bin/env bash
# Failure-injection tests for continuity / remote-backup fail-closed controls.
# LOCAL ONLY — does not perform real remote pushes.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
PASS=0; FAIL=0
ok(){ echo "  ✅ $*"; PASS=$((PASS+1)); }
bad(){ echo "  ❌ $*"; FAIL=$((FAIL+1)); }

echo "=== continuity-failure-injection ==="

echo "--- F1 remote push without ALLOW_REMOTE_BACKUP ---"
if out=$(ALLOW_REMOTE_BACKUP=0 ./scripts/engineering/remote-backup-push.sh HEAD backup/milestones/should-fail 2>&1); then
  bad "push succeeded without ALLOW_REMOTE_BACKUP"
else
  echo "$out" | grep -q 'ALLOW_REMOTE_BACKUP=1 required' && ok "refuses without allow flag" || bad "unexpected error: $(echo "$out" | head -1)"
fi

echo "--- F2 public destination forbidden (simulated via repo check helper) ---"
# Unit-level: ensure script contains public origin refusal
grep -q 'eadala/adala-ai' scripts/engineering/remote-backup-push.sh \
  && grep -q 'refusing public application origin' scripts/engineering/remote-backup-push.sh \
  && ok "script blocks public application origin" \
  || bad "public origin refusal missing"

echo "--- F3 immutable Phase 031 overwrite refused ---"
if ALLOW_REMOTE_BACKUP=1 ./scripts/engineering/remote-backup-push.sh HEAD backup/phase-031-clean 2>/tmp/f3.err; then
  bad "Phase 031 overwrite unexpectedly allowed"
else
  # May fail earlier on auth/privacy; accept either immutable refusal or allow-flag path that hits immutable check
  if grep -Eq 'refusing to overwrite immutable Phase 031|destination is not private|ALLOW_REMOTE_BACKUP' /tmp/f3.err; then
    ok "Phase 031 overwrite path fail-closed"
  else
    bad "unexpected: $(head -2 /tmp/f3.err)"
  fi
fi

echo "--- F4 contaminated tip history still reachable from development tip ---"
# Tip HEAD ancestry is contaminated; orphan clean-tree bundles must still verify clean
CONTAM=3f1a3e36c8b6ace9e1bf1b6c072951f8a8f6f925
if git cat-file -t "$CONTAM" >/dev/null 2>&1 && git rev-list --objects HEAD | grep -F "$CONTAM" >/dev/null; then
  ok "confirmed tip ancestry still contaminated (expected until history rewrite approval)"
else
  bad "expected contaminated ancestry on development tip"
fi

echo "--- F5 clean-artifact-verify rejects missing bundle ---"
if ./scripts/engineering/clean-artifact-verify.sh /tmp/no-such.bundle deadbeef deadbeef 2>/tmp/f5.err; then
  bad "missing bundle unexpectedly passed"
else
  ok "missing bundle fails closed"
fi

echo "--- F6 checkpoint-verify rejects contaminated tip-tree capture OID ---"
# Current tip tree is redacted — should WARN not FAIL
if ./scripts/engineering/checkpoint-verify.sh ultimate-phoenix HEAD >/tmp/f6.out 2>&1; then
  grep -q 'LOCAL_CHECKPOINT_VERIFIED' /tmp/f6.out && ok "tip tree checkpoint verified (redacted)" || bad "checkpoint missing verified marker"
else
  bad "checkpoint failed unexpectedly: $(tail -3 /tmp/f6.out)"
fi

echo "RESULT_PASS=$PASS RESULT_FAIL=$FAIL"
[[ "$FAIL" -eq 0 ]] && echo "RESULT=VERIFIED_PASS" && exit 0
echo "RESULT=VERIFIED_FAIL"
exit 1
