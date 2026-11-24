---
name: Adala AI Command Center
description: Super-admin-only AI hub at /ai-command-center with 8 specialized agents + Development Commander
---

## Location
- Page: `artifacts/adala/src/pages/platform/ai-command-center.tsx`
- Backend: `artifacts/api-server/src/modules/ai/aiCommandCenter.ts` + `devCommander.ts`
- Route: `/ai-command-center` (AdminRoute — super admin only)
- Nav: "مركز قيادة الذكاء" in layout.tsx admin section

## 8 AI Agents
| ID | Name | Color | Specialty |
|----|------|-------|-----------|
| legal | وكيل قانوني | #6366F1 | Case analysis, legal strategy |
| financial | وكيل مالي | #10B981 | Revenue, invoicing, forecasting |
| hr | وكيل الموارد البشرية | #F59E0B | Performance, payroll, leaves |
| security | وكيل أمني | #EF4444 | Audit, threats, permissions |
| analytics | وكيل التحليلات | #8B5CF6 | KPIs, usage, trends |
| growth | وكيل النمو | #06B6D4 | Acquisition, marketing, expansion |
| operations | وكيل التشغيل | #F97316 | Tasks, workflows, productivity |
| developer | قائد التطوير | #64748B | Platform diagnostics + proposals |

## DB Tables
- `ai_command_sessions` — chat history per user+agent
- `dev_commander_proposals` — fix proposals with status/approval/audit

## Development Commander (developer agent)
- 3 tabs: Scan / Proposals / Chat
- Scan: calls GET /dev-commander/scan → memory%, CPU, DB stats, isolation, AI analysis
- Proposals: approve (auto-executes sql_safe) or reject, all logged to audit_logs
- Chat: POST /dev-commander/ai-analyze → AI reply + auto-extract [PROPOSAL] blocks

## Auth
- All backend routes: `isSuperAdmin()` (Clerk email list + publicMetadata.role)
- Frontend: `AdminRoute` wrapper
- Approval of proposals requires super admin confirmation, logged to audit_logs

## Important patterns
- [PROPOSAL] blocks in AI replies are auto-extracted into proposals table
- `fix_type: "sql_safe"` proposals auto-execute SQL on approve
- `fix_type: "manual"` proposals require human action after approve
- Never executes dangerous operations without explicit approval
