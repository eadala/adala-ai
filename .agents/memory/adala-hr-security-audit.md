---
name: Adala HR Security Audit
description: Critical isolation fixes applied to HR module — 19 issues across 3 files + 5 DB migrations
---

## Summary
19 security fixes applied across hr.ts, hrInternal.ts, hrPerformance.ts. 5 schema migrations ran.

## Schema Migrations Required
- `office_location`: missing `office_id` + `allowed_radius_meters` → ALTER TABLE + UNIQUE INDEX
- `performance_evaluations`: missing `office_id` → ALTER TABLE + backfill from employees JOIN
- `employee_incentives`: missing `office_id` → ALTER TABLE + backfill from employees JOIN
- `hr_announcements`: had `office_id DEFAULT 'default'` in schema but table in DB may predate → ALTER TABLE IF NOT EXISTS
- `employee_requests`: same as announcements

## Key Rule
`performance_evaluations` and `employee_incentives` do NOT have their own `office_id` in the original DB — ownership must be enforced via INNER JOIN with `employees`. After migration, `office_id` is added and INSERTs include it. DELETEs use subquery: `AND employee_id IN (SELECT id::text FROM employees WHERE office_id = ${tid})`.

## Fixes Applied
1. `hrInternal.ts` announcements GET/GET-all: `WHERE office_id = ${tid}`
2. `hrInternal.ts` announcements POST: INSERT includes `office_id`
3. `hrInternal.ts` requests GET: `INNER JOIN employees ... AND e.office_id = ${tid}`
4. `hrInternal.ts` requests POST: employee ownership check + INSERT includes `office_id`
5. `hrInternal.ts` payslip GET: `INNER JOIN employees ... AND e.office_id = ${tid}` (no payroll exposure cross-tenant)
6. `hrInternal.ts` dashboard: announcements/requests/leaves counts all scoped to `tenantId`
7. `hrPerformance.ts` evaluations GET (all): LEFT JOIN → INNER JOIN with `office_id`
8. `hrPerformance.ts` evaluations GET /:id: pre-check employee ownership
9. `hrPerformance.ts` evaluations POST: employee ownership check + `office_id` in INSERT
10. `hrPerformance.ts` evaluations DELETE: subquery via employees
11. `hrPerformance.ts` incentives GET: INNER JOIN with `office_id`
12. `hrPerformance.ts` incentives POST: employee ownership check + `office_id` in INSERT
13. `hrPerformance.ts` incentives DELETE: subquery via employees
14. `hrPerformance.ts` dashboard: all 8 parallel queries use INNER JOIN with `office_id`
15. `hr.ts` check-in GPS: `office_location` lookup uses `AND office_id = ${tid}`
16. `hr.ts` office-location GET: `AND office_id = ${tid}`
17. `hr.ts` office-location POST: `ON CONFLICT (office_id) DO UPDATE` — per-tenant upsert
18. `hr.ts` manual attendance POST: added `requirePermission("hr:manage")` guard
19. `hr.ts` leaves POST: annual leave balance check (21-day allowance, enforced before INSERT)
20. `hr.ts` payroll pay PATCH: status=draft check + duplicate-pay guard before UPDATE

**Why:** All HR tables were either missing `office_id` columns or not filtering by them → cross-tenant data leakage. Payslip was completely unauthenticated at the data level. Attendance manual entry had no role guard.
