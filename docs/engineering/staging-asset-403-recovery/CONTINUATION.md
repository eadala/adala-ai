# Continuation State — Future Agents

## Done

* Root cause corrected to CORS Origin rejection on Vite `crossorigin` asset GETs (live-proven).
* Fix: same-origin Host match + `STAGING_CORS_DOMAINS`.
* Defense-in-depth: early allowlisted static before Clerk retained.
* Tests: Layer 1 + differential (fails on broken baseline) + real Express app integration.
* Docs + gate matrix under this directory.
* PR: https://github.com/eadala/adala-ai/pull/188 → `develop`

## Policy hardening (this tip)

CORS is **explicit allowlist only** (`PRODUCTION_CORS_DOMAINS` + `STAGING_CORS_DOMAINS` + validated `ALLOWED_ORIGINS`).  
Host / `X-Forwarded-Host` reflection removed. Localhost allowed only when `NODE_ENV !== production`.

## CI

Prior tip `fb6a6302`: **All Gates Passed**. Hardened tip pending re-run after push.  
`mergeStateStatus=BLOCKED` — **`REVIEW_REQUIRED`**. Fix **not** on `origin/develop`.

## Not done (genuine blockers)

1. **Owner Approve + merge PR #188** into `develop` (branch protection) — agent cannot approve.
2. Coolify staging redeploy of merged SHA; confirm `ALLOWED_ORIGINS` includes staging.
3. Traefik Basic Auth for live smoke: `node scripts/staging/smoke-asset-delivery.mjs`
4. Staging Clerk Dev test user for authenticated dashboard (G16).
5. Coolify confirmation of staging DB / Clerk Dev isolation (G11).
6. Local Docker CLI absent — G06 relies on CI docker job.

## Do not

* Disable Clerk/CORS/RLS/Traefik to “make staging load.”
* Treat mock-auth-only green tests as operational recovery.
* Deploy or modify production.
