#!/usr/bin/env bash
# Detect deployment / security sensitive path changes between two refs (read-only).
# Usage:
#   ./scripts/release/detect-sensitive-changes.sh [base] [head]
# Defaults: base=origin/develop (or origin/main), head=HEAD
# Exit 0 always for advisory mode unless --strict is passed (then exit 1 if sensitive files present).
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

STRICT=0
ARGS=()
for a in "$@"; do
  if [[ "$a" == "--strict" ]]; then STRICT=1; else ARGS+=("$a"); fi
done

base="${ARGS[0]:-}"
head="${ARGS[1]:-HEAD}"

if [[ -z "${base}" ]]; then
  if git rev-parse --verify origin/develop >/dev/null 2>&1; then
    base=origin/develop
  else
    base=origin/main
  fi
fi

git rev-parse --verify "${base}^{commit}" >/dev/null
git rev-parse --verify "${head}^{commit}" >/dev/null

mapfile -t changed < <(git diff --name-only "${base}^{commit}" "${head}^{commit}" | sort -u)

sensitive_patterns=(
  '^Dockerfile'
  '^docker-compose'
  '^\.npmrc$'
  '^\.github/workflows/'
  '^artifacts/api-server/migrations/'
  '^DEPLOY\.md$'
  'docs/deployment/'
  'docs/engineering/DEPLOYMENT_SAFETY\.md'
  'docs/engineering/COOLIFY_'
  'tenantMiddleware'
  'requireAuth'
  'gucContainment'
  'tenantSession'
  '/rls'
  'bypass_rls'
  '^\.env'
  'secrets'
)

hits=()
for f in "${changed[@]:-}"; do
  [[ -z "$f" ]] && continue
  for pat in "${sensitive_patterns[@]}"; do
    if [[ "$f" =~ $pat ]]; then
      hits+=("$f")
      break
    fi
  done
done

# Deduplicate
if ((${#hits[@]} > 0)); then
  mapfile -t hits < <(printf '%s\n' "${hits[@]}" | sort -u)
fi

echo "base=$(git rev-parse ${base}^{commit})"
echo "head=$(git rev-parse ${head}^{commit})"
echo "changed_total=${#changed[@]}"
echo "sensitive_total=${#hits[@]}"

if ((${#hits[@]} > 0)); then
  echo "=== SENSITIVE PATHS ==="
  printf '%s\n' "${hits[@]}"
  echo "WARNING: deployment/security-sensitive paths changed — require explicit PR callout + review."
  if [[ "${STRICT}" -eq 1 ]]; then
    exit 1
  fi
else
  echo "sensitive_paths=NONE"
fi

exit 0
