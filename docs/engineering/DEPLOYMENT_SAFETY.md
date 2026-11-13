# Deployment Safety — Adalah AI

## Facts from repository evidence

| Fact | Evidence |
|------|----------|
| Historical GitHub Actions SSH deploy removed | Prior audits; no `.github/workflows/deploy.yml` |
| Current CI builds / gates; no deploy job | `.github/workflows/ci.yml` |
| Documented Coolify branch | `DEPLOY.md` → **Branch: `main`**, `COOLIFY_BRANCH=main` |
| Documented Auto Deploy | `DEPLOY.md` instructs enabling Automatic Deployment |
| Live Coolify Auto Deploy | **UNVERIFIED** without operator access |

Absence of a deploy workflow does **not** prove Coolify is off.

## Fail-closed push rules

| Destination | Push allowed from agents? | Reason |
|-------------|---------------------------|--------|
| `main` | **No** | May trigger Coolify if Auto Deploy on |
| `develop` | **No** (direct) | Integration via PR only |
| `cursor/**`, `feature/**`, … | Only if Coolify is confirmed **not** watching that pattern | Documented watch is `main`; still confirm with operator |
| Tags `v*` | Authorized releaser only | After SHA verification |

## Before any production-bound change

1. Operator completes `COOLIFY_OPERATOR_CHECKLIST.md`.
2. Confirm Auto Deploy paused/off **or** intentional for the exact tip being landed.
3. Never land partial RC (`#138` alone) if Auto Deploy would ship it without P0 containment (`#139+`).
4. Production GO is separate from merge authorization.

## Deployment-sensitive paths (CI warns)

See `scripts/release/detect-sensitive-changes.sh` and workflow `governance-safety.yml`:

- `Dockerfile*`, `docker-compose*.yml`, `.npmrc`
- `.github/workflows/**`
- `artifacts/api-server/migrations/**`
- Auth / tenant / RLS related paths
- `DEPLOY.md`, Coolify-related docs
- `.env*` templates (never commit secrets)

## Cursor / agent rule

Do not run Coolify CLI, SSH to production, or apply DB migrations against production from this repository automation.
