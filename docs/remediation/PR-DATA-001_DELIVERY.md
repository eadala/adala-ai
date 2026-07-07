# PR-DATA-001 — Unified Tenant Data Access

**Phase:** Enterprise Remediation Program — Phase 2  
**Branch:** `cursor/pr-data-001-tenant-data-access-da81`

---

## Technical Summary

Introduced structural tenant isolation at the database layer:

- **`0003_rls_p0_tables.sql`** — RLS on 10 P0 tables with `adala_tenant_isolation` policy
- **`core/tenant/dataAccess.ts`** — canonical import surface (`tenantDB`, `withTenantRls`, etc.)
- **`core/tenant/rlsScope.ts`** — session binding + audited platform bypass
- **`core/tenant/rlsValidation.ts`** — boot-time policy validation
- **Middleware** — sets `app.bypass_rls = false` on every tenant request
- **agentCron** — per-office iteration with `withTenantRls`

---

## RLS Policy Model

```sql
USING (
  adala_rls_bypass()  -- production-disabled unless ALLOW_PLATFORM_RLS_BYPASS
  OR (adala_tenant_id() IS NOT NULL AND office_id = adala_tenant_id())
)
```

Fail-closed: empty `app.current_tenant` → zero rows.

---

## P0 Tables Covered

cases, clients, client_invoices, contracts, documents, employees, journal_entries, invoice_payments, office_entitlements, audit_logs

---

## Deploy

1. Apply `lib/db/drizzle/0003_rls_p0_tables.sql`
2. Set `RLS_VALIDATION_STRICT=true` in production after migration verified
3. Never set `ALLOW_PLATFORM_RLS_BYPASS=true` in production

---

## Merge Recommendation

Stack after PR #17 + #18. Requires migration before deploy.
