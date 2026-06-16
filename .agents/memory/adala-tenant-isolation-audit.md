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

## Safe Patterns (no fix needed)
- `requireAuth` on pure AI-generation endpoints (judgePrep, legalResearch, opponentSimulator) — these call AI with user-provided params, no DB cross-tenant reads
- `requireAuth` on user-scoped endpoints (ai-assistant history filtered by user_id)
- `billing.ts` manually calling `resolveTenantId(userId)` — acceptable
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
