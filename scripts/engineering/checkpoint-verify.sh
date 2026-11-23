#!/usr/bin/env bash
# ADALA engineering checkpoint verifier — LOCAL ONLY. Never pushes or deploys.
set -euo pipefail
PHASE_ID="${1:-}"
REF="${2:-HEAD}"
REQUIRE_EXTERNAL="${REQUIRE_EXTERNAL_BACKUP:-0}"
CONTAM_BLOB="${CONTAMINATED_BLOB_OID:-3f1a3e36c8b6ace9e1bf1b6c072951f8a8f6f925}"
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
    .env|*/.env|*.pem|*/id_rsa|*.dump)
      echo "FAIL_PATH_HEURISTIC: $f"
      SUSPECT=1
      ;;
    */baseline-capture.txt|baseline-capture.txt)
      BLOB="$(git rev-parse "${REF}:${f}" 2>/dev/null || true)"
      if [[ "$BLOB" == "$CONTAM_BLOB" ]]; then
        echo "FAIL_CONTAMINATED_BASELINE_CAPTURE: $f oid=$BLOB"
        SUSPECT=1
      else
        echo "WARN_BASELINE_CAPTURE_PRESENT_REDACTED_OR_SAFE: $f oid=$BLOB"
      fi
      ;;
  esac
done < <(git ls-tree -r --name-only "$REF")

# Tip tree must not contain the known contaminated blob as any path content
if git ls-tree -r "$REF" | awk '{print $3}' | grep -qx "$CONTAM_BLOB"; then
  echo "FAIL: contaminated blob present in tip tree"
  SUSPECT=1
fi

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
