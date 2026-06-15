---
name: Adala 500 error fix patterns
description: Known root causes of 500 errors and their fixes in the API server
---

## Pattern 1: null::uuid in Drizzle sql template

**Problem:** Using `${variable}::uuid` in Drizzle `sql` tag when `variable` could be null.
```typescript
// BAD — can cause unpredictable behavior with null
sql`WHERE office_id = ${officeId}::uuid`

// GOOD — branch on null explicitly
if (officeId) {
  sql`WHERE office_id = ${officeId}::uuid OR office_id IS NULL`
} else {
  sql`SELECT * FROM table`
}
```
**Why:** Even though PostgreSQL handles NULL::uuid, Drizzle's parameterization with a
conditional null can cause query plan issues with authenticated tenants.
**Affected files:** tasks.ts (fixed), check any route using null::uuid pattern.

## Pattern 2: requireAuthWithTenant throwing

**Problem:** `resolveTenantId()` can throw for new users with no office membership.
**Fix:** try/catch in requireAuthWithTenant with fallback to "default".
**Location:** `src/middlewares/requireAuth.ts`

## Pattern 3: UUID format validation

**Problem:** PostgreSQL throws "invalid UUID" when non-UUID strings passed to ::uuid cast.
**Fix:** Validate with UUID_RE regex before using in SQL.
```typescript
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!UUID_RE.test(id)) return res.status(400).json({ error: "معرف غير صالح" });
```

## Pattern 4: NaN guard for parseInt

**Problem:** `parseInt("abc")` = NaN breaks SQL integer comparisons.
**Fix:** Check `isNaN()` before using parsed integer in SQL.

## DB Schema Notes
- `events` table uses `start_at` (not `start_time`) for the event time column
- `audit_logs` table has NO `office_id` column (by design — logs all offices)
- There is no `notifications` table — it's `plan_notifications` for billing alerts
- `office_tasks` route is in `tasks.ts` (not `office-tasks.ts`)
