# Root-Cause Analysis — Tenant Isolation Failures

**Branch:** `cursor/recovery-production-readiness-da81`  
**Evidence SHA (at analysis):** `b996e00` + pending `rbac.ts` TS2538 fix  
**Date:** 2026-11-07 (Asia/Riyadh)

Statuses: VERIFIED | MITIGATED | OPEN | ACCEPTED RISK

---

## Systemic failure mode (shared)

| Layer | Observation |
|-------|-------------|
| Authorization pattern | **Decentralized.** Routes choose `requireAuth` vs `requireAuthWithTenant` independently. |
| Query scoping | Developers must remember `office_id = tenantId` on every SQL. No compile-time enforcement. |
| RLS | Policies often allow `current_setting('app.current_tenant') IS NULL OR = ''` (service/vault bypass). Migration 056 documents this pattern. |
| Session hygiene | `app.ts` clears `app.current_tenant` to `''` on response `finish` (pool safety). |
| Combined effect | A handler that uses **`requireAuth` only** runs with empty RLS tenant context → RLS does **not** constrain → unscoped SQL returns **all tenants**. |

**Root cause (architecture):** Tenant enforcement is optional at the route layer, while RLS is fail-open when tenant setting is empty. Tests historically asserted middleware presence or happy-path behavior, not cross-tenant negative cases for aggregators.

**Preventive control (preferred, minimal):** Treat `requireAuthWithTenant` + query-level scope as mandatory for any tenant-owned read/write; keep RLS as defense-in-depth, not sole control. Add contract tests for high-risk aggregators. Broader lint/AST gate = Architecture Decision (do not auto-implement without ADR).

---

## Matrix

### SEC-001 — Notification / plan-notification cross-tenant aggregation

| Field | Detail |
|-------|--------|
| Trigger | Authenticated Office A user calls `GET /api/notifications` or `GET /office/plan-notifications` |
| Root cause | Routes used `requireAuth` → no `set_config(app.current_tenant)` → empty RLS context → SQL without `office_id` returned global rows (invoices, contracts, events, plan_notifications, AI credits, etc.) |
| Why middleware failed | Correct auth ≠ tenant authorization. Developers used the weaker helper. |
| Why tests missed | No two-tenant negative contract for these aggregators until recovery. |
| Same pattern elsewhere | Any `requireAuth` + unscoped tenant table query (inventory ongoing). Confirmed cousins: invitations list (SEC-005), mediators/stats (SEC-007). |
| Boundary | API aggregator → multi-table tenant data |
| Remediation | `requireAuthWithTenant`; explicit `office_id` / employee join; omit tables without tenant key (fail-closed) |
| Regression test | `test:notifications-tenant` |
| Evidence | Code diff on `notifications.ts` / `subscription.ts`; CI Tests suite PASS |
| Status | **MITIGATED** (live E2E NOT VERIFIED) |

### SEC-005 — Invitations global list / IDOR

| Field | Detail |
|-------|--------|
| Trigger | `GET /rbac/invitations` selected all rows; mutate by id without ownership |
| Root cause | **Schema had no `office_id`.** Product model implies office-owned invites, but table only had `invited_by`. |
| Remediation (durable) | Migration **058** additive `office_id TEXT NULL` (no invented backfill); POST binds `officeId` + `invitedBy` from auth; LIST by `office_id` OR (`NULL` AND `invited_by`); mutate via `canManageInvitation` |
| Regression test | `test:rbac-invitations`, `test:invitations-058` |
| Status | **MITIGATED** (historical NULL rows still invited_by-only; acceptance token flow still lacks dedicated office bind — NOT VERIFIED) |

### SEC-007 — mediators/stats global aggregates

| Field | Detail |
|-------|--------|
| Trigger | Any authenticated user hit `GET /mediators/stats` |
| Root cause | Comment said “admin” but middleware was `requireAuth`; SQL `COUNT(*)` over all mediator tables |
| Product note | Global marketplace stats are Super Admin / platform, not office admin |
| Remediation | `requireSuperAdmin` |
| Regression test | Contract assert in `test:rbac-invitations` |
| Status | **MITIGATED** |

### SEC-008 — Stripe webhook path mismatch

| Field | Detail |
|-------|--------|
| Trigger | Ops configures Dashboard from `integrationsRegistry.webhookPath` |
| Root cause | Documentation/registry drift: registry advertised `/api/billing/stripe-webhook` while `app.ts` + managed webhook registration use `/api/stripe/webhook` |
| Impact | Missed entitlement updates if Dashboard pointed at non-existent path (availability), not a signature bypass by itself |
| Remediation | Align registry to `/api/stripe/webhook` |
| Remaining | Live Dashboard URL + signature + idempotency still need Phase F verification |
| Status | **MITIGATED** (config) / payment integrity **NOT VERIFIED** live |

### RLS empty-tenant OR-bypass (systemic)

| Field | Detail |
|-------|--------|
| Evidence | `056`/`057` policies include empty-tenant OR + `bypass_rls` |
| Interaction | `app.ts` clears tenant to `''` on finish |
| Failure mode | `requireAuth`-only + empty GUC → fail-open under RLS |
| Decision | **ADR-001** — do **not** rewrite applied policies / change clear sentinel without isolated verification + SA/bypass wiring + human approval |
| Status | **BLOCKED pending ADR approval** for DB change; app-layer aggregators mitigated |

---

## Recurrence prevention (minimal)

1. Contract tests for every multi-tenant aggregator (notifications pattern).  
2. Prefer `requireAuthWithTenant` for tenant-owned modules; ban bare `requireAuth` on those paths in review.  
3. Do **not** treat RLS empty-tenant bypass as isolation.  
4. Optional future ADR: ESLint/custom rule flagging `db.execute` in files that import only `requireAuth` — **not implemented** in this batch.

---

## Unverified

- Production RLS role is not table owner / bypasses RLS via SUPERUSER.  
- Connection pool concurrent tenant A/B leakage under load.  
- Invitation token accept flow office binding.
