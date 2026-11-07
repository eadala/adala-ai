# Production Release Runbook — RLS Closure (058 → 060)

**Status:** PLAN ONLY — no deploy, no production migration, no live credential changes without explicit human approval.

**Candidate branch:** `cursor/recovery-production-readiness-da81`  
**Record tip SHA at cut:** _(fill after green CI on merge commit)_

## 0. Hard stops

Stop and request approval before: production migration apply, Coolify deploy, secret rotation, destructive schema, broad auth redesign.

## 1. Backup verification

- [ ] Confirm latest automated PostgreSQL backup completed successfully.
- [ ] Record backup ID / timestamp (Asia/Riyadh).
- [ ] Isolated restore drill into non-prod DB; verify `SELECT 1`, row counts on `offices`, `cases`, `clients`, `invitations`.
- [ ] Do **not** overwrite production during drill.

## 2. Production migration inventory (read-only)

On prod (read-only / operator):

```sql
-- Applied marker / schema_migrations style inventory as used in prod
SELECT * FROM schema_migrations ORDER BY 1; -- or equivalent
```

Confirm presence/absence of:

| Migration | Expectation before this release |
|-----------|----------------------------------|
| 053–057 | Should already be applied (main) |
| 058 invitations.office_id | Pending unless previously applied |
| 059 rls fail-closed | Pending |
| 060 vault fail-closed | Pending |

Run SELECT-only preflights from repo:

- `scripts/db/preflight-migration-058.sql`
- `scripts/db/preflight-migration-059.sql`
- `scripts/db/preflight-migration-060.sql`

## 3. Environment variable verification (no value paste)

Coolify / secrets store must have names present (values human-verified offline):

- Clerk live keys / JWKS
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- Stripe Dashboard webhook URL → `https://<prod-host>/api/stripe/webhook`
- Gemini / R2 / `DATABASE_URL` / `HEAL_SECRET`

## 4. Application deployment order (mandatory)

Evidence: `docs/security/RLS_COMPATIBILITY_MATRIX_059.md`

1. **Deploy updated API** (fail-closed GUCs, SA/webhook bypass after verify) — combination B.
2. Health: `GET /api/healthz` → 200.
3. Apply **058** (additive invitations.office_id).
4. Apply **059** (rls_* fail-closed).
5. Apply **060** (vault fail-closed).
6. Redeploy same SHA only if needed for cache warm; no DB-before-app.

**Forbidden without approval:** apply 059/060 then run old app that clears tenant to `''` as a long-lived state (D is security-safe but workflow-breaking).

## 5. Health checks & smoke (post-cut)

Authorized:

- [ ] Office login + office switch
- [ ] Client / case list for Office A
- [ ] Contracts / documents open
- [ ] Invitations list (office-scoped)
- [ ] Notifications list (office-scoped)
- [ ] Billing portal / AI credits read
- [ ] Super Admin console (verified SA only)
- [ ] Stripe test event with valid signature processes; invalid signature → 400, no bypass

Unauthorized:

- [ ] Office A token cannot read Office B notifications/cases
- [ ] Non-SA cannot hit Super Admin routes
- [ ] Missing/invalid Stripe signature rejected

Concurrency:

- [ ] Two parallel office sessions; no cross-tenant rows
- [ ] After SA request, next ordinary request remains deny/office-scoped (pool reuse)

## 6. Rollback / forward-recovery

| Situation | Action |
|-----------|--------|
| App bad after deploy, DB not yet 059/060 | Redeploy previous Coolify image |
| App + 059/060 applied; app bug | Forward-fix app; do not reverse 059/060 without DBA plan |
| Migration 058/059/060 apply failure mid-script | Stop; restore from backup only with DBA; prefer forward fix of remaining statements |
| Stripe webhook failures | Confirm signature secret + URL; app clears bypass in `finally` |

## 7. Required human approvals

- [ ] Merge PR #138
- [ ] Backup + restore drill sign-off
- [ ] Secrets / Stripe webhook sign-off
- [ ] Explicit apply approval for 058 → 059 → 060
- [ ] Explicit Coolify deploy approval
- [ ] Production FORCE/owner role inventory (table owner vs app role)

## Decision log

| Field | Value |
|-------|--------|
| Merge readiness | See `docs/recovery/FINAL_GO_LIVE_DECISION.md` |
| Production readiness | **CONDITIONAL GO** until human gates clear |
| Deploy executed by agent | **No** |
