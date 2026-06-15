---
name: Adala Case Module Architecture
description: New modular case system — src/case/ folder with entity/repository/service/events/modules
---

## Location
`artifacts/api-server/src/case/`

## Structure
- `case.entity.ts` — CaseStatus | CaseType | CaseSource | STATUS_LABELS | TYPE_LABELS
- `case.repository.ts` — CaseRepository(tenantId) — ALL DB queries here, always office_id scoped
- `case.service.ts` — CaseService(tenantId, userId) — business logic, notifications, audit
- `case.events.ts` — CaseEventBus (EventEmitter) bridged to global eventBus (CASE_DELETED is local only)
- `modules/timeline.ts` — CaseTimeline(tenantId) → case_timeline table
- `modules/communications.ts` — CaseCommunications(tenantId) → case_messages table
- `modules/tasks.ts` — CaseTasks(tenantId) → tasks table (case_id::uuid cast required!)
- `modules/documents.ts` — CaseDocuments(tenantId) → documents table

## DB Notes
- cases.office_id = TEXT (not UUID)
- tasks.case_id = UUID — need ::uuid cast when querying by case_id TEXT
- tasks.office_id = UUID — need ::uuid cast when inserting
- case_messages table: id, case_id, office_id, sender_id, sender_name, body, msg_type, is_read, created_at
- CASE_DELETED not in global EventType — don't bridge it to global eventBus

## Routes (routes/cases.ts — thin controller only)
- GET /cases, GET /cases/stats, POST /cases
- GET /cases/:id, PATCH /cases/:id, DELETE /cases/:id
- GET /cases/:id/hub (all related entities in one call)
- GET/POST /cases/:id/timeline
- GET/POST /cases/:id/messages
- GET/POST /cases/:id/tasks
- GET /cases/:id/documents
- GET /cases/:id/health, POST /cases/:id/autopilot

## Frontend
- cases.tsx: KPI cards + status pills + search + table/kanban toggle
- case-detail.tsx: 7 tabs (overview/timeline/tasks/documents/sessions/messages/AI)

**Why:** Replace-not-patch refactor for SaaS production-grade multi-tenant case management.
