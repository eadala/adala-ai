# Migration Sequence Verification — App → 058 → 059 → 060

**Date:** 2026-11-07 (Asia/Riyadh)  
**Do not apply on production from this document without approval.**

## Required order

1. **Deploy updated application** (tip with fail-closed GUCs + Stripe bypass-after-verify + SA gates).
2. **Migration 058** — `invitations.office_id` additive nullable column.
3. **Migration 059** — fail-closed `rls_*` policies.
4. **Migration 060** — fail-closed `vault_tenant_isolation`.

Preflights (SELECT-only): `scripts/db/preflight-migration-058.sql` … `060.sql`.

## Expected schema before each step

| Before | Expect |
|--------|--------|
| App deploy | Prod already has ≤057; app understands 057 fail-open **and** 059 fail-closed (deny sentinel works on both — matrix B). |
| 058 | `invitations` exists; `office_id` may be absent → 058 adds it. App already binds office on write. |
| 059 | `rls_*` still may contain coalesce-empty OR → 059 replaces. App already never clears to `''`. |
| 060 | `vault_tenant_isolation` may still have empty/NULL OR → 060 replaces. zta already fail-closed. |

## Compatibility window (app up, DB not fully hardened)

| Window | Security | Product |
|--------|----------|---------|
| New app + old 057 policies | Deny sentinel blocks empty-OR for `__unscoped__`; residual risk if any path still sets `''` | Authorized office OK; SA/webhook need bypass GUC (present in 057) |
| New app + 058, not 059/060 | Same as above for RLS; invitations gain durable office_id | Invite lists improve for new rows |
| New app + 059, not 060 | `rls_*` fail-closed; vault may still undercut zta on empty | Prefer minimize this window |
| Full 058–060 | Target state | — |

**Recommendation:** Controlled low-traffic or maintenance window spanning app deploy through 060 (minutes–tens of minutes). Do **not** leave “new app + 057 only” as a long-lived production state once 059/060 are approved.

## Rollback

- App-only: redeploy previous image if 058–060 not applied.
- After 059/060: forward-fix app; do not reverse policies without DBA plan.
- 058 column is additive — leaving it is safe if app rolled back.
