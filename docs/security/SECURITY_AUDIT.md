# Adalah AI — Security Audit (Recovery)

**Branch:** `cursor/recovery-production-readiness-da81`  
**Base:** `origin/main` @ `c9667a0`  
**Date:** 2026-11-07 (Asia/Riyadh)

Statuses: **VERIFIED** | **FIXED** | **OPEN** | **NOT VERIFIED** | **ACCEPTED RISK**

---

## Finding SEC-001 — Notification cross-tenant aggregation

| Field | Value |
|-------|--------|
| Severity | **CRITICAL** |
| Status | **FIXED** (this recovery branch) |
| Component | `GET /api/notifications`, `GET /api/office/plan-notifications` |
| Reproduction | Authenticated user without tenant filter previously received other offices’ invoices/contracts/events/plan/AI-credit rows |
| Business impact | Leak of legal/financial tenant data between offices |
| Technical impact | `requireAuth` without query-level `office_id`; RLS empty-tenant path does not protect when `app.current_tenant` unset |
| Fix applied | `requireAuthWithTenant`; every office-owned query filters `office_id = tenantId`; leaves via `employees` join; omit `invitations`/`messages` (no office_id); platform tenant → empty list |
| Test evidence | `pnpm --filter @workspace/api-server run test:notifications-tenant` → PASS; CI script wired |
| Remaining risk | Live HTTP two-office E2E **NOT VERIFIED** in this agent (no Clerk prod credentials). Static contract closed. |

---

## Finding SEC-002 — Runtime RLS in isolation.ts

| Field | Value |
|-------|--------|
| Severity | HIGH (historical) |
| Status | **VERIFIED closed** on main (PR #137 merged) |
| Component | `modules/monitoring/isolation.ts` |
| Evidence | Readiness-only `verifyIsolationRlsReadiness`; no ENABLE/DROP/CREATE POLICY |
| Remaining risk | Confirm Migration **057 applied** on production DB — **NOT VERIFIED** here |

---

## Finding SEC-003 — HEAL_SECRET fail-closed

| Field | Value |
|-------|--------|
| Severity | Medium (ops) |
| Status | **VERIFIED** code correct |
| Evidence | Production missing/short secret → 503; `test:stage9-security` PASS |
| Remaining risk | Production must set strong `HEAL_SECRET` for auto-heal to work |

---

## Finding SEC-004 — Signed storage open

| Field | Value |
|-------|--------|
| Severity | N/A (regression check) |
| Status | **VERIFIED** no reopen |
| Evidence | `GET /api/storage/files/:id/signed-url` + `requireAuthWithTenant` |
| Action | Do not modify without new evidence |

---

## Finding SEC-005 — RBAC invitations list / IDOR

| Field | Value |
|-------|--------|
| Severity | HIGH |
| Status | **FIXED (interim)** on this branch — schema still lacks `office_id` |
| Component | `GET|POST|PATCH|DELETE /rbac/invitations` |
| Reproduction | Pre-fix: any authenticated office user listed/mutated all invitations |
| Fix applied | Office users: list/mutate only where `invited_by = userId`; POST binds `invitedBy` server-side; platform SA may list all |
| Test evidence | `test:rbac-invitations` PASS |
| Remaining risk | Same-office colleagues who did not create an invite cannot see it until `invitations.office_id` migration |

## Finding SEC-007 — mediators/stats cross-tenant aggregates

| Field | Value |
|-------|--------|
| Severity | MEDIUM |
| Status | **FIXED** |
| Component | `GET /mediators/stats` |
| Fix applied | `requireSuperAdmin` (was bare `requireAuth` with global COUNTs) |
| Test evidence | `test:rbac-invitations` includes contract assert |

## Finding SEC-008 — Stripe webhook path discrepancy

| Field | Value |
|-------|--------|
| Severity | MEDIUM (ops misconfig) |
| Status | **FIXED** (registry) |
| Component | `integrationsRegistry.ts` vs `app.ts` |
| Evidence | Live handler is `POST /api/stripe/webhook`; registry previously advertised `/api/billing/stripe-webhook` |
| Fix applied | Registry `webhookPath` aligned to `/api/stripe/webhook` |

---

## Finding SEC-006 — Production secrets / Stripe / AI / R2

| Field | Value |
|-------|--------|
| Severity | HIGH (launch config) |
| Status | **NOT VERIFIED** / **BLOCKED** without human credentials |
| Action | See `docs/deployment/PRODUCTION_ENVIRONMENT_REFERENCE.md` |

---

## Auth / tenant boundary summary

| Control | Status |
|---------|--------|
| `requireAuthWithTenant` sets `app.current_tenant` | VERIFIED in middleware |
| Notifications aggregator | FIXED |
| Storage signed-url | VERIFIED |
| Webhook Stripe signature | Code present — live config NOT VERIFIED |
| Super Admin platform context | Notifications return empty (fail-closed) — intentional |
