# Autonomous CD Activation (Owner)

**Production CD is DISABLED until every item is true.**

## Prerequisites

1. Revoke/expire the exposed public-history `ghs_` credential (authoritative confirmation).
2. Issue a **new** Coolify deploy webhook URL; store only as GitHub Actions secret `COOLIFY_DEPLOY_WEBHOOK_URL`.
3. Create dedicated branch `deploy/production` (do not auto-deploy from `cursor/*` or `backup/*`).
4. In Coolify: **disable** unrestricted deploy-on-push from random branches; prefer CI webhook trigger.
5. Set GitHub Actions variables:
   - `ADALA_CREDENTIAL_INCIDENT_CLEARED=true` (only after step 1)
   - `ADALA_DB_BACKUP_VERIFIED=true` (only after restorable backup confirmed)
   - `ADALA_CD_ACTIVE=true` (only after first controlled live deploy succeeds)
   - `ADALA_CD_KILL_SWITCH` unset or `0`
   - `PRODUCTION_BASE_URL=https://…` for post-deploy checks
6. Confirm last restorable DB backup exists (Coolify/Hetzner backup), separate from app image rollback.
7. Keep last **3** successful releases via `release-guardian/releases/registry.json`.
8. Follow `docs/engineering/cd/OWNER_FINAL_ACTIVATION.md` for the ordered activation sequence.
9. Coolify must use CI webhook only — disable direct push deploy webhooks.

## Emergency stop

```bash
# Variable
ADALA_CD_KILL_SWITCH=1
# Or
ADALA_CD_ACTIVE=false
# Plus Coolify UI: pause auto-deploy
```

Run locally: `bash scripts/cd/emergency-stop.sh`

## Rollback

Application image/commit only — **never** reverse Postgres data automatically.
Use registry `previous` entry + Coolify prior deployment.
