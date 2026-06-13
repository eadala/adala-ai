---
name: Adala Payment Center — Full Settlement System
description: دورة حياة المدفوعات الكاملة — Moyasar + Stripe + Settlement
---

## Architecture (route files)
- **payments.ts** — 14+ routes: connect/*, intent, transactions CRUD, wallet, settle/:id, batch-settle, moyasar/settings, payment-link, moyasar/success
- **billing.ts** — 17 routes: plans, stripe-status, overview, checkout, subscribe, pay/:id, ledger, etc.
- **invoices.ts** — 7 routes: list, get, create, update, delete, payment-link, mark-paid
- **finance-center.ts** — 10 routes: dashboard, collections, analytics, profitability, bulk-reminder, payment, reminder, stage, partial-payment, activities
- **webhook.ts** — WhatsApp + Moyasar webhook handlers

## Stripe Client Rule
- ALL files MUST use `getUncachableStripeClient()` from `../stripeClient`
- NEVER use `new Stripe(process.env.STRIPE_SECRET_KEY)` directly — breaks Replit integration
- Invoice amounts stored in SAR; × 100 before sending to Stripe (halalas)

## DB Tables
- `payment_transactions` — amount, platform_fee, net_amount, status, payment_method, gateway, gateway_payment_id, settlement_status (unsettled/settled), settled_at, settlement_ref
- `office_stripe_accounts` — commission_percent per office
- `moyasar_settings` — publishable_key, secret_key, webhook_secret, test_mode, enabled per office
- `office_ledger`, `client_invoices`, `plan_notifications`, `wallet_transactions`

## Settlement System (new)
- `settlement_status` separate from `status`: payment can be "completed" but still "unsettled" (not yet wired)
- PATCH `/payments/transactions/:id/settle` — single settle with optional bank ref
- POST `/payments/batch-settle` — settle all completed+unsettled; returns `{ settled: N }`
- `ensurePaymentCols()` runs on module load (safe via `.catch(()=>{})`)

## Moyasar Integration
- POST `/webhook/moyasar` — optional HMAC-SHA256 via `x-moyasar-signature` header; maps Moyasar statuses (paid→completed, voided→cancelled, etc.)
- GET `/webhook/moyasar/callback` — redirect-back; updates tx + redirects to /payment-center
- POST `/payments/payment-link` — builds Moyasar checkout URL with publishable_key + creates pending tx
- PUT `/payments/moyasar/settings` — uses `COALESCE(NULLIF(newVal,''), old_val)` to preserve keys not re-entered

## Frontend (payment-center.tsx) — 6 tabs
1. **overview** — lifecycle flow banner, 4 KPI cards, monthly bar chart, gateway pie chart (Recharts PieChart)
2. **wallet** — 3 large wallet cards, settled vs unsettled breakdown cards, distribution bars
3. **settlements** — badge on tab = unsettled count; single/batch settle; history table
4. **transactions** — gateway badge column + settlement_status column + settle icon button per row
5. **gateway** — Moyasar settings form (Switch for enabled/testMode); Payment link generator in same tab
6. **stripe** — Stripe Connect Express setup

## Key Patterns
- `generatedLink` state local to page; resets on dialog close or "رابط جديد" click
- `showSettleDialog` stores tx.id:string | null (not boolean)
- Gateway colors: manual=#6B7280, stripe=#635BFF, moyasar=#1DB954
- `wallet` query replaces `stats` as primary — old `stats` still exists for backwards compat
