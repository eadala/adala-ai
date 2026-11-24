# Owner — One-time Coolify + GitHub activation (do not do mid-merge)

**Constraints from owner:** do not add repository webhooks manually for this work, do not change the Coolify **production** branch, and do not Redeploy production until merge of the automation/release candidate is complete.

Agent cannot set GitHub Actions variables/secrets (current token lacks permission) and has no Coolify API credentials in this environment.

## A. After automation workflows land on `main` (default branch)

`workflow_run` CD workflows only register when present on the default branch.

## B. Staging (safe first)

1. In Coolify **staging** app (`adala-ai-staging`): keep DB isolated; disable real Stripe/live email/SMS providers (use test keys / no-op).
2. Create a **new** Coolify deploy webhook for staging only → GitHub Actions secret `COOLIFY_STAGING_DEPLOY_WEBHOOK_URL`.
3. Set Actions variables:
   - `ADALA_STAGING_CD_ACTIVE=true`
   - `STAGING_BASE_URL=https://<staging-host>`
   - `ADALA_CD_KILL_SWITCH` unset/`0`
4. Confirm staging health via `STAGING_BASE_URL/api/healthz`.

## C. Production (only after credential clearance + backup + green staging)

1. Confirm `CREDENTIAL_REMEDIATION=CONFIRMED` (revoke/rotate issuing GitHub App installation; audit log review).
2. Confirm restorable Postgres backup of `adalah-db` → `ADALA_DB_BACKUP_VERIFIED=true`.
3. Create a **new** production Coolify deploy webhook → secret `COOLIFY_DEPLOY_WEBHOOK_URL` (CI-controlled).
4. Set `PRODUCTION_BASE_URL=https://adalahai.com`.
5. Set `ADALA_CREDENTIAL_INCIDENT_CLEARED=true`.
6. Run one controlled live CD (`deploy/production` or approved promote path).
7. Only after that verification: set `ADALA_CD_ACTIVE=true`, then disable Coolify **production** “Deploy on push” so CI webhook is the sole trigger.
8. Do **not** change production Git branch until the release candidate is merged and verified.

## D. Emergency stop

`ADALA_CD_KILL_SWITCH=1` or `ADALA_CD_ACTIVE=false` / `ADALA_STAGING_CD_ACTIVE=false` + Coolify pause. App rollback only — never auto-reverse Postgres.
