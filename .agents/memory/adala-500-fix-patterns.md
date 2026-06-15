---
name: Adala 500-error fix patterns
description: Patterns that caused production 500s and how they were fixed
---

## Pattern 1: requireAuthWithTenant crash
`resolveTenantId` can throw if office_members query fails for a new user.
**Fix:** wrap in try/catch, fall back to `"default"`.
Location: `requireAuth.ts` → `requireAuthWithTenant`.

## Pattern 2: UUID validation in route handlers
Express passes all :id params as strings. PostgreSQL throws
`invalid input syntax for type uuid` for IDs like "c4".
**Fix:** `const UUID_RE = /^[0-9a-f]{8}-...-[0-9a-f]{12}$/i; return 404 if !UUID_RE.test(id)`.
Apply to all routes that take `:id` used as UUID PK.

## Pattern 3: NaN guard for numeric FK params
Routes that parse `:caseId` as INTEGER must guard against non-numeric input.
**Fix:** `const n = parseInt(id, 10); if (!id || isNaN(n)) return res.json([]);`

## Schema gap: office_id missing on HR/accounting tables
employees, payroll, leaves, attendance, revenues, expenses,
bank_accounts, cash_advances, events were all missing `office_id`.
**Fix:** `ALTER TABLE x ADD COLUMN IF NOT EXISTS office_id TEXT NOT NULL DEFAULT 'default'`
These tables are now ready for per-tenant filtering.

## Verification method
```bash
node -e "
  const http = require('http');
  const routes = [...]; // array of paths
  routes.forEach(path => {
    http.request({hostname:'localhost',port:8080,path}, res => {
      if (res.statusCode === 500) console.log('❌ 500:', path);
    }).end();
  });
"
```
