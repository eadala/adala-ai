---
name: Adala Enterprise HR System
description: نظام HR المؤسسي — Authorization Engine + RBAC + Workflows + Audit + SOC
---

## What was built

### Backend — `src/modules/operations/hr-enterprise.ts`
**Tables (ensureHREnterpriseTables):**
- `hr_roles` — أدوار المكتب (office_id, name, permissions JSONB, hierarchy 1-5)
- `hr_memberships` — انتماء المستخدم للمكتب (user_id, office_id, role_name, status)
- `hr_workflows` — طلبات الموافقة (leave/role_change/new_hire/permission_upgrade/termination)
- `hr_audit_logs` — سجل التدقيق (action, old_value/new_value JSONB, severity)

**Authorization Engine:**
```ts
export async function authorize(userId, officeId, permission): Promise<boolean>
```
يستعلم عن hr_memberships JOIN hr_roles WHERE permissions @> [permission] OR [*]

**SOC Integration:**
`emitHRSecurityEvent(type, officeId, data)` → eventBus.emit({type:"SECURITY_EVENT", data:{hrEventType,...}})
Events: HR_ROLE_CHANGED | HR_PERMISSION_CHANGE | HR_MEMBER_SUSPENDED | HR_HIGH_PRIORITY_REQUEST | HR_PERMISSION_ESCALATION_APPROVED

**Routes:**
- POST /hr-enterprise/authorize
- GET/POST /hr-enterprise/roles
- PATCH /hr-enterprise/roles/:name/permissions
- GET/POST /hr-enterprise/members
- PATCH /hr-enterprise/members/:userId/role|suspend|activate
- GET/POST /hr-enterprise/workflows
- GET /hr-enterprise/workflows/stats
- PATCH /hr-enterprise/workflows/:id/approve|reject
- GET /hr-enterprise/audit
- GET /hr-enterprise/overview
- GET /hr-enterprise/org-chart

### Backend — `src/modules/operations/hr.ts` (FIXED)
**Critical isolation bugs fixed:** All Drizzle ORM reads replaced with raw SQL WHERE office_id.
- employees: SELECT/INSERT/PATCH/DELETE all scoped to tenantId
- attendance: scoped via INNER JOIN employees WHERE e.office_id = ${tid}
- leaves: scoped via INNER JOIN employees WHERE e.office_id = ${tid}
- payroll: scoped via INNER JOIN employees WHERE e.office_id = ${tid}
- warnings: scoped via INNER JOIN employees WHERE e.office_id = ${tid}
- investigations: scoped via INNER JOIN employees WHERE e.office_id = ${tid}

### Frontend — `src/pages/hr/hr-enterprise.tsx`
6 tabs: Org Chart | Members | Roles Matrix | Workflows | Audit | Settings
- Org chart shows hierarchy tree (Partner→Intern) with color coding
- Members: add/change-role/suspend/activate with role select
- RBAC matrix: permission checkmarks per role with wildcard badge
- Workflows: submit+approve+reject with priority icons
- Audit log: severity badges + action/target/timestamp

**Why:**
- `hr.ts` was missing WHERE office_id on ALL SELECT queries — data leakage between offices
- Enterprise HR needs per-office role isolation, not global roles
- SOC integration via existing eventBus.emit pattern (no separate emitSecurityEvent)
- INNER JOIN pattern (not LEFT JOIN) is used for attendance/leaves/payroll to enforce office isolation
