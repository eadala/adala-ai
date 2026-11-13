#!/usr/bin/env bash
# Read-only release identity verification for Adalah AI.
# Usage:
#   ./scripts/release/verify-release.sh <commit-ish>
#   ./scripts/release/verify-release.sh --compare <from> <to>
#   ./scripts/release/verify-release.sh --migrations <from> <to>
#   ./scripts/release/verify-release.sh --expect-tree <commit-ish> <expected-tree-sha>
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "${ROOT}" ]]; then
  echo "ERROR: not inside a git repository" >&2
  exit 2
fi
cd "$ROOT"

die() { echo "ERROR: $*" >&2; exit 1; }

assert_safe_ref() {
  local ref="$1"
  # Block shell metacharacters / path traversal in ref arguments
  if [[ -z "${ref}" || "${ref}" =~ [\;\|\&\$\`\<\>\(\)\{\}\!\*] || "${ref}" == *..* ]]; then
    die "unsafe or empty ref argument"
  fi
}

print_identity() {
  local ref="$1"
  assert_safe_ref "${ref}"
  git rev-parse --verify "${ref}^{commit}" >/dev/null 2>&1 || die "cannot resolve commit: ${ref}"
  local commit tree subject
  commit="$(git rev-parse "${ref}^{commit}")"
  tree="$(git rev-parse "${ref}^{tree}")"
  subject="$(git log -1 --format='%s' "${commit}")"
  echo "commit=${commit}"
  echo "tree=${tree}"
  echo "subject=${subject}"
  if git describe --exact-match --tags "${commit}" >/dev/null 2>&1; then
    echo "tag=$(git describe --exact-match --tags "${commit}")"
  else
    echo "tag="
  fi
}

list_migrations() {
  local from="$1" to="$2"
  git diff --name-only "${from}^{commit}" "${to}^{commit}" -- \
    'artifacts/api-server/migrations/*.sql' \
    '**/migrations/*.sql' \
    | sort -u
}

cmd="${1:-}"
case "${cmd}" in
  ""|-h|--help)
    sed -n '2,8p' "$0"
    exit 0
    ;;
  --compare)
    [[ $# -eq 3 ]] || die "--compare requires <from> <to>"
    from="$2"; to="$3"
    echo "=== FROM ==="; print_identity "$from"
    echo "=== TO ==="; print_identity "$to"
    echo "=== STAT ==="
    git diff --stat "${from}^{commit}" "${to}^{commit}" | tail -n 20
    exit 0
    ;;
  --migrations)
    [[ $# -eq 3 ]] || die "--migrations requires <from> <to>"
    echo "=== MIGRATIONS CHANGED ==="
    list_migrations "$2" "$3" || true
    exit 0
    ;;
  --expect-tree)
    [[ $# -eq 3 ]] || die "--expect-tree requires <commit-ish> <expected-tree>"
    ref="$2"; expect="$3"
    print_identity "$ref"
    actual="$(git rev-parse "${ref}^{tree}")"
    if [[ "${actual}" == "${expect}" ]]; then
      echo "tree_match=YES"
      exit 0
    fi
    echo "tree_match=NO"
    echo "expected=${expect}"
    echo "actual=${actual}"
    exit 1
    ;;
  *)
    print_identity "$cmd"
    exit 0
    ;;
esac
