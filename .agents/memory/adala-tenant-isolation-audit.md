---
name: Adala Tenant Isolation Audit
description: Full audit of requireAuth vs requireAuthWithTenant across all backend modules; which patterns are safe and which need fixing
---

## Rule
Every endpoint that reads **office-scoped data** (cases, invoices, clients, audit logs, legal docs, analytics) MUST use `requireAuthWithTenant` and add `AND office_id = ${tenantId}` to every SQL query.

**Why:** `requireAuth` only validates the Clerk session — it does NOT scope queries to the current tenant. A user from office A could read office B's data.

**How to apply:** When writing a new route that queries any table with an `office_id` column, always use `requireAuthWithTenant` and extract `const tenantId = (req as any).tenantId as string;`

## Fixed in Stabilization Pass (2026-06)

| Module | Endpoints Fixed | Issue |
|--------|----------------|-------|
| `analytics.ts` | 6 endpoints, 36+ filters | requireAuth, no office_id, global cache key |
| `accounting.ts` | 2 report endpoints | `_req` discarded tenantId |
| `auditLogs.ts` | 2 endpoints | requireAuth on both |
| `legalAI.ts` | 5 endpoints | requireAuth + no office_id column in DB |
| `ai-agent.ts` | /briefing endpoint | requireAuth + no office_id filter on queries |

## DB Schema Fix
`legal_documents` table had no `office_id` column — added via `ALTER TABLE legal_documents ADD COLUMN IF NOT EXISTS office_id TEXT`. Old rows remain NULL (nullable column).

## Cache Key Rule
Any cache key for per-office data MUST include tenantId:
- BAD: `ai_insights_${period}`
- GOOD: `ai_insights_${tenantId}_${period}`

## Critical Bugs Fixed (2026-06 — Isolation Sprint)

| File | Bug | Fix |
|------|-----|-----|
| `tenantMiddleware.ts` | Step 5 fallback → first `office_page` row for users with no office → **any unassigned user sees office #1's data** | Removed fallback → returns `null` → 403 |
| `billing.ts` line 100 | `SELECT plan FROM office_page ORDER BY created_at LIMIT 1` — first office's plan | `WHERE id = ${tenantId}::uuid` |
| `billing.ts` line 238 | `WHERE id::text = ${tenantId} OR (${tenantId} = 'default')` — when tenantId="default" matches ALL rows | `WHERE id = ${tenantId}::uuid` only |
| `billing.ts` line 638 | Same `ORDER BY created_at LIMIT 1` without WHERE | `WHERE id = ${officeId}::uuid` |
| `billing.ts` line 816 | Nested subquery returning first user → first office for entitlements | `WHERE office_id = ${tenantId}::uuid` |
| `billing.ts` all 7 `?? "default"` | Fallback to "default" string when resolve fails | null check → 403 |
| `subscription.ts` | `?? "default"` on plan notifications UPDATE | null check → 403 |
| `payments.ts` 3 routes | `officeId = "default"` from **req.body** (client-controlled!) | `(req as any).tenantId` |
| `payments.ts` 4 routes | `headers["x-office-id"] ?? "default"` (client-controlled header!) | `(req as any).tenantId` |
| `finance-dashboard.ts` 4 routes | `(req as any).tenantId ?? "default"` | removed `?? "default"` |
| `marketplace.ts` 2 routes | `.catch(() => "default")` on resolveTenantId | `.catch(() => null)` + throw |

## Isolation Test Results
Script: `src/scripts/test-tenant-isolation.ts` — 10/10 checks pass.
Run via: `executeSql` tool (see test-tenant-isolation.ts for full suite).

## Safe Patterns (no fix needed)
- `requireAuth` on pure AI-generation endpoints (judgePrep, legalResearch, opponentSimulator) — these call AI with user-provided params, no DB cross-tenant reads
- `requireAuth` on user-scoped endpoints (ai-assistant history filtered by user_id)
- `aiEvents.ts`, `aiCredits.ts` — already use officeId from their own resolution
- `mediators.ts` — has own `getOfficeId(userId)` resolver

## Common Mistake Pattern
```ts
// WRONG — discards tenantId:
router.get("/report", requireAuthWithTenant, async (_req, res) => {
  const data = await db.execute(sql`SELECT * FROM revenues`); // no office filter!
});

// CORRECT:
router.get("/report", requireAuthWithTenant, async (req, res) => {
  const tenantId = (req as any).tenantId as string;
  const data = await db.execute(sql`SELECT * FROM revenues WHERE office_id = ${tenantId}`);
});
```
