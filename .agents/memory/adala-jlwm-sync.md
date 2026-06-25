---
name: JLWM Live Sync Architecture
description: How JLWM keeps its tables in sync with live office data
---

## The Problem
jlwm_world_states has these key columns:
- `state_vector` JSONB (NOT `key_metrics` — that doesn't exist)
- `active_threats` JSONB
- `opportunities` JSONB
- `state_summary` TEXT
- `triggered_by` TEXT
- `valid_until` TIMESTAMPTZ (default NOW()+1h)

Always INSERT new rows (never ON CONFLICT for world_states) — each compute is a snapshot.
The GET endpoint returns the most recent row (ORDER BY computed_at DESC LIMIT 1).

## Case Twins Correct Columns
jlwm_case_twins: health_score, complexity_score, risk_level, financial_exposure, state_data
NOT: twin_data, task_completion_rate, overdue_tasks_count, doc_count

## Client Twins Correct Columns
jlwm_client_twins: loyalty_score, risk_score, ltv_score, total_cases, won_cases, lost_cases,
active_cases, total_invoiced, total_paid, payment_reliability, churn_risk, behavioral_patterns
NOT: value_score, win_rate, twin_data

## Auto-Sync Architecture
rebuildJLWMFromLiveData(officeId, triggeredBy) in enterpriseReport.ts — exported for reuse.
EventBus listeners in jlwm/index.ts:
- CASE_CREATED/UPDATED/CLOSED → scheduleRebuild (5s debounce)
- CLIENT_ADDED → scheduleRebuild (5s debounce)

**Why:** World state should mirror real cases/clients automatically. Without EventBus,
users had to manually click "مزامنة شاملة" and even that used the wrong columns.
**How to apply:** Any new event type that changes office data should call scheduleRebuild.
