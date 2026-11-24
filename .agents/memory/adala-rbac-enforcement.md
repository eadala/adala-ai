---
name: Adala RBAC Enforcement
description: requirePermission() middleware + 14 guarded routes + frontend RoleRoute + loading bug fix
---

## The rule
Always use `requireAuthWithTenant` FIRST, then `requirePermission(perm)` as a second middleware. Never swap the order — requirePermission reads `(req as any).userId` and `(req as any).tenantId` set by requireAuthWithTenant.

**Why:** requirePermission resolves the user's office role from `office_members` then looks up that role's permissions in the `roles` table. It needs both userId and tenantId already set on the request.

**How to apply:**
```ts
router.delete("/cases/:id",
  requireAuthWithTenant,
  requirePermission("cases:delete"),
  async (req, res) => { ... }
);
```

## Super-admin bypass
`if ((req as any).isSuperAdmin) return next()` — super-admins always pass, no DB lookup.

## 14 guarded routes (as of Phase 2)
- DELETE /cases/:id → cases:delete
- DELETE /clients/:id → clients:delete
- DELETE /invoices/:id → invoices:delete
- POST /rbac/roles → roles:create
- PATCH /rbac/roles/:id → roles:edit
- DELETE /rbac/roles/:id → roles:edit
- PATCH /rbac/users/:id/role → roles:edit
- PATCH /rbac/members/:memberId/role → users:edit
- DELETE /rbac/members/:memberId → users:delete
- POST /rbac/invitations → users:create
- DELETE /rbac/invitations/:id → users:create
- GET /hr/payroll + GET /hr/payroll/stats → payroll:view
- POST /hr/payroll/generate + PATCH /hr/payroll/:id/pay + PATCH /hr/payroll/pay-all → payroll:manage
- DELETE /accounting/revenues|expenses|bank-accounts|advances → accounting:delete

## New permissions added to ALL_PERMISSIONS
`payroll:view`, `payroll:manage`, `accounting:delete`

## Role matrix (key differences)
- firm_owner: `["*"]` — full access
- office_manager: gets payroll:view + payroll:manage (NOT cases:delete/accounting:delete)
- accountant: gets payroll:view + invoices:delete (NOT payroll:manage)
- lawyer: no financial delete/payroll access
- trainee_lawyer: view-only, no destructive ops

## Frontend: use-permissions loading bug
`hasPermission()` used to return `true` when `data` was undefined (during loading). **Fixed to return `false`.**
This prevented unauthorized access during the Clerk+permissions loading window.

## Frontend: RoleRoute component (App.tsx)
```tsx
function RoleRoute({ permission, children }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { hasPermission, isLoaded: permLoaded } = usePermissions();
  if (!isLoaded || !permLoaded) return <PageLoader />;
  if (!isSignedIn) return <Redirect to="/" />;
  if (!hasPermission(permission)) return <Redirect to="/dashboard" />;
  return <OnboardingGate><Layout>...</Layout></OnboardingGate>;
}
```
Applied to: /payroll (payroll:view), /users (users:view)

## Frontend: NavItem.permission field (layout.tsx)
NavItem now has `permission?: string`. NavItemLink hides items when `permLoaded && item.permission && !hasPermission(item.permission)`.
Applied to: payroll, revenues, expenses, cashflow, bank-accounts, advances (financial:view), users (users:view), office-settings (settings:view).

## Test file
`artifacts/api-server/src/tests/rbac.test.ts` — run via:
`pnpm exec esbuild src/tests/rbac.test.ts --bundle=false --platform=node --format=cjs --outfile=/tmp/rbac.test.cjs && node /tmp/rbac.test.cjs`
17/17 checks pass.
