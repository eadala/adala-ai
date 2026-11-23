---
name: Adala email cron
description: Automatic email notification cron job — how it's wired and the deduplication pattern
---

# Adala Email Cron Job

## Rule
The cron job lives in `artifacts/api-server/src/cron/emailCron.ts` and is started via `startEmailCron()` in `index.ts`. It runs every hour (`0 * * * *`).

**Why:** Lawyers need proactive reminders about invoices, sessions, and tasks without manual intervention.

## How to apply
- To add a new trigger type: add a function in `emailCron.ts`, check `triggers.<key> === false`, call `alreadySent()` + `logSend()`, then call it inside `runEmailCron()`.
- Trigger keys must match the `TRIGGER_ITEMS` keys in `artifacts/adala/src/pages/email-notifications.tsx` (e.g. `case_session` not `session_tomorrow`).
- SMTP settings come from `email_notification_settings` table (managed via `/api/email-notifications/settings`).
- Deduplication: `recipient_ref` column added to `email_notification_logs` via `ALTER TABLE … ADD COLUMN IF NOT EXISTS`. Check within 23h window.
- Manual run endpoint: `POST /api/email-notifications/run-now` — returns `{ invoices, sessions, reminders }` counts.
- `runEmailCron()` is also exported for use in the manual endpoint (dynamic import in `emailNotifications.ts`).

## Current trigger types
| Key | When | Target |
|-----|------|--------|
| `invoice_due` | invoice due in 1-3 days, status not paid/cancelled | client email from `clients` table |
| `case_session` | event start_at = tomorrow, status != cancelled | event_reminders.email OR office from_email |
| `reminder_due` | reminder due_date = today, done = false | user email from `users` table OR office from_email |
