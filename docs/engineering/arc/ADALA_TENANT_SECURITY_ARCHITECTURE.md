# Adalah AI — Tenant Security Architecture

**Directive:** ADALA-ARC-TENANT-SECURITY-004  
**Baseline HEAD:** `29f6cfb9ed43f4c2924a83ab61bcdbe5eb117b35`  
**Audit branch:** `cursor/tenant-security-assurance-da81`

## Trust domains

| Domain | Code | Auth | Notes |
|---|---|---|---|
| Customer SaaS | `artifacts/api-server`, `artifacts/adala` | Clerk | Multi-tenant `office_id` |
| ARC control plane | `artifacts/arc-server`, `artifacts/arc-console` | Separate ARC roles | Deployment execute disabled |
| Platform Super Admin | Clerk email / metadata allowlist | `requireSuperAdmin` + `bypass_rls` | Cross-tenant by design |

## Intended isolation layers

1. **AuthN** — Clerk (`getAuth`) fail-closed on missing/malformed token (`requireAuth.ts`).
2. **Tenant resolution** — `resolveTenantId` (`tenantMiddleware.ts`): header `x-tenant-id` only after `office_members` check (or SA).
3. **ALS** — `runWithTenant` / `getTenant()` for app-layer context.
4. **RLS GUCs** — `app.current_tenant`, `app.bypass_rls`, deny sentinel `__unscoped__` (`tenantSession.ts`).
5. **App SQL** — many queries add `AND office_id = ${tenantId}` (primary guard per code comments).

## Verified architectural strengths

| Control | Status |
|---|---|
| Clerk auth required for tenant routes | VERIFIED (source) |
| `x-tenant-id` membership-gated | VERIFIED (`tenantMiddleware.ts` L201–224) |
| Empty/missing tenant fail-closed policy design (059/060) | VERIFIED (migrations + same-connection SQL) |
| ARC separate package / no customer deploy rights | VERIFIED (ARC 129 tests) |

## Architectural defects (release-blocking)

| Issue | Status |
|---|---|
| `pg.Pool` + session `set_config(..., false)` without connection pinning | **FAILED** — privileged GUC leaks across pool checkouts (F-TENANT-POOL-001) |
| Moyasar webhook trusts body metadata; updates lack `office_id` | **FAILED** (F-TENANT-MOYASAR-001) |
| Migration 059 ENABLE without FORCE | Residual table-owner bypass if app role owns tables | NOT_TESTED against prod roles |

## Decision posture

Tenant isolation is **defense-in-depth intended**, but pool GUC containment and webhook integrity gaps prevent an enterprise PASS.
