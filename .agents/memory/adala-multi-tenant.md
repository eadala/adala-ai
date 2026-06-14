---
name: Adala Multi-Tenant Architecture
description: office_members table, tenantMiddleware, requireAuthWithTenant, global admin dashboard
---

## Core concept
Each law office = one Tenant. Tenant ID = office_page.id (UUID as TEXT).
Legacy single-tenant code used 'default' as office_id — this still works as fallback.

## office_members table
```sql
(id UUID, office_id TEXT, user_id TEXT, role TEXT, status TEXT, created_at TIMESTAMPTZ)
UNIQUE(office_id, user_id)
INDEX on user_id, INDEX on office_id
```
This is the authoritative user→office mapping. Users can belong to multiple offices.

## Tenant resolution (tenantMiddleware.ts)
`resolveTenantId(userId, headerTenantId?)` — 4-level priority:
1. `x-tenant-id` header (developer API access)
2. `office_members WHERE user_id = userId` (primary lookup)
3. `users.office_id` (fallback if no membership row)
4. First `office_page` row (backward-compat single-tenant)

5-minute in-memory cache keyed by userId. Call `invalidateTenantCache(userId)` after membership changes.

## requireAuthWithTenant (requireAuth.ts)
Sets both `req.userId` and `req.tenantId`. Import from `"../middlewares/requireAuth"`.
Also available as `requireAuthWithTenant` from `"../middlewares/tenantMiddleware"`.

## office_page new columns
- `stripe_customer_id TEXT` — Stripe Customer ID for this tenant
- `domain TEXT` — custom domain (future white-label)
- `owner_user_id TEXT` — the user who created/owns this office

## users table new column
- `office_id TEXT` — primary office affiliation (backup if no office_members row)

## Checkout flow (billing.ts)
On `/api/billing/checkout`:
1. Resolve tenantId from userId
2. Check office_page for existing stripe_customer_id
3. If none, create Stripe Customer + save to office_page
4. Pass officeId in BOTH session.metadata AND subscription_data.metadata

**Why:** subscription_data.metadata flows to invoice events; session.metadata only on checkout.session.completed.

## Super Admin Global Dashboard (admin.ts)
All require isSuperAdmin:
- `GET  /api/admin/tenants` — all offices + revenue breakdown
- `GET  /api/admin/tenants/revenue` — platform totals + top 10 + monthly trend
- `GET  /api/admin/tenants/:id` — single tenant (members, entitlements, ledger)
- `POST /api/admin/tenants/:id/plan` — change any tenant's plan
- `POST /api/admin/tenants/:id/members` — add user to office

## billing.ts routes updated to use real tenantId
- /billing/overview — entitlements scoped to tenantId
- /billing/checkout — customer creation + metadata with officeId
- /billing/change-plan — provisions correct office
- /billing/activate-plan — provisions correct office
- /billing/ledger — scoped to tenantId + returns fee breakdown columns

## Core tables with office_id (migrated June 2026)
`cases`, `clients`, `documents`, `contracts`, `client_invoices` — all received `office_id TEXT` column.
Indexes added: `idx_<table>_office_id` + status/type/client_id indexes.
All existing rows backfilled to default office (first row in office_page).

## Required route pattern for any data route
```typescript
import { requireAuthWithTenant } from "../middlewares/requireAuth";

router.get("/cases", requireAuthWithTenant, async (req, res) => {
  const tenantId = (req as any).tenantId;
  const results = await db.select().from(casesTable)
    .where(eq(casesTable.officeId, tenantId));
});
// Raw SQL: WHERE office_id = ${tenantId}
```

## SaaS Kernel (3 layers, June 2026)
All 3 layers activate via `requireAuthWithTenant` — no per-route changes needed.

**Layer 1 — AsyncLocalStorage** (`src/core/tenantContext.ts`):
- `runWithTenant({ userId, officeId }, () => next())` wraps the entire request
- `getTenant()` works in any service/helper without prop-drilling
- `getTenantSafe()` returns null instead of throwing — for shared utilities

**Layer 2 — tenantDB proxy** (`src/core/tenantDb.ts`):
- `tenantDB.select(table)` auto-filters by officeId
- `tenantDB.insert(table, data)` auto-injects officeId
- `tenantFilter(table)` / `tenantAnd(table, ...conds)` for Drizzle .where()
- `guardRawSQL(sql, context)` — warns in prod, throws in dev if no office_id

**Layer 3 — PostgreSQL RLS**:
- `ALTER TABLE cases ENABLE ROW LEVEL SECURITY` on 5 core tables
- Policy: `office_id = current_setting('app.current_tenant', true)` or empty (permissive fallback for backward compat)
- `requireAuthWithTenant` calls `set_config('app.current_tenant', officeId, false)`
- `app.ts` resets to `''` on `res.finish` to prevent pool state bleed

## CORS (fixed June 2026)
Changed from `origin: true` to regex validator: allows `*.replit.app`, `*.replit.dev`, `localhost:*`, and `ALLOWED_ORIGINS` env var.
