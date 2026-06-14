---
name: Adala RBAC Frontend
description: Dynamic RBAC permission system — hook, guard component, team management page, and backend routes
---

## Files
- `artifacts/adala/src/hooks/use-permissions.ts` — `usePermissions()` hook (React Query, staleTime 5min)
- `artifacts/adala/src/components/can.tsx` — `<Can permission="cases:create">` guard (hides, never disables)
- `artifacts/adala/src/pages/team.tsx` — 4-tab team management page (members, permissions matrix, roles, invitations)

## Backend Routes (rbac.ts)
- `GET /api/rbac/my-permissions` — returns `{role, displayName, permissions[], officeId}` for current user
- `GET /api/rbac/members` — lists office members with role + user info from JOIN
- `PATCH /api/rbac/members/:memberId/role` — update member role
- `DELETE /api/rbac/members/:memberId` — soft-delete (sets status=inactive)

## Hook Shape
```ts
const { hasPermission, hasAny, hasAll, isOwner, isAdmin, isLawyer, role, roleDisplayName } = usePermissions();
```

## Permission Logic
- `permissions.includes("*")` = firm_owner (all access)
- Permissions are dot-notation: "cases:view", "users:create", "ai:access", etc.
- `<Can>` accepts: `permission` | `any={[...]}` | `all={[...]}` | `role`

**Why:** Roles live in `rolesTable` and mapped via `office_members.role`. Frontend never hard-codes role checks — always uses `usePermissions()`.
