---
name: Adala Client Acquisition Portal
description: Stripe webhook flow that auto-creates a case + client account + portal token when a client pays on the public office page
---

# Client Acquisition Portal

## The rule
When `checkout.session.completed` fires with `metadata.officeSlug` present AND no `metadata.plan`, it is an office service payment — run `handleOfficeServicePayment()`.

**Why:** Subscription payments share the same event but carry `metadata.plan`. Without this guard, subscription payments would incorrectly trigger case creation.

## How to apply
- `webhookHandlers.ts` — branch added in `processWebhook()` after event #6 (before `runStripeSync`)
- `handleOfficeServicePayment()` function in same file — full 11-step flow
- `office.ts` checkout — `success_url` uses `{CHECKOUT_SESSION_ID}` template var; `metadata.clientEmail` also stored
- `GET /api/office/public/:slug/order-success?sessionId=...` — polled by frontend every 3s until status ≠ "pending"
- `office-public.tsx` — payment success overlay renders BEFORE `isLoading`/`isError` guards

## DB columns added (via ALTER TABLE IF NOT EXISTS)
- `office_orders`: `status TEXT`, `auto_case_id TEXT`, `portal_token TEXT`
- Tables auto-created if missing: `client_accounts`, `client_portal_tokens`, `client_case_links`, `case_timeline`

## Email
- Sent via `sendAcquisitionEmail()` using SMTP env vars (SMTP_HOST / SMTP_USER / SMTP_PASS / SMTP_PORT / SMTP_SECURE / SMTP_FROM)
- Skipped silently if SMTP not configured

## Frontend polling
- `useSearch()` from wouter (not `useLocation`) to parse `?paid=1&session=...`
- Query `refetchInterval` returns `false` once status ≠ "pending"
- Overlay shown unconditionally when `isPaid && paidSession` — bypasses office not-found guard
