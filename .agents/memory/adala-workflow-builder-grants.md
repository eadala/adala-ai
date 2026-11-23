---
name: Adala AI Workflow Builder Grants
description: Access control system for AI Workflow Builder — super admin only + per-office grant
---

## Rule
AI Workflow Builder is guarded at 3 layers:
1. **Backend**: `requireWorkflowAccess` middleware checks `req.isSuperAdmin` OR `workflow_builder_grants.is_active = true` for the office
2. **Frontend nav**: `superAdminOnly: true` on NavItem hides it from regular users via OperatingCenter filter
3. **Page level**: `access-check` query shows ShieldOff screen if not authorized

## Grant system
- Table: `workflow_builder_grants` (office_id UNIQUE, granted_by, is_active, notes, granted_at)
- Super admin routes: GET/POST `/admin/workflow-grants`, DELETE `/admin/workflow-grants/:officeId`
- UI: `WorkflowGrantsTab` in super-admin.tsx (tab id: "workflow-grants")

**Why:** User explicitly requested "فقط لي سوبر أدمن والمطور وهم لديهم الصلاحية يعطونها حسب الباقة وحسب المكتب"

## How to apply
- Any new super-admin-only page: add `superAdminOnly: true` to nav item in layout.tsx and add access-check endpoint in the backend route
- `requireAuthWithTenant` already sets `req.isSuperAdmin = true` for super admins (no office in DB)
- Always use `authFetch` (Clerk Bearer token) in frontend — no hardcoded dev headers
