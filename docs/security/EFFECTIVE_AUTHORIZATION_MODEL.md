# Effective Authorization Model

**SHA:** tip of `cursor/recovery-production-readiness-da81`  
**Date:** 2026-11-07 (Asia/Riyadh)

```
Clerk JWT
  → requireAuth | requireAuthWithTenant | requireSuperAdmin
      → office membership resolve (tenantMiddleware)
          → AsyncLocalStorage tenantContext
          → PostgreSQL GUC:
               app.current_tenant / app.tenant_id
               app.bypass_rls
          → SQL (app WHERE office_id = …)
          → RLS policy (rls_* / vault_* / zta_*)
          → Result rows
```

## Trust sources

| Layer | Trusted input | Failure |
|-------|---------------|---------|
| Identity | Clerk session | 401 |
| Tenant | Server-side membership resolve (not client `office_id` alone) | 403 |
| Permission | `requirePermission` + office role | 403 |
| Resource | Query `office_id` / parent ownership | empty / 404 |
| RLS | GUC set by middleware | deny if fail-closed (059) |

## Privileged exceptions (explicit)

| Path | Mechanism |
|------|-----------|
| Super Admin | `setBypassRlsSession()` |
| Stripe webhook (signature verified) | `setBypassRlsSession()` |
| Pool idle / request end | `__unscoped__` + bypass off |

Empty string tenant is **not** a privilege.
