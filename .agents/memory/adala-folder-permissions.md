---
name: Adala Folder Permissions
description: Role-based access control for storage_folders — visibility levels, permission helpers, and UI dialog
---

## DB Changes
- `storage_folders`: added `visibility TEXT DEFAULT 'everyone'` + `allowed_roles TEXT[]`
- `folder_permissions (id, folder_id, user_id, user_name, can_read, can_write, can_delete, granted_at)` — UNIQUE(folder_id, user_id)

## Visibility Levels
- `everyone` — all office members can read + write; only creator/admin can rename/delete
- `admins_only` — only firm_owner, office_manager, super_admin
- `owner_only` — only the creator + admins
- `custom` — per-user grants in folder_permissions table

## getMgmtUser() now returns
`{ userId, officeId, email, isSA, officeRole, isAdmin }`  
Admin roles: `firm_owner`, `office_manager` (isAdmin=true); isSA always isAdmin.

## Routes changed
- `PATCH /storage/folders/:id` → split into two:
  - `PATCH /storage/folders/:id/rename` — requires manage permission
  - `PATCH /storage/folders/:id/permissions` — update visibility
- New: `GET /storage/folders/:id/permissions`, `POST/DELETE /storage/folders/:id/permissions/users/:userId`
- New: `GET /storage/team` — returns office members for permissions UI

**Why:** The old single PATCH route conflicted with the new permissions PATCH; separated by intent.

## Frontend (documents.tsx)
- `FolderPermissionsDialog` component — visibility selector + custom user grants panel
- `VisibilityBadge` component — shows icon for non-everyone folders in tree
- `FolderNode` — shows ShieldCheck button (manage) only if `node.canManage !== false`
- `permFolder` state drives the dialog open/close
- `renameFolderMut` now calls `/rename` endpoint
