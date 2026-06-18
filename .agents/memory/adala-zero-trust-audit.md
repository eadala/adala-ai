---
name: Adala Zero Trust Multi-Tenant Audit
description: Results and patterns from the full 10-phase Zero Trust penetration audit. Score achieved, files fixed, and scan methodology.
---

## Audit Result (June 2026)
- **Final Score: 98/100** (after all phases complete)
- 939 API routes; 86.4% protected (481 requireAuthWithTenant + 330 admin/auth)
- 0 remaining true IDOR vulnerabilities after full audit
- 107/175 tenant tables have explicit office_id column
- 36+ tables have RLS enabled (API layer is primary isolation mechanism)

## Key Fix Pattern
Every tenant-scoped mutation must include `AND office_id = ${tenantId}` in WHERE clause:
```ts
const tenantId = (req as any).tenantId as string;
await db.execute(sql`DELETE FROM table WHERE id = ${id} AND office_id = ${tenantId}`);
```

## Files Fixed in This Audit
- `case.ai.ts` — UPDATE case_ai_insights
- `timeline.ts` — DELETE case_timeline
- `tasks.ts` — UPDATE/DELETE tasks
- `ai-agent.ts` — close_case/list_cases/get_briefing scoped
- `ai-workflow.ts` — INSERT+UPDATE ai_workflows with office_id
- `payments.ts` — PATCH/settle/batch-settle/DELETE
- `financialCore.ts` — dashboard (was global!), ledger INSERT
- `document-templates.ts` — replaced 'default' with real tenantId
- `clients.ts` — expenses SELECT with office_id
- `orgStructure.ts` — all PATCH/DELETE with office_id
- `aiChat.ts` — UPDATE ai_tasks with tenantId
- `hrPerformance.ts` — DELETE evaluations/incentives
- `internal-messages.ts` — UPDATE/DELETE office_messages
- `hrInternal.ts` — DELETE/PATCH announcements/requests + leave_balances employees scoped
- `notifications.ts` — mark-read now requireAuthWithTenant + office_id

## DB Migrations Applied
Tables with office_id added: ai_workflows, collection_stages, collection_activities,
partial_payments, organization_units, performance_evaluations, employee_incentives,
hr_announcements (schema), employee_requests (schema), leave_balances (schema),
plan_notifications, ledger_entries

Indexes added: ~14 new performance indexes on office_id columns

RLS enabled on 5 additional tables: ledger_entries, ai_workflows, organization_units,
mediator_tasks, payment_transactions

## False Positive Patterns in IDOR Scanner
The following are NOT real IDOR (scanner false positives):
- `marketplace.ts` DELETE/UPDATE with `user_id !== userId` pre-check → safe (user-owned)
- `calendar.ts` DELETE with `existing[0].user_id !== authUserId` → safe (user-owned)
- `storage.ts` storage_settings with `getMgmtUser + u?.isSA` → safe (superAdmin)
- `storage.ts` folder_permissions with `getFolderAccess(id, u, 'manage')` → safe (permission-checked)
- `support-ai.ts` UPDATE support_tickets from internal autoRespondToTicket() → not HTTP request
- `client-auth.ts` UPDATE client_accounts OTP/password → client self-auth domain
- `webhookHandlers.ts` UPDATE by gateway_payment_id → payment gateway callback

## Why
API-layer isolation is primary (DB superuser bypasses RLS even with FORCE ROW SECURITY).
Every route must validate tenantId from requireAuthWithTenant and include it in all queries.
