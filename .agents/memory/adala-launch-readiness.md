---
name: Adala Launch Readiness Sprint
description: P0/P1 readiness items before first paying customer
---

## Rate Limiting Coverage (app.ts)
- Global: 300/min all IPs (skip Stripe webhook)
- Strict AI: 30/min on /ai-chat, /legal-ai, /ai-copilot, /copilot, /portal/create-token
- Auth: 10/min on /client-auth/login, /verify-otp
- Register: 5/min on /client-auth/register, /request-otp
- Upload: 20/min on /storage/upload, /documents/upload, /branding/upload (ADDED)

## Disaster Recovery
- `GET /api/backup/dr-test` (requireAuthWithTenant)
- 4 checks: last_backup<48h, JSON integrity, DB live, office_registry exists
- Returns rpo (hours), rto (<2h manual), per-check pass/fail
- No real restore automation — validates that last backup is restorable

## AI Cost Control
- `office_ai_credits` table: daily_limit (50), daily_used, monthly_limit (500), monthly_used, daily_reset_at
- `callAI()` enforces BEFORE model call; auto-resets daily at UTC day boundary
- Routes: GET /api/ai/cost, PATCH /api/ai/cost/limits (super_admin), GET /api/ai/cost/all (super_admin)
- aiCostRouter is a named export from aiChat.ts (NOT the default)

## Status Page
- `GET /api/status` — public, no auth, checks 6 services in parallel
- Persists to service_status table (upsert on service_name)
- Frontend: `/system-status` — public route, no Layout wrapper, auto-refresh 60s
- Status file: artifacts/api-server/src/modules/platform/systemStatus.ts

## Audit Trail old/new values
- `AuditEntry` now accepts `oldValue?: Record<string,unknown>` and `newValue?: Record<string,unknown>`
- `audit_logs` table has `old_value JSONB` + `new_value JSONB` columns
- cases.ts PATCH: fetches before-state via getCase(), logs diff
- contracts.ts PATCH: uses current from SELECT before UPDATE, logs diff
- clients.ts PATCH: logs newValue only (old not fetched — trade-off for performance)

**Why:** First paying customer audit requirements demand knowing what changed, not just that something changed. old/new JSONB allows diffs to be shown in audit log UI.

**How to apply:** Always pass oldValue+newValue in auditLog() for any UPDATE/DELETE on financial or legal records.
