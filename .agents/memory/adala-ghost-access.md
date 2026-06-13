---
name: Adala Ghost Access
description: Stealth super-admin impersonation — fully invisible, 4h auto-timeout, server-only logs
---

# Ghost Access System (الوصول الخفي)

## The rule
ImpersonationBanner was REMOVED from layout.tsx — ghost sessions are 100% invisible to any screen viewer.
Only the super-admin sees a pulsing violet indicator inside /super-admin header.

## Backend
- Table: `developer_impersonation` — `expires_at = NOW() + INTERVAL '4 hours'` set on every enter
- Table: `ghost_access_log` — server-only audit log (admin_user_id, office_id, office_name, action: enter/exit); created via CREATE TABLE IF NOT EXISTS inside the route; never exposed via any API
- Routes: POST /api/developer/impersonate/:officeId, DELETE /api/developer/impersonate, GET /api/developer/impersonate/status

## Frontend
- SuperAdmin component: `useQuery(["ghost","status"])` polling /impersonate/status every 30s → shows pulsing badge in header
- GhostCenterTab: stats row, search+plan filter, office cards with "دخول خفي" button (opens /dashboard in new tab), active session card with countdown + progress bar

**Why:** Office must never know they're being monitored — any visible banner would defeat the purpose and cause trust issues.

**How to apply:** Never re-add ImpersonationBanner to layout.tsx. Ghost indicator lives ONLY in super-admin.tsx header, scoped to /super-admin route.
