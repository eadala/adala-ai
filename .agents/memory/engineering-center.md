---
name: Adala Engineering Center
description: Platform owner engineering console — backend routes, frontend page, super-admin tab
---

## Engineering Center

**Backend**: `artifacts/api-server/src/routes/engineering.ts`
- Guard: `isSuperAdminOrDev()` — checks PLATFORM_OWNER_EMAIL OR publicMetadata.role=super_admin OR publicMetadata.engineering_access=true
- Tables: `engineering_tasks`, `engineering_scans`, `engineering_ip_whitelist`, `engineering_logs`
- Routes prefix: `/api/engineering/`
- Key endpoints: platform-map, performance, db-stats, ai-review, security-scan, ip-whitelist CRUD, tasks CRUD, logs, ip-check

**Frontend**: `artifacts/adala/src/pages/engineering-center.tsx`
- 7 tabs: overview, code-review, security, performance, database, tasks, logs
- Protected under AdminRoute in App.tsx at `/engineering-center`

**Super-Admin**: Tab `{ id: "engineering", label: "مركز الهندسة", icon: Cpu }` added
- EngineeringHeroTab component defined at end of super-admin.tsx
- Uses missing icons added: ArrowRight, ClipboardList, ScrollText from lucide-react (second import block)

**Why:** Platform owner needs an internal engineering console for security scanning, AI code review, performance monitoring, and task management — separate from the regular admin interface.

**How to apply:** Grant developer access via POST /api/engineering/grant-dev-access (sets publicMetadata.engineering_access=true). IP whitelist: add IPs via POST /api/engineering/ip-whitelist.
