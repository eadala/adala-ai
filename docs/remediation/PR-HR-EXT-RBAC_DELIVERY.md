# PR-HR-EXT-RBAC — HR Extended RBAC Enforcement

**Branch:** `cursor/hr-extended-rbac-da81`  
**Phase:** Authorization Layer — HR Extended Modules  
**Depends on:** PR-TNT-002, PR-AUTH-002 (core HR already guarded)

## Problem

Three HR extended modules (`hr-enterprise`, `hrInternal`, `hrPerformance`) had ~42 routes protected only by `requireAuthWithTenant` — any authenticated tenant user could access HR admin, payroll preview, and workflow operations.

## Solution

Applied granular `requirePermission()` to every route, aligned with core `hr.ts` patterns:

| Module | Employee reads | Admin / mutations |
|--------|----------------|-------------------|
| hr-enterprise | — | `hr:manage` (all 18 routes) |
| hrInternal | `dashboard:view` (announcements, dashboard, submit requests) | `hr:manage` (admin lists, CRUD) |
| hrInternal payslip | — | `payroll:view` |
| hrPerformance evaluations | — | `hr:manage` |
| hrPerformance payroll preview | — | `payroll:view` |

## Files Changed

- `artifacts/api-server/src/modules/operations/hr-enterprise.ts` — fixed import + 18 routes guarded
- `artifacts/api-server/src/modules/operations/hrInternal.ts` — 12 routes guarded
- `artifacts/api-server/src/modules/operations/hrPerformance.ts` — 11 routes guarded
- `artifacts/api-server/src/core/authorization/routePolicyRegistry.ts` — 41 new policies
- `scripts/governance/platform-check.mjs` — enforcement modules extended
- `artifacts/api-server/src/tests/hr-extended-rbac.test.ts` — static contract tests

## Verification

```bash
pnpm --filter @workspace/scripts exec tsx ../artifacts/api-server/src/tests/hr-extended-rbac.test.ts
node scripts/governance/platform-check.mjs
```

## Enterprise Readiness Impact

- Authorization enforcement: extended to full HR surface area
- Recommended merge after PR #17–#19 (tenant kernel + RLS)
