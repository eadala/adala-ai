# Deployment Risk Assessment

## GitHub Actions (verified from `.github/workflows/ci.yml`)

| Trigger | Pattern | Effect |
|---------|---------|--------|
| `push` | `main`, `develop`, `feature/**`, `hotfix/**`, `release/**`, `cursor/**` | Runs CI quality gates |
| `pull_request` | base `main`/`develop` | Runs CI |
| `workflow_dispatch` | manual | Runs CI |
| Tags | **not listed** | No tag-based workflow found in sole workflow file |
| Deploy / Coolify / SSH / `docker push` to registry | **not found** | `docker-production` job **builds** Dockerfile on the runner only |

**GITHUB_ACTIONS_DEPLOYMENT_RISK:** `CI_ONLY_ON_MATCHING_BRANCHES` — no in-repo CD deploy step observed. Residual risk: CI cost + unknown external listeners (Coolify/webhooks) outside this repo.

## Coolify

| Item | Status |
|------|--------|
| In-repo Coolify config API | Not present / not readable |
| Live Coolify dashboard | Not available to agent |
| Docs mention Coolify as prod deploy path | Yes (`docs/deployment/*`) |

**COOLIFY_AUTODEPLOY_STATUS:** `UNKNOWN`

**Rule:** Do not assume pushing a backup branch is deploy-safe.
