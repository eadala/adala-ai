---
name: Adala Multi-Role Frontend Architecture
description: 3 isolated route guards in App.tsx — AdminRoute/WorkspaceRoute/ProtectedRoute + useRole hook
---

# Multi-Role Frontend Architecture

## Pattern
- `useRole()` in `hooks/use-role.ts` returns `{ role: "platform_admin" | "law_firm_user", isLoaded: boolean }`
  - Super admin = `publicMetadata.role === "super_admin"` OR email in `VITE_SUPER_ADMIN_EMAILS`
  - Always wait for `isLoaded` before redirecting (show PageLoader while false)

## Route Guards (App.tsx)
- `AdminRoute` — platform_admin only → AdminLayout; non-admins → /dashboard
- `WorkspaceRoute` — law firm users only → OnboardingGate+Layout; platform_admin → /super-admin
- `ProtectedRoute` — any authenticated user (law firm pages neither admin-only nor workspace-exclusive)
- `RoleAwareRedirect` — used on "/" after sign-in to send each role to its world

## Admin Routes
`/super-admin`, `/studio`, `/financial-core`, `/audit-logs` all use `AdminRoute`

## Workspace Routes
`/dashboard`, `/cases`, `/cases/:id`, `/clients`, `/clients/:id` use `WorkspaceRoute`

## AdminLayout
`components/admin-layout.tsx` — dark sidebar (#0a0f1e), 5 nav groups, completely separate from law firm Layout

**Why:** platform_admin must never see law firm UI; law_firm_user must never access platform admin pages
**How to apply:** new law-firm pages → WorkspaceRoute; new platform pages → AdminRoute
