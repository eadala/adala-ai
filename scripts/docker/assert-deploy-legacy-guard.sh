#!/usr/bin/env bash
# Stage 22.1 — guard Coolify/Docker `pnpm deploy` against pnpm ≥10 default.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

fail() { echo "❌ $*" >&2; exit 1; }
ok() { echo "  ✅ $*"; }

grep -q '^force-legacy-deploy=true' "$ROOT/.npmrc" \
  || fail ".npmrc must set force-legacy-deploy=true (pnpm ≥10 deploy guard)"
ok ".npmrc force-legacy-deploy=true"

grep -q 'pnpm@9.15.9' "$ROOT/Dockerfile" \
  || fail "Dockerfile must pin pnpm@9.15.9"
ok "Dockerfile pins pnpm@9.15.9"

grep -q 'deploy --prod /app/api-runtime' "$ROOT/Dockerfile" \
  || fail "Dockerfile must deploy api-server to /app/api-runtime"
ok "Dockerfile deploy target /app/api-runtime"

grep -q 'force-legacy-deploy=true' "$ROOT/Dockerfile" \
  || fail "Dockerfile must document/rely on force-legacy-deploy"
ok "Dockerfile references force-legacy-deploy"

grep -q 'deploy --prod /app/api-runtime' "$ROOT/infra/Dockerfile.api" \
  || fail "infra/Dockerfile.api must deploy to /app/api-runtime"
ok "infra/Dockerfile.api deploy target"

grep -q '\.npmrc' "$ROOT/infra/Dockerfile.api" \
  || fail "infra/Dockerfile.api must COPY .npmrc (force-legacy-deploy)"
ok "infra/Dockerfile.api copies .npmrc"

test -f "$ROOT/.dockerignore" || fail ".dockerignore must exist (Coolify context hygiene)"
ok ".dockerignore present"

echo "✅ docker deploy legacy guards passed"
