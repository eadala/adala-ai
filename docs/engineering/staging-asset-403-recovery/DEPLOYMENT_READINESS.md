# Staging Deployment Readiness — Frozen Candidate

**Protocol:** ADALA-MEP-005  
**Decision pending live deploy:** RELEASE CANDIDATE READY FOR OWNER MERGE → STAGING DEPLOY  
**Classification until live accept:** STAGING PARTIALLY RECOVERED — EXTERNAL BLOCKERS REMAIN

## Frozen release candidate

| Field | Value |
|-------|-------|
| Branch | `cursor/staging-asset-403-recovery-da81` |
| HEAD SHA | `5d01274c0ae87d3618665eec21895d9336fe4691` (docs tip; functional fix `2c54d9c0`) |
| Tree SHA | `4586ca69fef17bff0dfbc2a75627531f2a4259f7` |
| PR | https://github.com/eadala/adala-ai/pull/188 → `develop` |
| Merge gate | `REVIEW_REQUIRED` (agent cannot Approve) |
| On develop | **No** |
| Production impact | **0** |

## What is fixed (code)

CORS trusted-origin allowlist includes `https://staging.adalahai.com`.  
Host/`X-Forwarded-Host` reflection removed.  
Vite `crossorigin` asset GETs no longer receive `CORS_ORIGIN_NOT_ALLOWED` for staging.  
Early allowlisted static before Clerk retained.  
Adversarial lookalike/OPTIONS regressions in CI.

## CI qualification (tip `67faea46`)

| Check | Status |
|-------|--------|
| Tests — existing suite | PASS |
| Docker — production Dockerfile | PASS |
| Gate 1 TypeScript | PASS |
| Gate 2 ESLint | PASS |
| Gate 3 Build | PASS |
| Gate 4 Security Scan | PASS |
| Gate 5 Dependency Audit | PASS |
| Gate 6–10 | PASS / skip per policy |
| Gate 8 Tenant Isolation | PASS |
| RG Local + Promotion | PASS |
| DB Migrations | **PENDING** (long-running; do not cancel) |

Re-confirm `✅ All Gates Passed` before merge if tip moves.

## Coolify staging contract (exact)

**Application:** `adala-ai-staging-isolated`  
**URL:** `https://staging.adalahai.com`  
**Port:** `8080`  
**Network:** `adala-staging`

### Runtime (non-secret)

| Variable | Value |
|----------|-------|
| `ALLOWED_ORIGINS` | `https://staging.adalahai.com` |
| `NODE_ENV` | `production` |
| `PUBLIC_DIR` | `/app/public` |
| `PORT` | `8080` |
| `PRODUCTION_URL` / app URL | `https://staging.adalahai.com` (if consumed) |

### Runtime secrets (provision in Coolify; never chat)

| Variable | Notes |
|----------|-------|
| `CLERK_SECRET_KEY` | Clerk **Development** only |
| `DATABASE_URL` | Isolated staging Postgres only |
| `SESSION_SECRET` | Staging-specific |

### Build-time

| Variable | Notes |
|----------|-------|
| `VITE_CLERK_PUBLISHABLE_KEY` | `pk_test_…` Development |
| `VITE_CLERK_PROXY_URL` | Optional `/api/__clerk` |

Rotate any previously exposed staging credentials before enabling integrations.

### Deploy path after merge

1. Merge PR #188 into `develop`.
2. Auto CD (`cd-coolify-staging.yml`) only if `ADALA_STAGING_CD_ACTIVE=true` and credential/history gates pass; else **manual Coolify redeploy** of merge SHA.
3. Confirm Coolify deployed commit == merge SHA.
4. Smoke:
```bash
STAGING_URL=https://staging.adalahai.com \
STAGING_BASIC_AUTH_USER='…' \
STAGING_BASIC_AUTH_PASS='…' \
node scripts/staging/smoke-asset-delivery.mjs
```
5. Browser: React bootstrap + Clerk Dev login.

## Operator blockers (only)

| ID | Action |
|----|--------|
| B-01 | Approve & merge #188 |
| B-02 | Coolify redeploy (or activate `ADALA_STAGING_CD_ACTIVE`) + set `ALLOWED_ORIGINS` |
| B-03 | Traefik Basic Auth for smoke + Clerk Dev test user for auth E2E |

## Rollback

Coolify → prior image/SHA, or revert merge on `develop` and redeploy. Do not label unverified revisions known-good.
