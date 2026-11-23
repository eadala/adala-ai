---
name: Adala Go-Live Security Hardening
description: Route auth coverage, tenant-scoping patterns, and pitfalls discovered during the Go-Live hardening audit
---

# Adala Go-Live Security Hardening

## Final State (after hardening)
- **671 total routes**, **610 protected** (90.9%), **61 intentionally public**
- Zero orphan INSERTs (cases/clients/documents/contracts/invoices all include office_id)
- Zero cross-tenant UPDATE bugs

## Critical Bugs Fixed
1. `finance-center.ts` "mark invoice paid" — was completely unprotected + no WHERE office_id
2. `subscription.ts` mark-all-read — `UPDATE plan_notifications SET is_read=TRUE` with NO WHERE tenant (wiped ALL tenants)
3. `reminders.ts` — hardcoded `office_id='default'` throughout
4. `ai-agent.ts` `executeAction()` — INSERT INTO cases/clients/invoices without office_id (now accepts officeId param)
5. `copilot.ts` — INSERT INTO cases without office_id (fixed with getTenantSafe())
6. `marketplace.ts` — auto-case INSERTs on order/deal completion without office_id (fixed with resolveTenantId(userId))

## Auth Middleware Architecture
- `requireAuthWithTenant` — sets req.userId + req.tenantId, runs AsyncLocalStorage context, fires `set_config('app.current_tenant')`; use for ALL data-writing routes
- `requireAuth` — sets req.userId only, no tenant; use for user-scoped but not office-scoped routes (billing, notifications, my-sessions)
- `adminOnly` — defined LOCALLY in each file that needs it (hosting.ts, studio.ts, admin.ts, planCms.ts, homeCms.ts, promo.ts); there is NO shared `../middlewares/adminOnly` file
- `devOnly` / `engineeringOnly` / `pccOnly` / `agentOnly` — specialized guards defined locally

## Import Fix Pattern
When bulk-adding auth middleware via sed, the import is NOT automatically added. Use this Node.js scan to fix mismatches:
```js
// Check: file uses requireAuthWithTenant in routes but import is missing it
// Fix: update/add import line to include all needed names
```
**Why:** sed adds text to route definitions but `grep -q "requireAuth" file` also matches route definitions (not just imports), so naive "add if not present" check fails.

## Intentionally Public Routes (61 total)
- `/healthz`, `/mobile-status` — health probes
- `/billing/plans`, `/billing/stripe-status`, `/billing/calc-fee`, `/plans` — public pricing
- `/client-auth/*` (8 routes) — client portal's OWN auth system (scrypt + OTP, not Clerk)
- `/signatures/token/:token/*` — e-sign link flow
- `/portal/:token/*` — client portal (token auth)
- `/webhook/whatsapp/*`, `/webhook/moyasar/*` — HMAC-verified webhooks
- `/marketplace/services` GET, `/marketplace/categories` GET, `/marketplace/stats` GET — public browse
- `/office/public/:slug/*` — public office pages
- `/home/content` GET, `/theme-builder/public-tokens`, `/theme-builder/presets` — landing/theming
- Static lists: `/ai-models/available`, `/rbac/permissions`, `/legal-ai/templates`, `/command-center/commands`, `/ai-agents/list`, `/fincore/providers`, `/email/smtp-status`
- `/security/login` POST — login event recording (happens before auth)
- `/push/*` — push notification device tokens
- `/events/stream`, `/events/recent`, `/events/stats` — SSE event feed
- `/appointments/*` — aliases that pass through to auth-protected `/calendar/events/*`

## **Why:** adminOnly has NO shared file
`../middlewares/adminOnly` does NOT exist. Each route file that needs super-admin gating defines its own local `isSuperAdmin()` + `adminOnly()` functions. Copying from admin.ts pattern.
