---
name: Adala Ghost Access
description: Stealth super-admin impersonation — fully invisible, 4h auto-timeout, server-only logs
---

# Ghost Access System — لوحة التحكم المطلقة

## The rule
ImpersonationBanner was REMOVED from layout.tsx — ghost sessions are 100% invisible to any screen viewer.
Only the super-admin sees a pulsing violet indicator inside /super-admin header.

## Backend routes (all guarded by devOnly = isSuperAdmin)
- `developer_impersonation` table — `expires_at = NOW() + INTERVAL '4 hours'` set on every enter
- `ghost_access_log` table — server-only audit; created via CREATE TABLE IF NOT EXISTS; never exposed to offices
- `POST /api/developer/impersonate/:officeId` — start ghost session
- `DELETE /api/developer/impersonate` — end session
- `GET /api/developer/impersonate/status` — check active session
- `GET /api/developer/ghost-log` — owner's own session history (last 100)
- `GET /api/developer/office-snapshot/:officeId` — live snapshot: recentCases, recentClients, invoiceSummary, recentActivity
- `GET /api/developer/offices` — now includes: case_count, client_count, invoice_count, revenue_total, last_activity

## Frontend — GhostCenterTab (super-admin.tsx)
3 sub-tabs driven by `subtab` state ("offices" | "session" | "log"):
- **المكاتب**: search+plan filter, 4-stat summary row, rich office cards (cases/clients/invoices/revenue), expandable snapshot panel per card, "دخول خفي" button
- **الجلسة النشطة**: hero card with live HH:MM:SS countdown (setInterval 1s), progress bar, 12-link quick-access grid opening each office page in new tab (dashboard/cases/clients/invoices/contracts/analytics/hr/messages/settings/accounting/calendar/security)
- **سجل الدخول**: ghost session history (enter/exit events with timestamps)

Module-level constants: `GHOST_QUICK_LINKS`, `GHOST_CASE_STATUS`, `GHOST_INV_COLOR`, `GHOST_INV_LABEL`

**Why:** Office must never know they're being monitored. The quick-links grid gives the owner full navigation across the office without any re-authentication or notifications.

**How to apply:** Never re-add ImpersonationBanner to layout.tsx. Ghost indicator lives ONLY in super-admin.tsx header. All new developer routes must use `devOnly` middleware.
