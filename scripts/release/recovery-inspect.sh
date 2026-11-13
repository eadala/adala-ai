#!/usr/bin/env bash
# Read-only recovery inspection. Does not revert, deploy, or touch databases.
# Usage:
#   ./scripts/release/recovery-inspect.sh [known-good-ref]
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

known_good="${1:-}"

echo "=== CURRENT ==="
echo "branch=$(git rev-parse --abbrev-ref HEAD)"
echo "commit=$(git rev-parse HEAD)"
echo "tree=$(git rev-parse HEAD^{tree})"
echo "dirty_files=$(git status --porcelain=v1 | wc -l | tr -d ' ')"

echo "=== VERIFIED RELEASE TAGS (annotated v*) ==="
# List annotated tags matching v*; tolerate empty
if git tag -l 'v*' | grep -q .; then
  while IFS= read -r t; do
    if git rev-parse "${t}^{commit}" >/dev/null 2>&1; then
      echo "${t} commit=$(git rev-parse "${t}^{commit}") tree=$(git rev-parse "${t}^{tree}")"
    fi
  done < <(git tag -l 'v*' | sort -V)
else
  echo "(none)"
fi

echo "=== FROZEN RC (immutable identity) ==="
RC=5441523302a1513f07b5dc08f028d848a0bad5b4
EXP=cd84a7f277c481dc5c96d707dde4e78d7f18e713
if git cat-file -e "${RC}^{commit}" 2>/dev/null; then
  echo "rc_commit=${RC}"
  echo "rc_tree=$(git rev-parse ${RC}^{tree})"
  if [[ "$(git rev-parse ${RC}^{tree})" == "${EXP}" ]]; then
    echo "rc_tree_match=YES"
  else
    echo "rc_tree_match=NO"
  fi
else
  echo "rc_commit=UNAVAILABLE_IN_THIS_CLONE"
fi

if [[ -n "${known_good}" ]]; then
  echo "=== DIFF vs known-good (${known_good}) ==="
  git rev-parse --verify "${known_good}^{commit}" >/dev/null
  echo "known_good_commit=$(git rev-parse ${known_good}^{commit})"
  echo "known_good_tree=$(git rev-parse ${known_good}^{tree})"
  echo "--- migrations since known-good ---"
  git diff --name-only "${known_good}^{commit}" HEAD -- 'artifacts/api-server/migrations/*.sql' || true
  mig_count="$(git diff --name-only "${known_good}^{commit}" HEAD -- 'artifacts/api-server/migrations/*.sql' | wc -l | tr -d ' ')"
  echo "migration_files_changed=${mig_count}"
  if [[ "${mig_count}" != "0" ]]; then
    echo "rollback_requires_db_review=YES"
  else
    echo "rollback_requires_db_review=NO"
  fi
  echo "--- stat (tail) ---"
  git diff --stat "${known_good}^{commit}" HEAD | tail -n 15
fi

echo "=== NOTES ==="
echo "This script never deploys, restores databases, or modifies refs."
echo "Production deployed SHA remains UNVERIFIED unless supplied by Coolify operator evidence."
