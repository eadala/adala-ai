#!/usr/bin/env bash
# Prepare orphan deploy/production from the current tip TREE (no contaminated ancestry).
# Does NOT rewrite public history. Does NOT push unless explicitly authorized AND credential cleared.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

CONTAM="${CONTAMINATED_BLOB_OID:-3f1a3e36c8b6ace9e1bf1b6c072951f8a8f6f925}"
SRC_REF="${1:-HEAD}"
BRANCH="deploy/production"
OUT_DIR="docs/engineering/continuity/artifacts"
mkdir -p "$OUT_DIR"

SRC="$(git rev-parse "$SRC_REF")"
TREE="$(git rev-parse "${SRC_REF}^{tree}")"
echo "=== prepare-clean-deploy-branch ==="
echo "SRC_TIP=$SRC"
echo "TREE=$TREE"

MSG="$(cat <<EOF
deploy: production clean-tree root

Orphan commit carrying the intended application tree from ${SRC:0:12}.
Contains no contaminated ancestry. Do not merge contaminated history into this branch.
EOF
)"
CLEAN="$(git commit-tree "$TREE" -m "$MSG")"
echo "CLEAN_COMMIT=$CLEAN"

# Independent object reachability: contaminated OID must be absent from this commit's object set
objs="$(git rev-list --objects "$CLEAN")"
if grep -q "$CONTAM" <<<"$objs"; then
  echo "FAIL: contaminated blob reachable from clean commit"
  exit 1
fi
echo "CONTAMINATED_BLOB_ABSENT_IN_CLEAN_HISTORY=yes"

# Secret heuristic on tip tree only
python3 - "$CLEAN" <<'PY'
import re, subprocess, sys
commit = sys.argv[1]
rx = re.compile(rb"(ghs_|gho_|ghp_|github_pat_|sk_live_|AKIA)[A-Za-z0-9_]{8,}|BEGIN (RSA |OPENSSH )?PRIVATE KEY")
paths = subprocess.check_output(["git", "ls-tree", "-r", "--name-only", commit], text=True).splitlines()
hits = []
for p in paths:
    blob = subprocess.check_output(["git", "rev-parse", f"{commit}:{p}"], text=True).strip()
    data = subprocess.check_output(["git", "cat-file", "-p", blob])
    if rx.search(data):
        hits.append(p)
if hits:
    print("SECRET_HEURISTIC_FAIL", hits[:20])
    raise SystemExit(1)
print("SECRET_HEURISTIC_TIP=PASS")
PY

git update-ref "refs/heads/${BRANCH}" "$CLEAN"
echo "LOCAL_BRANCH=${BRANCH} -> $CLEAN"

BUNDLE="$OUT_DIR/deploy-production-clean-${CLEAN:0:12}.bundle"
git bundle create "$BUNDLE" "refs/heads/${BRANCH}"
sha256sum "$BUNDLE" | tee "${BUNDLE}.sha256"
./scripts/engineering/clean-artifact-verify.sh "$BUNDLE" "$CLEAN" "$TREE" "$TREE"

# Preflight against clean branch (credential still expected to block unless owner cleared)
echo "--- preflight on clean branch (expect credential block unless cleared) ---"
set +e
./scripts/cd/preflight.sh "$CLEAN" >/tmp/cd-clean-preflight.json
pf=$?
set -e
cat /tmp/cd-clean-preflight.json

python3 - "$CLEAN" "$TREE" "$BUNDLE" "$SRC" <<'PY'
import json, datetime, sys
clean, tree, bundle, src = sys.argv[1:]
doc = {
  "directive_id": "ADALA-CD-FINAL-ACTIVATION-003",
  "deployment_branch": "deploy/production",
  "clean_commit": clean,
  "tree": tree,
  "source_tip": src,
  "bundle": bundle,
  "created_at_utc": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
  "public_push": "NOT_PERFORMED",
  "coolify_activation": "NOT_PERFORMED",
  "note": "Push only after credential revocation verified + owner approval; use this orphan history only.",
}
path = "docs/engineering/continuity/artifacts/deploy-production-clean-%s.manifest.json" % clean[:12]
open(path, "w", encoding="utf-8").write(json.dumps(doc, indent=2) + "\n")
print("MANIFEST=" + path)
PY

if [[ "${ALLOW_PUBLIC_CLEAN_DEPLOY_PUSH:-0}" == "1" ]]; then
  if [[ "${ADALA_CREDENTIAL_INCIDENT_CLEARED:-}" != "true" && "${ADALA_CREDENTIAL_INCIDENT_CLEARED:-}" != "1" ]]; then
    echo "REFUSING_PUSH: credential incident not cleared"
    exit 3
  fi
  echo "PUSH_AUTHORIZED_PATH — pushing orphan deploy/production only"
  git push -u origin "refs/heads/${BRANCH}:refs/heads/${BRANCH}"
else
  echo "PUBLIC_PUSH=SKIPPED (ALLOW_PUBLIC_CLEAN_DEPLOY_PUSH!=1)"
fi

echo "RESULT=CLEAN_DEPLOY_HISTORY_PREPARED"
echo "NEXT=owner must revoke ghs_ then approve push + Coolify CI webhook activation"
exit 0
