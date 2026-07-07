# Authorization Changelog

Chronological record of the ADALA Authorization Program.

---

## PR-AUTH-003 — Financial + Operations RBAC (2026-07-07)

**PR:** [#15](https://github.com/eadala/adala-ai/pull/15)  
**Branch:** `cursor/financial-ops-authz-pr-auth-003-da81`  
**Status:** Approved — merge-ready

### Added

- `requirePermission` on all mutations in:
  - `modules/financial/invoices.ts`
  - `modules/financial/accounting.ts`
  - `modules/operations/hr.ts`
- 30 new route policies (invoices, accounting, HR)
- `tests/financial-ops-authz.test.ts`
- Governance Layer 10 expanded to 7 P0 modules
- Security evidence artifacts (`docs/security/`)

### Permission mapping introduced

| Domain | Read | Write | Delete |
|--------|------|-------|--------|
| Invoices | `invoices:view` | `invoices:create/edit` | `invoices:delete` |
| Payments | `payments:view` | `payments:create` | `payments:create` |
| Accounting | `financial:view` | `financial:view` | `accounting:delete` |
| HR admin | `hr:manage` | `hr:manage` | `hr:manage` |
| HR self-service | `dashboard:view` | `dashboard:view` | — |

### Decisions

- **RBAC-ROLE-001:** No default role permission changes. `hr:manage` remains `firm_owner` only.
- Public invoice portal (`/invoices/public/:token`) remains unauthenticated by design.
- `payments.ts`, `billing.ts`, HR extended modules deferred to PR-AUTH-004+.

### Metrics

- P0 mutation coverage: **100%** (68/68)
- Financial module route coverage: **100%**
- HR core route coverage: **100%**

---

## PR-AUTH-002 — Legal Core RBAC (2026-07-07)

**PR:** [#14](https://github.com/eadala/adala-ai/pull/14)  
**Branch:** `cursor/legal-core-authz-pr-auth-002-da81`

### Added

- `requirePermission` on all mutations in:
  - `modules/legal-core/cases.ts`
  - `modules/legal-core/clients.ts`
  - `modules/legal-core/contracts.ts`
  - `modules/legal-core/documents.ts`
- 30 route policies for legal-core
- `tests/legal-core-authz.test.ts`
- Governance Layer 10 blocking for 4 legal-core modules

### Metrics

- Legal-core mutation coverage: **100%** (29/29)
- Read gaps: 7 routes (contracts GETs, documents GET by id)

---

## PR-AUTH-001 — Authorization Foundation Kernel (2026-07-07)

**PR:** [#13](https://github.com/eadala/adala-ai/pull/13)  
**Branch:** `cursor/authorization-foundation-pr-auth-001-da81`

### Added

- `core/authorization/` kernel:
  - `permissionCatalog.ts` — 61 permission SSOT
  - `authorizationContext.ts` — membership + role JOIN
  - `authorize.ts` — pure evaluation
  - `routePolicyRegistry.ts` — route policies
  - `enforceRoutePolicy.ts` — global middleware
  - `errors.ts` — `AUTH_403`, `AUTHZ_MEMBERSHIP_REQUIRED`
- Refactored `requirePermission` to use kernel
- Removed `trainee_lawyer` fallback on missing membership
- `rbac.ts`: `office_members.role` write path; invitations scoped by `office_id`
- Migration: `lib/db/drizzle/0001_invitations_office_id.sql`
- `tests/authorization-foundation.test.ts`
- Governance Layer 10 (warn mode)

### Breaking changes

- Missing `office_members` row → deny (was trainee fallback)
- `users.role` no longer written by RBAC module

---

## Phase 1 — Tenant Security Foundation (pre-PR-AUTH)

**PR:** [#12](https://github.com/eadala/adala-ai/pull/12)

### Added

- `core/tenantContext.ts` — fail-closed tenant helpers
- Canonical `requireAuthWithTenant`
- `tenantResolution.ts` extracted
- P0 tenant isolation hotfixes
- `tests/tenant-isolation.test.ts`
- Governance Layer 9

---

## Upcoming (not implemented)

| ID | Scope | Status |
|----|-------|--------|
| RBAC-ROLE-001 | Default role SoD review | Documented |
| PR-AUTH-004 | `payments.ts` RBAC | Planned |
| PR-AUTH-005 | HR extended modules | Planned |
| PR-AUTH-006 | Legal-core read hardening | Planned |
| AUTHZ-STRICT | `enforceRoutePolicy` strict mode | Planned |
| PR-TNT-002 | Tenant Kernel Hardening | Architecture proposal only |

---

## Versioning

Authorization kernel is **stable** after PR-AUTH-001. Domain PRs (002, 003) add route guards and registry entries only — no kernel API changes.
