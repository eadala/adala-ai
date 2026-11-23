#!/usr/bin/env bash
# ADALA engineering checkpoint verifier — LOCAL ONLY. Never pushes or deploys.
set -euo pipefail
PHASE_ID="${1:-}"
REF="${2:-HEAD}"
if [[ -z "$PHASE_ID" ]]; then
  echo "FAIL: usage: $0 <PHASE_ID> [git-ref]"
  exit 2
fi
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
echo "=== ADALA checkpoint-verify: $PHASE_ID @ $REF ==="
DIRTY="$(git status --porcelain)"
if [[ -n "$DIRTY" ]]; then
  echo "WARN: uncommitted changes present (not a PASS blocker for verify-only)"
fi
COMMIT="$(git rev-parse "$REF")"
TREE="$(git rev-parse "${REF}^{tree}")"
PARENTS="$(git rev-parse "${REF}^@" 2>/dev/null || true)"
echo "COMMIT=$COMMIT"
echo "TREE=$TREE"
echo "PARENTS=$PARENTS"
git cat-file -t "$COMMIT" >/dev/null
git rev-parse --verify "${REF}^{commit}" >/dev/null
# Fail closed on shallow
if [[ "$(git rev-parse --is-shallow-repository)" == "true" ]]; then
  echo "FAIL: shallow repository — incomplete ancestry"
  exit 1
fi
# Secret path heuristics (names only); do not print file contents
SUSPECT=0
while IFS= read -r f; do
  case "$f" in
    *.env|*/.env|*.pem|*/id_rsa|*.dump|*/baseline-capture.txt)
      echo "FAIL_PATH_HEURISTIC: $f present in tree $REF"
      SUSPECT=1
      ;;
  esac
done < <(git ls-tree -r --name-only "$REF")
if [[ "$SUSPECT" -ne 0 ]]; then
  echo "RESULT=FAIL secret-path heuristic"
  exit 1
fi
MIG_COUNT="$(git ls-tree -r --name-only "$REF" | grep -c 'artifacts/api-server/migrations/.*\.sql$' || true)"
echo "MIGRATION_SQL_FILES=$MIG_COUNT"
echo "OFF_ENVIRONMENT_BACKUP=MISSING (script never claims external PASS)"
echo "RESULT=LOCAL_CHECKPOINT_VERIFIED"
echo "NOTE: EXTERNAL_BACKUP_VERIFIED and DISASTER_RECOVERY_TESTED require separate authorized tests"
exit 0
