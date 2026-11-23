# Adalah AI — Initial Project State (Recovery)

**Generated:** 2026-11-07 (Asia/Riyadh)  
**Agent mode:** Master Recovery & Production Launch  
**Status:** VERIFIED inspection before modifications

---

## Git checkpoint

| Item | Value |
|------|--------|
| Recovery branch | `cursor/recovery-production-readiness-da81` (Cloud Agent naming; maps to requested `recovery/production-readiness`) |
| Base | `origin/main` @ `c9667a0` |
| Prior agent branch (abandoned for recovery) | `cursor/tenant-middleware-canonical-da81` @ `9e0fe9f` — **diverged**; only had migration `001_*` locally; **not** used as recovery base |
| Working tree at branch create | Clean |
| Remote | `https://github.com/eadala/adala-ai` |

### Why not the previous working branch?

`cursor/tenant-middleware-canonical-da81` was ahead of an old merge-base and **missing migrations 003–057** in the workspace checkout. Production baseline is `main` with full schema authority through **057**. Recovery continues from `main`.

---

## Pull requests (relevant)

| PR | State | Notes |
|----|-------|--------|
| **#137** Migration 057 | **MERGED** 2026-08-30 (`c9667a0`) | Runtime RLS removed from `isolation.ts`; readiness-only |
| #136 Migration 056 | MERGED | On main |
| Older draft authz/enterprise PRs (#13–22, etc.) | DRAFT | Not required for this recovery path; do not blindly merge |

---

## Database / migrations

| Item | Status |
|------|--------|
| Migration files on recovery branch | **56** SQL files under `artifacts/api-server/migrations/` including **053–057** |
| Migration 057 file | PRESENT: `057_monitoring_isolation_rls_schema_authority.sql` |
| Applied to production DB | **NOT VERIFIED** from this environment (`DATABASE_URL` unset here) |
| Local PostgreSQL | Available (`pg_isready` accepting connections) — ephemeral test DBs only |

**Human approval required** before any production migration apply.

---

## Phase 1 re-verification (historical 2026-08-27 audit)

### A. Notification cross-tenant exposure — **FIXED ON THIS BRANCH**

| Endpoint | Auth (after fix) | Tenant filter | Verdict |
|----------|------------------|---------------|---------|
| `GET /api/notifications` | `requireAuthWithTenant` | All office-owned queries use `office_id` | **FIXED** |
| `GET /api/office/plan-notifications` | `requireAuthWithTenant` | `office_id = tenant` | **FIXED** |
| `POST /api/notifications/mark-read/:planId` | `requireAuthWithTenant` | Scoped | OK |
| `PATCH /api/office/plan-notifications/read-all` | `requireAuthWithTenant` | Scoped update | **FIXED** auth pattern |
| Settings GET/PATCH | `requireAuthWithTenant` | Scoped | OK |

**Pre-fix evidence (main @ c9667a0):** unscoped invoices/contracts/events/plan/AI credits.  
**Post-fix:** `test:notifications-tenant` PASS; invitations/messages omitted (fail-closed).

### B. Migration 057 / Runtime RLS — **CLOSED ON MAIN (VERIFIED)**

| Check | Result |
|-------|--------|
| PR #137 | MERGED |
| `isolation.ts` Runtime ENABLE/DROP/CREATE POLICY | **Absent** — `verifyIsolationRlsReadiness` only |
| Action | Do **not** re-implement 057; verify prod apply separately |

### C. Do-not-reopen areas — **NO REGRESSION EVIDENCE**

| Area | Current status |
|------|----------------|
| Signed storage open | `GET /api/storage/files/:id/signed-url` + `requireAuthWithTenant` present |
| Migrations 053–056 | Present on main |
| HEAL fail-closed | Missing/invalid secret → 503 `heal_secret_not_configured` |

---

## Deployment / environments

| Item | Status |
|------|--------|
| Production domain | adalahai.com (historical/product) |
| Coolify / Hetzner | **NOT VERIFIED** from this agent VM |
| Production secrets | **NOT available** in agent env (correct) |
| Deploy to production | **REQUIRES HUMAN APPROVAL** — blocked by policy |

---

## Required external credentials (human)

1. Clerk live keys  
2. Stripe live keys + webhook secret  
3. Gemini API key  
4. Cloudflare R2 credentials  
5. `HEAL_SECRET` (≥12 chars)  
6. Production `DATABASE_URL` (for migration apply verification only with approval)  
7. VAPID keys (if push is launch-required)

---

## Identified risks (current)

1. **P0 CRITICAL:** Cross-tenant notification aggregation (B1).  
2. **P0 process:** Confirm 053–057 applied on production DB.  
3. **P1:** Production Stripe/AI/R2/Clerk/HEAL config.  
4. **P1:** Tables without `office_id` used in notification tiles (`invitations`, `messages`) — cannot be safely scoped; must fail closed / omit until schema supports tenant key.  
5. **Noted (not P0 for this batch):** `GET /rbac/invitations` lists all invitations without office filter (schema lacks `office_id`).

---

## Actions requiring human approval

- Production deploy  
- Production migration apply  
- Destructive DB operations  
- Use of live Stripe charges  
- Production secret injection into agent environment  

---

## Next execution step (completed on this branch)

Implemented **P0 notification tenant isolation fix** + `test:notifications-tenant` (CI-wired). See `SECURITY_AUDIT.md` SEC-001 and `FINAL_GO_LIVE_DECISION.md` (**CONDITIONAL GO**).
