---
name: Adala DB schema naming
description: Drizzle ORM table export names for the عدالة AI platform — must use *Table suffix
---

All Drizzle tables are exported with `Table` suffix from `@workspace/db`:
- `casesTable` (not `cases`)
- `documentsTable` (not `documents`)
- `aiTasksTable` (not `aiTasks`)
- `usersTable` (not `users`)
- `messagesTable` (not `messages`)

**Why:** The schema files export `pgTable(...)` as `casesTable` etc. to avoid naming conflicts with Drizzle's reserved identifiers and TypeScript type names.

**How to apply:** Always import from `@workspace/db` using the `Table` suffix. Never use bare names like `cases` — they are not exported.
