---
name: Client Acquisition Portal
description: Durable decisions for the office store → Stripe → case/portal creation flow
---

## Routing rule (subscription vs. store payment)
When `checkout.session.completed` fires with `metadata.officeSlug` AND no `metadata.plan` → call `handleOfficeServicePayment()`.
**Why:** Subscription and store payments share the same Stripe event; the `plan` key distinguishes them.

## Ad-hoc columns (outside Drizzle schema)
- `cases`: `source TEXT DEFAULT 'manual'`, `store_order_id TEXT`, `created_by TEXT`
- `office_orders`: `auto_case_id TEXT`, `portal_token TEXT`
- Guaranteed at boot via `ensureAdHocColumns()` in `index.ts` — not only in the webhook path.
**Why:** Drizzle typed selects ignore unlisted columns; boot migration ensures they exist before any request hits GET /cases or GET /cases/:id.

## Webhook idempotency
- Check `orderRow.auto_case_id` immediately after order fetch; return early if already set.
**Why:** Stripe retries `checkout.session.completed`; idempotency prevents duplicate cases/tokens/emails.

## store_order_id FK
- `cases.store_order_id` = `office_orders.id` (DB PK), not the Stripe session ID.
**Why:** Enables JOIN queries for service name, amount, etc. in case detail.

## Canonical URL for Stripe redirect URLs
- Use `APP_URL` env → `REPLIT_DOMAINS` → fallback `https://adala.sa` for `success_url`/`cancel_url`.
- Never trust `req.headers.origin` (redirect-hijacking risk).

## Raw SQL requirement for case list/detail
- Both `GET /cases` and `GET /cases/:id` must use raw SQL (not Drizzle typed select) to return `source`, `store_order_id`, and `orderDetails` (joined from office_orders + office_services).
**How to apply:** Any new case endpoint surfacing source/order context needs raw SQL.

## Service detail page
- Route: `/firms/:slug/service/:serviceId` → `office-service-detail.tsx`
- ServiceCard requires `slug` prop; renders "التفاصيل" link to the detail page.
- Detail page handles both Stripe checkout (paid services) and quote-request (custom price) flows.

## Email
- Sent via `sendAcquisitionEmail()` using SMTP env vars (SMTP_HOST/USER/PASS/PORT/SECURE/FROM).
- Silently skipped if SMTP not configured.

## Frontend polling
- `useSearch()` from wouter (not `useLocation`) to parse `?paid=1&session=...`
- `refetchInterval` stops once status ≠ "pending"
- Success overlay rendered before isLoading/isError guards in office-public.tsx
