#!/usr/bin/env bash
# ADALA engineering checkpoint verifier — LOCAL ONLY. Never pushes or deploys.
set -euo pipefail
PHASE_ID="${1:-}"
REF="${2:-HEAD}"
REQUIRE_EXTERNAL="${REQUIRE_EXTERNAL_BACKUP:-0}"
if [[ -z "$PHASE_ID" ]]; then
  echo "FAIL: usage: $0 <PHASE_ID> [git-ref]"
  exit 2
fi
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$ROOT" ]]; then
  echo "FAIL: not a git repository"
  exit 1
fi
cd "$ROOT"
echo "=== ADALA checkpoint-verify: $PHASE_ID @ $REF ==="
DIRTY="$(git status --porcelain || true)"
if [[ -n "$DIRTY" ]]; then
  echo "WARN: uncommitted changes present"
fi
if ! git rev-parse --verify "${REF}^{commit}" >/dev/null 2>&1; then
  echo "FAIL: missing commit object for $REF"
  exit 1
fi
COMMIT="$(git rev-parse "$REF")"
TREE="$(git rev-parse "${REF}^{tree}")"
echo "COMMIT=$COMMIT"
echo "TREE=$TREE"
if [[ "$(git rev-parse --is-shallow-repository)" == "true" ]]; then
  echo "FAIL: shallow repository"
  exit 1
fi
SUSPECT=0
while IFS= read -r f; do
  case "$f" in
    .env|*/.env|*.pem|*/id_rsa|*.dump|*/baseline-capture.txt)
      echo "FAIL_PATH_HEURISTIC: $f"
      SUSPECT=1
      ;;
  esac
done < <(git ls-tree -r --name-only "$REF")
if [[ "$SUSPECT" -ne 0 ]]; then
  echo "RESULT=FAIL"
  exit 1
fi
MIG_COUNT="$(git ls-tree -r --name-only "$REF" | grep -c 'artifacts/api-server/migrations/.*\.sql$' || true)"
echo "MIGRATION_SQL_FILES=$MIG_COUNT"
echo "OFF_ENVIRONMENT_BACKUP=MISSING"
if [[ "$REQUIRE_EXTERNAL" == "1" ]]; then
  echo "FAIL: REQUIRE_EXTERNAL_BACKUP=1 and external backup not verified"
  echo "RESULT=FAIL"
  exit 1
fi
echo "RESULT=LOCAL_CHECKPOINT_VERIFIED"
echo "NOTE: never claims EXTERNAL_BACKUP_VERIFIED or DISASTER_RECOVERY_TESTED"
exit 0
