---
name: Adala Analytics Tenant Isolation
description: analytics.ts and accounting.ts had critical data-isolation bugs — all offices' financial/case/client data mixed together
---

## The Bug
`analytics.ts` registered all 6 endpoints with `requireAuth` (not `requireAuthWithTenant`). This meant:
1. `req.tenantId` was never set
2. PostgreSQL RLS `set_config('app.current_tenant', ...)` was never called
3. All 36+ SQL queries had no `WHERE office_id = ...` filter
4. `ai_analytics_cache` used a global cache key `ai_insights_${period}` — one office's AI summary shown to all offices

`accounting.ts` `/accounting/reports/summary` and `/accounting/cashflow` had the same problem: used `_req` (discarding req) so `tenantId` was unavailable and all P&L / cashflow queries aggregated all offices' revenues/expenses/invoices.

## The Fix Pattern
1. Change middleware: `requireAuth` → `requireAuthWithTenant`
2. Change handler signature: `async (_req, res)` → `async (req, res)` 
3. Add at top of handler: `const tenantId = (req as any).tenantId as string;`
4. Add `AND office_id = ${tenantId}` to EVERY SQL query in the handler
5. For cache keys: use `${tenantId}_${period}` not just `${period}`

**Why:** `requireAuthWithTenant` sets `req.tenantId` AND calls `set_config` for PostgreSQL RLS, but the comment in requireAuth.ts says "app-level filter is the primary guard" — meaning explicit `WHERE office_id` is required; RLS alone is not sufficient.

## Checklist for New Report Endpoints
- [ ] Uses `requireAuthWithTenant` (not bare `requireAuth`)
- [ ] Handler uses `req` (not `_req`)
- [ ] `const tenantId = (req as any).tenantId as string;` at top
- [ ] Every `FROM revenues`, `FROM expenses`, `FROM cases`, `FROM clients`, `FROM client_invoices`, `FROM employees` has `WHERE office_id = ${tenantId}`
- [ ] Any cache keys include `${tenantId}` as a prefix
