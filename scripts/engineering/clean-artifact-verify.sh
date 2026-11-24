#!/usr/bin/env bash
# Verify a Phase clean-tree Git bundle against expected commit/tree + secret heuristics.
# LOCAL ONLY. Does not push.
set -euo pipefail
BUNDLE="${1:-}"
EXPECT_COMMIT="${2:-}"
EXPECT_TREE="${3:-}"
CONTAM_BLOB="${CONTAMINATED_BLOB_OID:-3f1a3e36c8b6ace9e1bf1b6c072951f8a8f6f925}"
COMPARE_TREE="${4:-}" # optional: development tree SHA to compare file manifests

if [[ -z "$BUNDLE" || -z "$EXPECT_COMMIT" || -z "$EXPECT_TREE" ]]; then
  echo "FAIL: usage: $0 <bundle> <expect-commit> <expect-tree> [compare-dev-tree]"
  exit 2
fi
if [[ ! -f "$BUNDLE" ]]; then
  echo "FAIL: missing bundle $BUNDLE"
  exit 1
fi

echo "=== clean-artifact-verify ==="
echo "BUNDLE=$BUNDLE"
echo "SHA256=$(sha256sum "$BUNDLE" | awk '{print $1}')"
git bundle verify "$BUNDLE"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
git init --bare "$TMP/r.git" >/dev/null
git --git-dir="$TMP/r.git" fetch "$BUNDLE" 'refs/*:refs/restore/*' >/dev/null

got_tree="$(git --git-dir="$TMP/r.git" rev-parse "${EXPECT_COMMIT}^{tree}")"
echo "RESTORED_COMMIT=$EXPECT_COMMIT"
echo "RESTORED_TREE=$got_tree"
if [[ "$got_tree" != "$EXPECT_TREE" ]]; then
  echo "FAIL: tree mismatch expected=$EXPECT_TREE"
  exit 1
fi
if git --git-dir="$TMP/r.git" cat-file -t "$CONTAM_BLOB" >/dev/null 2>&1; then
  echo "FAIL: contaminated blob reachable in restored artifact"
  exit 1
fi
echo "CONTAMINATED_BLOB_ABSENT=yes"

# Secret heuristic on restored tip tree blobs (sanitized counts)
python3 - "$TMP/r.git" "$EXPECT_COMMIT" <<'PY'
import re, subprocess, sys
gitdir, commit = sys.argv[1], sys.argv[2]
rx = re.compile(rb"(ghs_|gho_|ghp_|github_pat_|sk_live_|AKIA)[A-Za-z0-9_]{8,}|BEGIN (RSA |OPENSSH )?PRIVATE KEY")
paths = subprocess.check_output(["git","--git-dir="+gitdir,"ls-tree","-r","--name-only",commit], text=True).splitlines()
hits=0
for p in paths:
    blob=subprocess.check_output(["git","--git-dir="+gitdir,"rev-parse",f"{commit}:{p}"], text=True).strip()
    data=subprocess.check_output(["git","--git-dir="+gitdir,"cat-file","-p",blob])
    if rx.search(data):
        hits+=1
        print("SECRET_PATH_HIT", p)
if hits:
    raise SystemExit("FAIL: secret heuristic hits in restored tip")
print("SECRET_HEURISTIC_TIP=PASS")
PY

if [[ -n "$COMPARE_TREE" ]]; then
  echo "COMPARE_DEV_TREE=$COMPARE_TREE"
  git ls-tree -r --name-only "$COMPARE_TREE" | sort > "$TMP/dev.txt"
  git --git-dir="$TMP/r.git" ls-tree -r --name-only "$EXPECT_COMMIT" | sort > "$TMP/art.txt"
  only_dev="$(comm -23 "$TMP/dev.txt" "$TMP/art.txt" | wc -l | tr -d ' ')"
  only_art="$(comm -13 "$TMP/dev.txt" "$TMP/art.txt" | wc -l | tr -d ' ')"
  echo "FILES_ONLY_IN_DEV_TREE=$only_dev"
  echo "FILES_ONLY_IN_ARTIFACT=$only_art"
  if [[ "$only_dev" != "0" || "$only_art" != "0" ]]; then
    echo "NOTE: tree file-list differs (expected if compare tree is later tip)"
    comm -23 "$TMP/dev.txt" "$TMP/art.txt" | head -40
  else
    echo "FILE_MANIFEST_EQUIVALENT=yes"
  fi
fi

echo "RESULT=CLEAN_ARTIFACT_VERIFIED"
exit 0
