---
name: Adala Production Hardening Sprint
description: 7-task hardening sprint — isolation, AI security, RTL, mobile, ErrorBoundary, log rotation
---

## Sprint Summary (completed 2026-06-18)

### Task 1: Prompt Injection ✅
- `src/core/promptSanitizer.ts` — 25 patterns, SYSTEM_PROMPT_GUARD, logInjectionAttempt
- All 6 AI models in callAI() now use guardedSystemPrompt + safeMessage

### Task 2: Backup Jobs Isolation ✅
- backup_jobs + backup_settings got office_id TEXT + index
- All 4 /backup/* routes + 5 /export/* routes filter by tenantId
- backup/create INSERT now saves office_id=tenantId
- download/delete verify ownership (office_id = tenantId) before acting

### Task 3: Wallets Isolation ✅
- wallets + wallet_transactions got office_id TEXT + index
- Routes already isolated via owner_id = tenantId (confirmed)

### Task 4: ErrorBoundary ✅
- AppErrorBoundary upgraded: unique errorId per crash (ERR-XXXXX format)
- Two render modes: full-page (root, isModule=false) vs inline module (label prop)
- Reports to POST /api/monitoring/client-error (system_events table)
- Uses CSS vars → theme-aware in light+dark mode
- "إعادة المحاولة" resets state, "العودة للرئيسية" navigates to /dashboard

### Task 5: RTL ✅
- 293 violations fixed: ml-N→ms-N, mr-N→me-N, pl-N→ps-N, pr-N→pe-N
- Covered: all 100+ pages + all UI components
- Result: 0 remaining RTL violations

### Task 6: Mobile ✅
- 7 fixed-width violations removed:
  - dashboard.tsx 3× min-w-[420px] → overflow-x-auto
  - hr-systems.tsx 2× min-w-[420px] → w-full
  - upgrade.tsx min-w-[500px] → w-full
  - org-structure.tsx min-w-[400px] → w-full

### Task 7: Log Rotation ✅
- `src/cron/logRotationCron.ts` — daily@03:00, purges 9 tables
- 30-day retention (metrics/agents/emails/whatsapp/telegram)
- 90-day retention (stripe_reconciliation_log — financial)
- 7-day retention (ai_analytics_cache)
- Persists daily aggregate count to event_daily_counts before purge

## DB Migrations Applied
- 7 tables got office_id: backup_jobs, backup_settings, wallets, wallet_transactions, subscriptions, ai_conversations, notifications
- 13 new indexes via CREATE INDEX CONCURRENTLY
- 5 orphan office_members cleaned up

## Final Isolation Score
- 20/22 critical tables: ✅ office_id + ✅ index
- ai_conversations/notifications: office_id added, index confirmed
- 0 orphan records

**Why this matters:** Multi-tenant isolation failures in export/backup routes could leak all tenant data to any authenticated user. These were P0/P1 security issues.
