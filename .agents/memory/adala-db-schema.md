---
name: Adala DB schema naming
description: PostgreSQL column naming, Drizzle ORM table export names, and FK type mismatches in the عدالة AI platform
---

## Drizzle ORM table exports
All Drizzle tables are exported with `Table` suffix from `@workspace/db`:
- `casesTable`, `documentsTable`, `aiTasksTable`, `usersTable`, `messagesTable`

**Why:** Avoids naming conflicts with Drizzle's reserved identifiers and TypeScript type names.

## PostgreSQL column naming: always snake_case

All PostgreSQL columns use **snake_case** in the actual DB, even though Drizzle ORM returns them as camelCase in API responses. Always use snake_case in raw `db.execute(sql`...`)` queries.

| Table | Notable columns |
|-------|----------------|
| `cases` | `id TEXT`, `case_type`, `client_name`, `assigned_to`, `created_at` |
| `contracts` | `id UUID`, `case_id UUID`, `expires_at`, `created_at` |
| `documents` | `id TEXT`, `case_id TEXT`, `file_name`, `file_type`, `file_url` |
| `client_invoices` | `id TEXT`, `case_id TEXT`, `invoice_number`, `due_date` |
| `events` | `id TEXT`, `case_id TEXT`, `event_type`, `start_at` |

## Critical: contracts.case_id is UUID but cases.id is TEXT

The `contracts` table has `case_id UUID`, but `cases.id` is TEXT (seeded IDs: "c1", "c2", etc.). Querying contracts with a non-UUID case ID throws: `ERROR: invalid input syntax for type uuid: "c1"`

**Fix pattern** (used in `cases.ts` hub and `ai-engine.ts` case-brief):
```typescript
const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
if (isUuid) {
  db.execute(sql`... WHERE case_id = ${id}::uuid`)
}
// else return empty array for contracts
```
