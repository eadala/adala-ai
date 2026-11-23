#!/usr/bin/env bash
# Local milestone preservation — never pushes unless ALLOW_REMOTE_BACKUP=1 and authorized.
set -euo pipefail
MILESTONE="${1:-}"
REF="${2:-HEAD}"
if [[ -z "$MILESTONE" ]]; then
  echo "FAIL: usage: $0 <milestone-id> [git-ref]"
  exit 2
fi
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

echo "=== milestone-preserve: $MILESTONE @ $REF ==="
./scripts/engineering/checkpoint-verify.sh "$MILESTONE" "$REF"

COMMIT="$(git rev-parse "$REF")"
TREE="$(git rev-parse "${REF}^{tree}")"
SAFE_NAME="$(echo "$MILESTONE" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9._-')"
OUT_DIR="docs/engineering/continuity/artifacts"
EXT_DIR="/opt/cursor/artifacts/adala-backups"
mkdir -p "$OUT_DIR" "$EXT_DIR"
BUNDLE_NAME="${SAFE_NAME}-${COMMIT:0:12}.bundle"
BUNDLE="$OUT_DIR/$BUNDLE_NAME"
REFNAME="refs/backup/milestones/${SAFE_NAME}-${COMMIT:0:12}"

git update-ref "$REFNAME" "$COMMIT"
# Standalone tip bundle (includes reachable history from tip).
git bundle create "$BUNDLE" "$REFNAME"
cp -f "$BUNDLE" "$EXT_DIR/$BUNDLE_NAME"
sha256sum "$BUNDLE" | tee "${BUNDLE}.sha256"
cp -f "${BUNDLE}.sha256" "$EXT_DIR/${BUNDLE_NAME}.sha256"
./scripts/engineering/backup-integrity.sh "$BUNDLE" "$COMMIT" "$TREE"

MANIFEST="$OUT_DIR/${SAFE_NAME}-${COMMIT:0:12}.manifest.json"
python3 - "$MANIFEST" "$MILESTONE" "$COMMIT" "$TREE" "$REFNAME" "$BUNDLE" <<'PY'
import json, sys, datetime
path, milestone, commit, tree, refname, bundle = sys.argv[1:]
doc = {
  "milestone": milestone,
  "commit": commit,
  "tree": tree,
  "backup_ref": refname,
  "bundle": bundle,
  "sha256_file": bundle + ".sha256",
  "created_at_utc": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
  "remote_push": "NOT_PERFORMED",
  "note": "Set ALLOW_REMOTE_BACKUP=1 only after owner authorizes external transfer",
}
open(path, "w", encoding="utf-8").write(json.dumps(doc, indent=2) + "\n")
print("MANIFEST=" + path)
PY

if [[ "${ALLOW_REMOTE_BACKUP:-0}" == "1" ]]; then
  echo "REMOTE: invoking remote-backup-push.sh (authorization required by caller)"
  ./scripts/engineering/remote-backup-push.sh "$COMMIT" "backup/milestones/${SAFE_NAME}-${COMMIT:0:12}"
else
  echo "REMOTE_BACKUP=SKIPPED (ALLOW_REMOTE_BACKUP!=1)"
fi

echo "RESULT=LOCAL_MILESTONE_PRESERVED"
