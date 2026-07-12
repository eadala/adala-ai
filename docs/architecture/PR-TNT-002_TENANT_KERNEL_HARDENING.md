# PR-TNT-002 — Tenant Kernel Hardening

**Status:** Architecture proposal — **no implementation until reviewed**  
**Depends on:** Phase 1 Tenant Foundation (PR #12), Authorization Program (PR-AUTH-001–003)  
**Date:** 2026-07-07

---

## Objective

Harden the **Tenant gate** so it is as immutable and fail-closed as Identity and Authorization:

```
Identity (Clerk) → Tenant (office_id) → Authorization (RBAC)
```

All future modules must consume tenant primitives from `core/tenantContext.ts` and `middlewares/requireAuth.ts`. No parallel resolvers, no implicit fallbacks in production.

---

## Current State Assessment

### What works (Phase 1)

| Component | Location | Status |
|-----------|----------|--------|
| Canonical middleware | `requireAuth.ts` → `requireAuthWithTenant` | ✅ Single implementation |
| Tenant context ALS | `core/tenantContext.ts` | ✅ `getRequiredTenantId`, `TNT_403` |
| Resolution extraction | `middlewares/tenantResolution.ts` | ✅ Separated from middleware |
| Compatibility layer | `tenantMiddleware.ts` | ✅ Re-export only |
| P0 hotfixes | entitlements, copilot, AI gateway, internal-messages | ✅ Fail-closed |
| Governance | Layer 9 tenant security | ✅ CI blocking |

### Gaps (PR-TNT-002 targets)

| Gap | Risk | Evidence |
|-----|------|----------|
| **7-step resolver cascade** | Wrong tenant selected when user has multiple offices | `tenantResolution.ts` lines 25–154 |
| **Implicit provisioning** | Auto-creates `trial_*` office on onboard | `TENANT-HEAL-7` path |
| **In-memory freeze state** | Lost on restart; not enforced in middleware | `control-tower.ts` `frozenTenants` Set |
| **Legacy default tenant** | Dev escape hatch could leak to staging | `ALLOW_LEGACY_DEFAULT_TENANT` |
| **Background jobs** | Cron handlers may lack explicit tenant context | `src/cron/*.ts` |
| **Event bus** | Events carry `officeId` but consumers not audited | `core/eventBus.ts` |
| **No RLS** | Application-layer isolation only | PostgreSQL policies absent |
| **users.office_id fallback** | Legacy column still consulted in resolver | Step 4 in resolver |

---

## Architecture Proposal

### Target: Unified Tenant Kernel

```
┌─────────────────────────────────────────────────────────────┐
│                     HTTP Request                             │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  requireAuth (Clerk)              ← Identity Gate           │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  resolveTenantContext()           ← Single canonical resolver │
│    1. X-Office-Id header (membership verified)              │
│    2. Impersonation (SA only, audited)                      │
│    3. Primary office_members row (explicit, not first-ASC)  │
│    4. FAIL CLOSED — no users.office_id, no auto-provision   │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  assertTenantActive()             ← Persistent freeze check │
│    Query office_registry.status / tenant_lifecycle table    │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  runWithTenant(ALS)               ← Propagate context       │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  requirePermission                ← Authorization Gate        │
└─────────────────────────────────────────────────────────────┘
```

### Design principles

1. **One resolver** — `resolveTenantContext()` replaces scattered lookup logic.
2. **Fail closed** — `null` tenant → `TNT_403`; no `default`, no `trial_*` auto-heal in request path.
3. **Explicit primary office** — `office_members.is_primary` or session-selected office; no `ORDER BY created_at ASC LIMIT 1`.
4. **Persistent lifecycle** — freeze/suspend in DB, checked on every tenant-bound request.
5. **Jobs/events carry tenant** — `{ officeId }` required parameter; no global queries without scope.
6. **RLS as defense-in-depth** — PostgreSQL policies on `office_id` columns.

---

## Scope Breakdown (6 workstreams)

### 1. Merge tenant resolvers into one canonical implementation

**Current:** `tenantResolution.ts` (7 steps), onboarding auto-provision in `onboarding.ts` / `trialOnboarding.ts`.

**Target:**
- Single `resolveTenantContext(userId, options)` in `core/tenantContext.ts` or `core/tenant/resolve.ts`
- Deprecate direct `users.office_id` lookup
- Move provisioning to explicit onboarding API (not request-path side effect)
- `tenantMiddleware.ts` remains re-export shim until removal in PR-TNT-002c

**Files affected:**
- `middlewares/tenantResolution.ts` → merge into kernel
- `middlewares/requireAuth.ts`
- `modules/platform/onboarding.ts`
- `modules/platform/trialOnboarding.ts`

### 2. Remove all implicit tenant fallbacks

**Remove from production path:**
- `users.office_id` fallback (resolver step 4)
- `office_registry` auto-insert on read (step 5)
- `trial_offices` auto-insert (step 6)
- `TENANT-HEAL-7` auto-provision (step 7)
- `allowLegacyDefaultTenant()` except `NODE_ENV=development` with explicit flag

**Migration:** Users without `office_members` row get `TNT_403` + onboarding redirect (frontend already handles).

### 3. Make missing tenant context fail closed

**Already partial:** `getRequiredTenantId`, `TenantRequiredError`.

**Harden:**
- Audit all `req.tenantId` direct reads → use `getRequiredTenantId(req)`
- Audit `(req as any).tenantId` in P0 modules → typed request extension
- Remove manual `if (!tenantId) return 403` duplicates where middleware guarantees context
- Cron/webhook handlers: require explicit `officeId` parameter

### 4. Move tenant freeze/suspend to persistent storage

**Current:** `frozenTenants = new Set()` in `control-tower.ts` (in-memory).

**Target schema:**

```sql
-- tenant_lifecycle or extend office_registry
ALTER TABLE office_registry ADD COLUMN IF NOT EXISTS
  lifecycle_status TEXT NOT NULL DEFAULT 'active'
  CHECK (lifecycle_status IN ('active', 'frozen', 'suspended', 'deleted'));

ALTER TABLE office_registry ADD COLUMN IF NOT EXISTS
  frozen_at TIMESTAMPTZ,
  frozen_reason TEXT,
  frozen_by TEXT;
```

**Middleware check:**

```typescript
async function assertTenantActive(officeId: string): Promise<void> {
  const row = await db.query.officeRegistry.findFirst({ where: eq(id, officeId) });
  if (row?.lifecycle_status !== 'active') throw new TenantFrozenError(officeId);
}
```

**Control tower:** Read/write DB instead of in-memory Set. Load frozen set on startup for cache (optional Redis in future).

### 5. Audit background jobs/events for explicit tenant context

**Cron files to audit:**
- `src/cron/agentCron.ts`
- `src/cron/emailCron.ts`
- `src/cron/logRotationCron.ts`
- `src/cron/monitoringCron.ts`

**Event bus:**
- `core/eventBus.ts` — enforce `officeId` on emit
- Audit all `.emit()` call sites for tenant presence
- Job handlers must use `runWithTenant({ userId: 'system', officeId }, fn)`

**Deliverable:** `docs/security/TENANT_JOB_AUDIT.md` with per-job tenant strategy.

### 6. Prepare RLS enforcement hardening

**Phase A (proposal):** Inventory tables with `office_id` (21 in DB registry).

**Phase B (PR-TNT-002d):** Enable RLS on P0 tables:

```sql
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON cases
  USING (office_id = current_setting('app.current_office_id', true));
```

**Application:** Set `app.current_office_id` in middleware after tenant resolution (per-connection or transaction-local).

**Risk:** Raw SQL modules (`accounting.ts`, `hr.ts`) must set session variable or use parameterized `office_id` (already do — RLS is belt-and-suspenders).

---

## Implementation PR Breakdown

| PR | Title | Scope | Risk |
|----|-------|-------|------|
| **PR-TNT-002a** | Canonical tenant resolver | Merge resolver, remove fallbacks steps 4–7 | **High** — breaks users without membership |
| **PR-TNT-002b** | Persistent tenant lifecycle | DB schema + freeze middleware + control-tower migration | Medium |
| **PR-TNT-002c** | Tenant context audit | Replace direct `req.tenantId` reads, deprecate shim | Low |
| **PR-TNT-002d** | Job/event tenant audit | Cron + eventBus explicit `officeId` | Medium |
| **PR-TNT-002e** | RLS foundation | Enable RLS on top 10 tables, session variable | **High** — query behavior change |

**Recommended sequence:** 002a → 002b → 002c → 002d → 002e

**Do not start coding until 002a architecture is approved.**

---

## Migration Plan

### Phase 0 — Preparation (this document)

- [x] Architecture proposal
- [x] Risk analysis
- [x] PR breakdown
- [ ] Stakeholder review sign-off

### Phase 1 — Resolver hardening (PR-TNT-002a)

1. Add `office_members.is_primary` column (migration)
2. Implement `resolveTenantContext()` with 3 steps only
3. Feature flag: `TENANT_RESOLVER_V2=true` (shadow mode — log diff, don't enforce)
4. Run shadow for 1 week in staging
5. Enable enforcement; remove old resolver steps

**Rollback:** `TENANT_RESOLVER_V2=false` reverts to legacy resolver.

### Phase 2 — Lifecycle persistence (PR-TNT-002b)

1. Migration: `lifecycle_status` on `office_registry`
2. Migrate `frozenTenants` Set → DB on deploy
3. Add `assertTenantActive()` to `requireAuthWithTenant`
4. Update control-tower freeze/unfreeze endpoints

### Phase 3 — Context propagation (PR-TNT-002c)

1. Grep audit: all `tenantId` access patterns
2. Replace with kernel helpers
3. Remove `tenantMiddleware.ts` re-export (update imports)

### Phase 4 — Jobs/events (PR-TNT-002d)

1. Per-cron tenant strategy document
2. Wrap job bodies in `runWithTenant`
3. EventBus type requires `officeId`

### Phase 5 — RLS (PR-TNT-002e)

1. Staging-only RLS on `cases`, `clients`, `client_invoices`
2. Integration tests with session variable
3. Production rollout table-by-table

---

## Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|------|:----------:|:------:|------------|
| Users without `office_members` locked out | High | High | Pre-migration backfill script; onboarding UX |
| Multi-office users lose office switching | Medium | Medium | `is_primary` + `X-Office-Id` header (already exists) |
| RLS breaks raw SQL queries | Medium | High | Staged rollout; test accounting/hr modules first |
| Freeze state lost during 002b migration | Low | Medium | One-time import from in-memory Set on deploy |
| Cron jobs fail without tenant | Medium | Medium | Platform-scoped jobs use `PLATFORM_TENANT_ID` explicitly |
| Trial auto-provision removal blocks signups | Medium | High | Ensure onboarding API creates membership before first API call |

### Blast radius

- **PR-TNT-002a** affects every authenticated API request — highest risk
- **PR-TNT-002e** affects every DB query — test extensively in staging

---

## Success Criteria

| Criterion | Measurement |
|-----------|-------------|
| Single resolver | 1 function, 0 fallback paths in production |
| Fail-closed rate | 100% of tenant routes use `getRequiredTenantId` |
| Freeze persistence | Survives process restart |
| Job tenant coverage | 100% cron handlers documented with tenant strategy |
| RLS coverage | ≥10 P0 tables with policies |
| Governance | Layer 9 extended with resolver + lifecycle checks |
| No regressions | `tenant-isolation.test.ts` expanded, all pass |

---

## Out of Scope (PR-TNT-002)

- Redis distributed tenant cache
- Multi-region tenant routing
- ABAC / matter-level tenant scoping
- Frontend office switcher UI (may be needed for 002a but not backend-only)

---

## Immutable Platform Gates (reaffirmed)

| Gate | Primitive | Must not duplicate |
|------|-----------|-------------------|
| Identity | `requireAuth`, Clerk | Custom JWT parsers |
| Tenant | `requireAuthWithTenant`, `getRequiredTenantId` | Per-module office lookup |
| Authorization | `requirePermission`, Authorization Kernel | Inline role checks |

**All future modules consume these primitives.**

---

## Review Checklist

- [ ] Approve 3-step resolver (header → impersonation → primary membership)
- [ ] Approve removal of auto-provision from request path
- [ ] Approve `office_registry.lifecycle_status` schema
- [ ] Approve RLS phased rollout plan
- [ ] Approve PR sequence (002a → 002e)
- [ ] Assign owner for RBAC-ROLE-001 (parallel track)

**Next action after approval:** Implement PR-TNT-002a behind feature flag.
