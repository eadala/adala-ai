# Release Guardian — Discovered Architecture & Design

## Discovered infrastructure (this workspace)

| Component | Finding |
|-----------|---------|
| Origin | `eadala/adala-ai` — **PUBLIC** |
| Default branch | `main` |
| Branch protection API | Not readable / not configured for this token (404) |
| CI | `.github/workflows/ci.yml` — typecheck, lint, build, security, audit, tenant isolation, db-migrations, docker production image |
| Deploy docs | `DEPLOY.md` — Coolify on Hetzner; webhook auto-deploy from `main`; Dockerfile build pack; port 8080 |
| Docker | Multi-stage `Dockerfile`; `HEALTHCHECK` → `/api/healthz` |
| Compose | Local `docker-compose.yml` (dev) |
| Health | `/api/healthz` (no auth) |
| Staging Coolify app | **Not present in repo config** — must be created by owner |
| Production Coolify webhook | Documented only; credentials not in repo (correct) |
| Contaminated history | Still reachable on tip ancestry |

## Release Guardian controls

- `release-guardian/policy.json` — fail-closed; `production_auto_promote=false`; `staging_auto_deploy=false`
- Risk classifier inspects paths + content patterns
- Promotion evaluator requires clean history, CI PASS, staging smoke, backup, rollback target, no P0
- Staging smoke + health scripts fail-closed when URL unset (BLOCKED ≠ PASS)
- Rollback helper never auto-reverses migrations; requires explicit confirm + Coolify mapping

## Activation (owner)

1. Close public credential incident (revoke `ghs_`).
2. Create Coolify **staging** app with separate DB + synthetic data + no prod secrets.
3. Set GitHub Actions variable `RELEASE_GUARDIAN_STAGING_URL`.
4. Require CI + Release Guardian checks on `main`/`develop`.
5. Only then flip `staging_auto_deploy` / eventually `production_auto_promote` after written activation.
