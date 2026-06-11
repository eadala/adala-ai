---
name: Adala Mobile App
description: Notes about the عدالة AI mobile web app (PWA) artifact setup and port configuration
---

## Port Configuration

The mobile app uses `localPort = 8082` (NOT 24009 which was the scaffold default).

Port 24009 is NOT registered in .replit `[[ports]]` — the workflow health checker fails if the port isn't registered there. Port 8082 IS registered (maps to externalPort 3002).

**Why:** `restart_workflow` only succeeds when the process listens on a port listed in .replit's `[[ports]]` section. artifact.toml `[services.env]` sets `PORT=8082` and `BASE_PATH=/adala-mobile/`.

**How to apply:** If creating another artifact that fails "didn't open port XXXXX", check whether that port is in .replit's [[ports]] table. If not, update artifact.toml to use an already-registered port (8082–8094, 20637).

## Pages

- `/` → Home (dashboard with stats from /api/dashboard/overview + /api/dashboard/stats)
- `/cases` → Cases list with filter chips
- `/clients` → Clients list with search
- `/invoices` → Invoices with summary totals
- `/reminders` → Reminders with add/complete/delete

## Architecture

- React+Vite PWA (NOT Expo) — Arabic RTL, dark navy/gold theme, Cairo font
- Bottom navigation (5 tabs)
- Direct fetch to `/api/...` (same origin, no setBaseUrl needed)
- No Clerk auth — simplified public view
- Uses `sonner` for toasts (NOT shadcn toast)
