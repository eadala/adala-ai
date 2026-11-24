---
name: Adala Mobile App
description: Notes about the عدالة AI mobile web app (PWA) artifact setup, port config, and creation forms
---

## Port Configuration

The mobile app uses `localPort = 8082` (NOT 24009 which was the scaffold default).

Port 24009 is NOT registered in .replit `[[ports]]` — the workflow health checker fails if the port isn't registered there. Port 8082 IS registered (maps to externalPort 3002).

**Why:** `restart_workflow` only succeeds when the process listens on a port listed in .replit's `[[ports]]` section. artifact.toml `[services.env]` sets `PORT=8082` and `BASE_PATH=/adala-mobile/`.

**How to apply:** If creating another artifact that fails "didn't open port XXXXX", check whether that port is in .replit's [[ports]] table. If not, update artifact.toml to use an already-registered port (8082–8094, 20637).

## Pages

- `/` → Home (dashboard with stats from /api/dashboard/overview + /api/dashboard/stats)
- `/cases` → Cases list + collapsible add-case form (+ button in header)
- `/clients` → Clients list + collapsible add-client form (+ button in header)
- `/invoices` → Invoices with summary totals
- `/reminders` → Reminders with add/complete/delete

## Architecture

- React+Vite PWA (NOT Expo) — Arabic RTL, dark navy/gold theme, Cairo font
- Bottom navigation: 4 tabs + center golden FAB (opens quick-add sheet)
- FAB sheet has 3 inline mini-forms: QuickCaseForm / QuickClientForm / QuickReminderForm
- Direct fetch to `/api/...` (same origin, no setBaseUrl needed)
- No Clerk auth — simplified public view
- Uses `sonner` for toasts (NOT shadcn toast)

## Reminders Date Field

Reminders have inconsistent date field names across API responses. Always use triple fallback:
`r.dueDate ?? r.due_date ?? r.due_at`

This applies in home.tsx, app-header.tsx, and any new component reading reminder dates.
