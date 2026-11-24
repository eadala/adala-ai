# Owner — Final CD Activation (exact actions)

Production CD stays **inactive** until every step below is completed in order.

## 1. Revoke the exposed credential (blocking)

Incident blob OID: `3f1a3e36c8b6ace9e1bf1b6c072951f8a8f6f925` (`ghs_` GitHub App installation token in public history).

1. GitHub → Settings → Applications / Installations → revoke or rotate the installation that issued the exposed token (or uninstall/reinstall the app).
2. Review audit log after exposure time for unexpected activity.
3. Rotate any related secrets that may have been in the same capture era.
4. Reply in the ADALA tracker / this agent thread with: **`CREDENTIAL_REMEDIATION=CONFIRMED`** and the approximate revoke time (Asia/Riyadh).

Engineering cannot mark `ADALA_CREDENTIAL_INCIDENT_CLEARED` without that confirmation.

## 2. Push the prepared clean deploy history

Local artifact (created by agents, not pushed):

- Branch: `deploy/production` (orphan clean-tree)
- Bundle under `docs/engineering/continuity/artifacts/deploy-production-clean-*.bundle`

Owner with push rights (or authorize agent with `ALLOW_PUBLIC_CLEAN_DEPLOY_PUSH=1` **and** `ADALA_CREDENTIAL_INCIDENT_CLEARED=true`):

```bash
git fetch … # or restore from the clean bundle
git push -u origin refs/heads/deploy/production:refs/heads/deploy/production
```

Do **not** force-push `main` / rewrite public contaminated history unless separately approved.

## 3. Coolify (existing app only)

1. Point the existing application source to branch `deploy/production`.
2. **Disable** unrestricted deploy-on-push / generic Git webhooks that bypass CI.
3. Create a **new** deploy webhook URL; store only as Actions secret `COOLIFY_DEPLOY_WEBHOOK_URL`.
4. Confirm a restorable Postgres backup exists (Coolify/Hetzner); set Actions var `ADALA_DB_BACKUP_VERIFIED=true`.

## 4. GitHub Actions variables / secrets

| Name | Value |
|------|-------|
| `ADALA_CREDENTIAL_INCIDENT_CLEARED` | `true` (only after step 1) |
| `ADALA_DB_BACKUP_VERIFIED` | `true` (only after backup confirm) |
| `ADALA_CD_ACTIVE` | `false` until first controlled live deploy succeeds, then `true` |
| `ADALA_CD_KILL_SWITCH` | unset or `0` |
| `PRODUCTION_BASE_URL` | `https://…` |
| `COOLIFY_DEPLOY_WEBHOOK_URL` | secret (new webhook) |

## 5. Controlled first deploy

1. Ensure CI passes on `deploy/production`.
2. Run workflow **CD — Coolify** → `live` **once** (or push that triggers CI → CD via `workflow_run`).
3. Verify health `/api/healthz`, critical APIs, DB connectivity, commit match, registry previous release.
4. Only then set `ADALA_CD_ACTIVE=true` for automatic future eligible deploys.

## Emergency stop

`ADALA_CD_KILL_SWITCH=1` or `ADALA_CD_ACTIVE=false` + Coolify pause. App rollback only — never auto-reverse Postgres.
