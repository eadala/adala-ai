# Production Deployment Plan

**Status:** PLAN ONLY — do **not** deploy without explicit human approval.

## Pre-deployment checks

1. CI green on recovery PR (TypeScript, ESLint, Tests, DB Migrations).  
2. SEC-001 notification fix merged.  
3. Backup of production PostgreSQL taken and restorable.  
4. Coolify/Hetzner env vars match `PRODUCTION_ENVIRONMENT_REFERENCE.md`.  
5. Stripe Dashboard webhook = `https://adalahai.com/api/stripe/webhook`.

## Migration order (if not already applied)

053 → 054 → 055 → 056 → 057 (preflight each; no DROP POLICY in 057).

## Deployment sequence

1. Confirm backup.  
2. Apply pending migrations (human).  
3. Deploy API + frontend image from approved commit.  
4. Health: `GET /api/healthz` → 200.  
5. Smoke: login, notifications isolation, upload→signed-url, AI chat, Stripe test-mode if authorized.

## Rollback

1. Redeploy previous Coolify image/tag.  
2. Do **not** reverse 053–057 without DBA plan (additive migrations).  
3. Feature-flag / disable Stripe checkout if payment path regresses.

## Post-deploy monitoring

- Application logs for 5xx spikes.  
- Stripe webhook delivery success rate.  
- AI provider errors.  
- HEAL endpoint only if `HEAL_SECRET` set.
