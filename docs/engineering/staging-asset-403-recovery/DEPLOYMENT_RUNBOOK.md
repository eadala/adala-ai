# Staging Deployment & Rollback Runbook

## Target

- App: `adala-ai-staging-isolated`
- URL: `https://staging.adalahai.com`
- Network: `adala-staging`
- Port: `8080`
- Strategy: Dockerfile → Coolify
- Integration branch: `develop`

## Deploy (after PR merge to develop)

1. Confirm Coolify staging tracks `develop` (or the recovery branch SHA intentionally).
2. Ensure build args include staging `VITE_CLERK_PUBLISHABLE_KEY` (`pk_test_…`).
3. Ensure runtime env: staging `CLERK_SECRET_KEY`, isolated `DATABASE_URL`, `PUBLIC_DIR=/app/public`.
4. Set `ALLOWED_ORIGINS=https://staging.adalahai.com` (belt-and-suspenders with code allowlist).
5. Redeploy; record deployed image/SHA from Coolify.
6. Run operator smoke (does not print secrets):

```bash
STAGING_URL=https://staging.adalahai.com \
STAGING_BASIC_AUTH_USER='…' \
STAGING_BASIC_AUTH_PASS='…' \
node scripts/staging/smoke-asset-delivery.mjs
```

7. Complete browser checklist in `LIVE_ACCEPTANCE.md`.

## Rollback

1. Coolify → previous known-good deployment / image tag.
2. Or revert merge commit on `develop` and redeploy.
3. Do **not** point staging at production DB or production Clerk live keys.

## Operator actions this agent cannot perform

- Supply Traefik Basic Auth for live browser verification.
- Rotate compromised staging secrets in Coolify.
- Approve protected-branch merges.
- Touch production Coolify / production webhooks.
