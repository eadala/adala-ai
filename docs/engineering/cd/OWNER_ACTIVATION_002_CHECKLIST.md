# ADALA-CD-ACTIVATION-002 — Exact remaining owner actions

Agent identity on GitHub API: **`adalahai`** (pull-only on `eadala/adala-ai`).  
Git push of agent branches works via Cursor remote token; **PR create/merge and Actions variables/secrets APIs do not**.

Private backups **succeeded** under `adalahai` admin on `adalahai/adala-ai-private-recovery-2026`.

---

## A. GitHub repository owner (`eadala`) — once

### A1. Collaborator / PR merge
1. GitHub → `eadala/adala-ai` → **Pull requests** → New  
   - base: `develop`  
   - compare: `cursor/cd-automation-land-da81` (`78593203`)  
2. Confirm checks: CI run `45338279430` + Release Guardian `45338279491` green.  
3. Merge PR (squash or merge).  
4. Open follow-up PR `develop` → `main` so CD `workflow_run` files exist on **default branch**.  
5. Do **not** Redeploy Coolify production until that merge is complete and staging is validated.

### A2. Credential remediation confirmation
Incident OID: `3f1a3e36c8b6ace9e1bf1b6c072951f8a8f6f925` (`ghs_` App installation token class).  
Agent finding: capture `2026-11-23T19:02:48Z` → token string **likely expired by ~1h TTL**, but **issuing App/installation rotation is unverified**. Cursor integration refresh alone is **not** clearance.

1. GitHub → Settings → **Applications** → Installed GitHub Apps → revoke/rotate the installation that could have issued the captured token (or uninstall/reinstall).  
2. Review audit log after capture time.  
3. Reply: `CREDENTIAL_REMEDIATION=CONFIRMED` + time (Asia/Riyadh).

### A3. Actions variables (Settings → Secrets and variables → Actions → Variables)

| Name | Value |
|------|--------|
| `ADALA_CREDENTIAL_INCIDENT_CLEARED` | `true` (only after A2) |
| `ADALA_DB_BACKUP_VERIFIED` | `true` (only after Coolify/Hetzner backup confirm) |
| `ADALA_STAGING_CD_ACTIVE` | `true` when staging webhook ready |
| `ADALA_CD_ACTIVE` | `false` until first controlled prod deploy succeeds, then `true` |
| `ADALA_CD_KILL_SWITCH` | unset or `0` |
| `STAGING_BASE_URL` | `https://<staging-host>` (HTTPS) |
| `PRODUCTION_BASE_URL` | `https://adalahai.com` |

### A4. Actions secrets (same page → Secrets)

| Name | Source |
|------|--------|
| `COOLIFY_STAGING_DEPLOY_WEBHOOK_URL` | Coolify staging app → Webhooks → new HTTPS deploy webhook |
| `COOLIFY_DEPLOY_WEBHOOK_URL` | Coolify **production** app → new HTTPS deploy webhook (CI-only; create after merge) |

Do not paste secret values into chat.

---

## B. Coolify (existing apps only) — once

### B1. Staging `adala-ai-staging`
1. Confirm separate DB from `adalah-db`.  
2. Disable live Stripe / real customer email/SMS (test keys or disabled).  
3. Create HTTPS deploy webhook → store as `COOLIFY_STAGING_DEPLOY_WEBHOOK_URL`.  
4. Prefer deploy from `develop` (or keep current staging branch if already correct).  
5. After `ADALA_STAGING_CD_ACTIVE=true`, let CI webhook deploy; run smoke against `STAGING_BASE_URL/api/healthz`.

### B2. Production (after A2 + DB backup + staging green + automation on `main`)
1. Confirm restorable backup of **`adalah-db`**.  
2. Create HTTPS CI deploy webhook → `COOLIFY_DEPLOY_WEBHOOK_URL`.  
3. Keep Git source on `main` until release content is merged; **do not** switch branch mid-flight without a plan.  
4. Run **one** controlled live CD, verify `https://adalahai.com/api/healthz` + artifact identity.  
5. Set `ADALA_CD_ACTIVE=true`.  
6. **Then** disable production “Deploy on push” so CI webhook is the sole trigger.

### B3. Emergency stop
`ADALA_CD_KILL_SWITCH=1` or unset `ADALA_CD_ACTIVE` / `ADALA_STAGING_CD_ACTIVE` + Coolify pause. App image rollback only — never auto-reverse Postgres.

---

## C. Already done by agent (do not redo)

- CI recovery `cb7722bc` green (`45284681694`)  
- Automation land `78593203` CI + Guardian green  
- Clean RC `8445c6e9` pushed; private backups verified  
- Phase 031 private ref unchanged: `8685f64a`  
- Production health preserved; no Coolify prod Redeploy by agent  
