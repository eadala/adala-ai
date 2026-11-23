---
name: Adala Developer Impersonation
description: SA can enter any office as firm_owner via developer_impersonation table; affects tenantMiddleware + getMgmtUser + layout banner
---

# Developer Impersonation (خدمة عن بعد)

## Rule
Super admin can impersonate any office manager. All data operations use impersonated officeId, but SA's Clerk userId is preserved for audit.

**Why:** Customer support — SA needs to see exactly what office manager sees and fix issues on their behalf.

## How to apply
- `developer_impersonation` table: `super_admin_user_id UNIQUE, impersonated_office_id, office_name, started_at, expires_at`
- `tenantMiddleware.resolveTenantId()` step 1b: query table before cache — if active, return impersonated officeId
- `storage.ts getMgmtUser()`: when isSA, check table; if active → officeId=impersonated, isSA=false, isAdmin=true, isImpersonating=true
- Routes: GET /api/developer/offices, GET|POST /api/developer/impersonate/status|/:officeId, DELETE /api/developer/impersonate
- Frontend: `ImpersonationBanner` in layout.tsx (violet, polls every 60s); "المكاتب" (5th tab) in DevCenterTab in super-admin.tsx
- Exit: DELETE /api/developer/impersonate → redirect to /super-admin

## Security Note
Routes guarded by `devOnly` middleware (isSuperAdmin check). Table itself is the auth — no separate JWT needed.
