---
name: Adala Comm Permissions
description: Role-based communication permissions for client messaging — who can reply, manage portal, share timeline, handle intake
---

## DB table
`client_comm_settings` (office_id UNIQUE, reply_roles text[], portal_roles text[], timeline_roles text[], intake_roles text[], require_reply_approval bool)

## Backend helpers (client-portal.ts)
- `getOfficeUser(req)` — Clerk auth → userId/officeId/email/isSA/officeRole/isAdmin
- `checkCommPerm(u, action)` — admin bypass first; reads DB settings or falls back to DEFAULT_COMM_ROLES
- `DEFAULT_COMM_ROLES`: reply=[firm_owner,office_manager,lawyer,secretary], others=[firm_owner,office_manager,lawyer]

## Protected routes
- POST /portal/create-token — portal perm
- DELETE /portal/tokens/:id — portal perm
- PUT /portal/tokens/:id/settings — portal perm
- POST /portal/tokens/:id/share-doc — reply perm
- DELETE /portal/tokens/:id/share-doc/:docId — reply perm
- POST /portal/timeline/:caseId — timeline perm (only if isShared=true)

## messages.ts
- POST /messages — requires reply perm via getMsgUser()+canReplyToClient() (mirrors client-portal.ts pattern)

## Settings API
- GET /api/comm-settings — returns settings + allRoles list + isAdmin + currentUserRole
- PATCH /api/comm-settings — admin only; uses toArr() helper: `"{role1,role2}"::text[]` pattern for Drizzle sql template tag

## Frontend
- `CommSettingsDialog` in client-portal.tsx; role pill toggles per action; shows read-only for non-admins
- Accessible via "صلاحيات التواصل" button in page header (next to refresh/new-token)
- toast from `sonner` (not @/hooks/use-toast)

## Key pattern: text[] arrays in Drizzle sql template
Use `toArr = (arr) => "{" + arr.join(",") + "}"` then `${toArr(arr)}::text[]`
Values must be whitelisted before building the literal (role names validated against ROLE_LABELS keys).
