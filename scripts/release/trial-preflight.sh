#!/usr/bin/env bash
# Read-only trial launch preflight for Adalah AI.
# Does not deploy, mutate remotes, or touch Coolify/databases.
# Usage:
#   ./scripts/release/trial-preflight.sh [ref]
# Exit 0 on pass; non-zero on hard failure.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "${ROOT}" ]]; then
  echo "ERROR: not inside a git repository" >&2
  exit 2
fi
cd "$ROOT"

REF="${1:-HEAD}"
if [[ -z "${REF}" || "${REF}" =~ [\;\|\&\$\`\<\>\(\)\{\}\!\*] || "${REF}" == *..* ]]; then
  echo "ERROR: unsafe or empty ref argument" >&2
  exit 2
fi

git rev-parse --verify "${REF}^{commit}" >/dev/null 2>&1 || {
  echo "ERROR: cannot resolve commit: ${REF}" >&2
  exit 1
}

echo "=== Adalah trial preflight ==="
echo "ref=${REF}"
./scripts/release/verify-release.sh "${REF}"

COMMIT="$(git rev-parse "${REF}^{commit}")"
fail=0

check_file() {
  local path="$1"
  if git cat-file -e "${COMMIT}:${path}" 2>/dev/null; then
    echo "OK  present: ${path}"
  else
    echo "FAIL missing: ${path}"
    fail=1
  fi
}

echo "--- required trial kit files ---"
check_file "docs/engineering/TRIAL_LAUNCH_RUNBOOK.md"
check_file "docs/engineering/TRIAL_SMOKE_TEST.md"
check_file "docs/engineering/TRIAL_STAGING_ENV.md"
check_file "docs/engineering/TRIAL_KICKOFF.md"
check_file "docs/engineering/PATH02_TRIAL_STAGING.md"
check_file "docs/engineering/COOLIFY_OPERATOR_CHECKLIST.md"
check_file "scripts/release/verify-release.sh"
check_file "scripts/release/detect-sensitive-changes.sh"

echo "--- Gate 4 secret-scan paths (expect lib/, not packages/) ---"
if git show "${COMMIT}:.github/workflows/ci.yml" | grep -q 'artifacts/ lib/'; then
  echo "OK  ci.yml secret scan includes artifacts/ lib/"
else
  echo "FAIL ci.yml secret scan does not include artifacts/ lib/"
  fail=1
fi
if git show "${COMMIT}:.github/workflows/ci.yml" | grep -E 'artifacts/ packages/' >/dev/null 2>&1; then
  echo "FAIL ci.yml still references artifacts/ packages/ for secret scan"
  fail=1
else
  echo "OK  no packages/ secret-scan path"
fi

echo "--- critical dep floor (informational from package manifests) ---"
ORVAL="$(git show "${COMMIT}:lib/api-spec/package.json" | grep -E '"orval"' || true)"
AXIOS="$(git show "${COMMIT}:artifacts/api-server/package.json" | grep -E '"axios"' || true)"
PROXY="$(git show "${COMMIT}:package.json" | grep -E '"proxy-addr"' || true)"
echo "orval: ${ORVAL:-missing}"
echo "axios: ${AXIOS:-missing}"
echo "proxy-addr override: ${PROXY:-missing}"

echo "--- frozen RC still resolvable (must remain unchanged) ---"
RC=5441523302a1513f07b5dc08f028d848a0bad5b4
EXPECT_TREE=cd84a7f277c481dc5c96d707dde4e78d7f18e713
if git rev-parse --verify "${RC}^{commit}" >/dev/null 2>&1; then
  TREE="$(git rev-parse "${RC}^{tree}")"
  if [[ "${TREE}" == "${EXPECT_TREE}" ]]; then
    echo "OK  frozen RC tree intact (${EXPECT_TREE})"
  else
    echo "FAIL frozen RC tree mismatch: ${TREE}"
    fail=1
  fi
else
  echo "WARN frozen RC commit not present in this clone (fetch tags/history)"
fi

echo "--- sensitive path advisory vs origin/develop (if available) ---"
if git rev-parse --verify origin/develop >/dev/null 2>&1; then
  ./scripts/release/detect-sensitive-changes.sh origin/develop "${COMMIT}" || true
else
  echo "SKIP origin/develop not available"
fi

if [[ "${fail}" -ne 0 ]]; then
  echo "=== PREFLIGHT FAILED ==="
  exit 1
fi
echo "=== PREFLIGHT PASSED ==="
echo "Next: staging Coolify app + TRIAL_SMOKE_TEST.md (operator)."
exit 0
