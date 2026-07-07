# Remediation Plan — Customer Zero Program

---

## Completed (P0) — Shipped on `cursor/enterprise-customer-zero-da81`

| ID | Issue | Fix | PR |
|----|-------|-----|-----|
| CZ-P0-001 | Team member enumeration | `users:view` on `/rbac/members` | This branch |
| CZ-P0-002 | Invitation enumeration | `users:view` on `/rbac/invitations` | This branch |
| CZ-P0-003 | Roles list open | `roles:view` on `/rbac/roles` | This branch |
| CZ-P0-004 | Payments RBAC missing | Full `requirePermission` on payments.ts | This branch |
| CZ-P0-005 | Webhook cross-tenant UPDATE | `office_id` in WHERE + signature check | This branch |
| CZ-P0-006 | Payment DDL default tenant | Removed `DEFAULT 'default'` | This branch |
| CZ-P0-007 | Office manager HR blocked | `hr:manage` + `payments:create` on role | This branch |
| CZ-P0-008 | Nav permission leaks | Finance/HR nav gates in layout.tsx | This branch |
| CZ-P0-009 | No enterprise test env | `customerZeroSeed.ts` | This branch |
| CZ-P0-010 | Abuse regression tests | `enterprise-abuse.test.ts` | This branch |

---

## P1 — Serious Operational (Prepare PR)

| ID | Issue | Proposed fix | Owner area |
|----|-------|--------------|------------|
| CZ-P1-001 | HR extended modules unguarded (42 routes) | PR-AUTH-005: hr-enterprise, hrInternal, hrPerformance | Authorization |
| CZ-P1-002 | Tenant resolver 7-step fallbacks | PR-TNT-002a canonical resolver | Tenant kernel |
| CZ-P1-003 | In-memory tenant freeze | PR-TNT-002b persistent lifecycle | Tenant kernel |
| CZ-P1-004 | `enforceRoutePolicy` warn mode | Enable `strict` after registry ≥95% | Authorization |
| CZ-P1-005 | Enterprise onboarding runbook | Docs + `office_registry` provision API | Platform |
| CZ-P1-006 | Existing DB roles not updated | `syncDefaultRoles` merge permissions for system roles | RBAC |
| CZ-P1-007 | Multi-office user selection | `office_members.is_primary` + UI switcher | Tenant + Frontend |

---

## P2 — Improvements (Backlog)

| ID | Issue | Notes |
|----|-------|-------|
| CZ-P2-001 | Contract/document GET read RBAC | PR-AUTH-006 |
| CZ-P2-002 | Secretary needs `cases:edit` for filing | RBAC-ROLE-001 review |
| CZ-P2-003 | Permission denied UX message | "Contact admin for X permission" |
| CZ-P2-004 | In-app role permission matrix | Admin settings page |
| CZ-P2-005 | AI credit visibility | Unified credits banner |
| CZ-P2-006 | Data migration toolkit | CSV import for clients/cases |
| CZ-P2-007 | Webhook mandatory signature | Reject if secret configured and sig missing |
| CZ-P2-008 | Native multi-branch offices | Branch entity vs metadata tags |

---

## P3 — Polish (Backlog)

| ID | Issue |
|----|-------|
| CZ-P3-001 | Onboarding AI without Gemini key — better fallback copy |
| CZ-P3-002 | Sidebar section collapse state persistence |
| CZ-P3-003 | Empty state illustrations for finance/HR |
| CZ-P3-004 | Arabic error message consistency audit |

---

## RBAC-ROLE-001 (Parallel track)

**Status:** Partially addressed — `office_manager` now has `hr:manage`.

**Remaining SoD review:**
- Should `accountant` receive `accounting:delete`?
- Should `secretary` receive `cases:edit`?
- Dedicated `hr_manager` system role vs `office_manager`?

---

## Deferred (Out of scope)

- ABAC / matter-level access
- Custom tenant roles UI
- Policy engine replacement
- Microservices split

---

## Verification Commands

```bash
# Full enterprise gate
pnpm --filter @workspace/api-server exec tsx src/tests/enterprise-abuse.test.ts
pnpm --filter @workspace/api-server exec tsx src/tests/financial-ops-authz.test.ts
pnpm --filter @workspace/api-server exec tsx src/tests/tenant-isolation.test.ts
node scripts/governance/platform-check.mjs

# Seed customer environment
DATABASE_URL=... pnpm --filter @workspace/api-server exec tsx src/runCustomerZeroSeed.ts
```

---

## Target Milestones

| Milestone | Score target | Key deliverables |
|-----------|-------------|------------------|
| Customer Zero complete | 6.8 | This program |
| Enterprise pilot | 8.0 | P1 items + PR #13–15 merged |
| Enterprise production | 9.0 | RLS + strict authz + migration toolkit |
