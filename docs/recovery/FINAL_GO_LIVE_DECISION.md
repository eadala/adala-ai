# FINAL GO-LIVE DECISION — Adalah AI (RLS Closure)

**Date:** 2026-11-07 (Asia/Riyadh)  
**Branch:** `cursor/recovery-production-readiness-da81`  
**PR:** #138  
**Evidence tip before this closure commit:** `eef132a`  
**Decision tip:** _(record SHA after push of vault-060 + Stripe bypass fix)_

## Two decisions

| Decision | Verdict |
|----------|---------|
| **Merge readiness** | **READY** pending green CI on tip (Gates 1/5 + Tests + DB Migrations) |
| **Production readiness** | **CONDITIONAL GO** |

## Exact evidence

### Administrative bypass security

| Check | Result |
|-------|--------|
| Ordinary tenant → `setBypassRlsSession` | **No** — only SA paths + signed Stripe |
| Tenant admin → global bypass | **No** — office GUC only via `setOfficeTenantSession` |
| Super Admin | Clerk `checkIsSuperAdmin` / `isSuperAdminUser` **before** bypass |
| Stripe | `constructEvent` **before** bypass; route does not set bypass; `finally` clears |
| Missing/invalid signature | Throws before bypass; HTTP 400 |
| Pool clear | Deny sentinel + `bypass_rls=off` on finish (never `''`) |
| platform tenant in tenantMiddleware | SA re-check before bypass |

**Critical finding closed this turn:** Stripe route previously could set bypass before verify — removed; bypass only in `stripeEventBuffer` after `constructEvent`.

### Vault/ZTA

| Item | Status |
|------|--------|
| 056 zta alone | Fail-closed (NULLIF) |
| 056 vault empty OR | **Verified fail-open**; undercuts zta when both PERMISSIVE |
| Migration **060** | Smallest fix; 056 not rewritten; zta untouched |
| Isolated repro after 060 | Empty tenant **0** rows |

### Effective RLS

| Item | Status |
|------|--------|
| 059 empty/NULL/`__unscoped__` | 0 rows (`adala_app`) |
| Office match / bypass | 1 / all |
| Table owner without FORCE | Sees all — **prod FORCE/owner UNKNOWN** |
| App role BYPASSRLS | Must be absent — **prod NOT VERIFIED** |

### Compatibility (A–D)

See `docs/security/RLS_COMPATIBILITY_MATRIX_059.md`.  
Safest sequence: **app first → 058 → 059 → 060**.

### CI

- Tip `eef132a`: Gates 1–9 SUCCESS; Gate 5 SUCCESS; Tests SUCCESS; DB Migrations was still in progress at last poll — **re-verify on new tip**.
- Local contracts this turn: `rls-fail-closed-059`, `vault-rls-060`, notifications, invitations-058, rbac-invitations, stage9, ai-credits-039, rls-runtime-056 — **PASS**.

### Remaining risks (human-gated)

1. Production table ownership / FORCE / app role attributes not inventoried from live DB.
2. Live multi-office E2E and Stripe live webhook not executed.
3. Connection-pool GUC sticky behavior under production concurrency not load-tested.
4. Backup restore drill not evidenced.
5. Secrets presence verified by name only.

### Required human approvals

Merge CI green; backup/restore; secrets/Stripe; apply 058–060; Coolify deploy; role/FORCE inventory.

**Agent did not deploy or apply production migrations.**
