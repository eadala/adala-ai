---
name: Cases Module RLS Audit
description: Full security audit of the cases module — RLS findings, type mismatches, and cache isolation fixes
---

## Finding: DB superuser bypasses FORCE ROW LEVEL SECURITY
PostgreSQL FORCE ROW LEVEL SECURITY blocks the *table owner* but not superusers.
The Replit DB user is a superuser — RLS is not effective at DB level.
**Why:** This is a PostgreSQL fundamental — superusers always bypass RLS.
**How to apply:** Security MUST come from API layer (requireAuthWithTenant + office_id in every query).

## Tables that got RLS + FORCE applied (from audit)
case_hearings, case_messages, case_timeline, case_autopilot_reports, case_ai_insights,
case_intelligence_cache — all added RLS + FORCE + indexes.

## reminders.case_id type history
Started as INTEGER, changed to TEXT (cases.id is TEXT). Any reminder JOIN to cases uses TEXT.

## case_intelligence_cache
- Originally had NO office_id column — added it.
- analyzeCaseIntelligence(caseId, officeId?) now accepts optional officeId.
- Cache SELECT and INSERT both filter/store by office_id when provided.
- Callers in legal.orchestrator.ts and copilot.ts updated to pass officeId.

## audit_logs.id
Had no DEFAULT — added gen_random_uuid()::text. Without this, INSERT fails with NULL constraint.

## Type mismatches in case module
- tasks.office_id = UUID, cases.office_id = TEXT → CaseTasks uses ::text cast (already correct)
- reminders.case_id = was INTEGER, cases.id = TEXT → fixed to TEXT
