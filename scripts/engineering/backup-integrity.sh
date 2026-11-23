#!/usr/bin/env bash
# Verify a Git bundle locally. Does not upload or push. Never prints secrets.
set -euo pipefail
BUNDLE="${1:-}"
EXPECT_COMMIT="${2:-}"
EXPECT_TREE="${3:-}"
CONTAM_BLOB="${CONTAMINATED_BLOB_OID:-3f1a3e36c8b6ace9e1bf1b6c072951f8a8f6f925}"
if [[ -z "$BUNDLE" || ! -f "$BUNDLE" ]]; then
  echo "FAIL: usage: $0 <bundle> [expected-commit] [expected-tree]"
  exit 2
fi
echo "SHA256=$(sha256sum "$BUNDLE" | awk '{print $1}')"
git bundle verify "$BUNDLE"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
git init --bare "$TMP/r.git" >/dev/null
git --git-dir="$TMP/r.git" fetch "$BUNDLE" 'refs/*:refs/restore/*'
if [[ -n "$EXPECT_COMMIT" ]]; then
  git --git-dir="$TMP/r.git" cat-file -t "$EXPECT_COMMIT" >/dev/null
  GOT_TREE="$(git --git-dir="$TMP/r.git" rev-parse "${EXPECT_COMMIT}^{tree}")"
  echo "RESTORED_COMMIT_PRESENT=$EXPECT_COMMIT"
  echo "RESTORED_TREE=$GOT_TREE"
  if [[ -n "$EXPECT_TREE" && "$GOT_TREE" != "$EXPECT_TREE" ]]; then
    echo "FAIL: tree mismatch"
    exit 1
  fi
fi
if git --git-dir="$TMP/r.git" cat-file -t "$CONTAM_BLOB" >/dev/null 2>&1; then
  echo "FAIL: contaminated blob reachable"
  exit 1
fi
echo "CONTAMINATED_BLOB_ABSENT=yes"
echo "RESULT=LOCAL_BUNDLE_INTEGRITY_VERIFIED"
echo "NOTE: NOT OFF_ENVIRONMENT_RECOVERY_VERIFIED"
exit 0
