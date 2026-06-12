---
name: Adala Payment Center
description: Payment system architecture, known bugs fixed, and route inventory
---

## Architecture
- **billing.ts** — 17 routes: plans, stripe-status, overview, checkout, payment-link, stripe-subscription, stripe-invoices, revenue, change-plan, activate-plan, ledger, platform-invoices, subscribe, pay/:id, mark-overdue, alerts
- **payments.ts** — 10 routes: connect/status, connect/create, connect/onboarding, connect/login-link, intent, transactions (CRUD + PATCH status), stats
- **invoices.ts** — 7 routes: list, get, create, update, delete, payment-link, mark-paid
- **finance-center.ts** — 10 routes: dashboard, collections, analytics, profitability, bulk-reminder, payment, reminder, stage, partial-payment, activities
- **subscription.ts** — 3 routes: /office/subscription, /office/plan-notifications, /office/plan-notifications/read-all

## Stripe Client Usage
- All files MUST use `getUncachableStripeClient()` from `../stripeClient` (supports both env var AND Replit integration)
- NEVER use a local `new Stripe(process.env.STRIPE_SECRET_KEY)` — it won't work with Replit Stripe integration

## Fixed Bugs
1. **Invoice payment-link unitAmount**: `invoice.total` is stored in SAR, Stripe needs halalas → always multiply by 100: `Math.round(invoice.total * 100)`
2. **billing.ts Stripe client**: Was using local getStripe() (env var only) → fixed to getUncachableStripeClient()

## DB Tables
- office_stripe_accounts, payment_transactions, client_invoices, plan_notifications, wallet_transactions
- office_ledger, platform_billing_invoices, office_entitlements (used by billing/overview)

## Key Behaviors
- billing/stripe-status: async, tries getUncachableStripeClient(), returns configured:false on error
- Stripe Connect: Saudi Arabia (SA), Express accounts, card_payments + transfers capabilities
- Commission: stored per office in office_stripe_accounts.commission_percent (default 10%)
- Invoice amounts stored in SAR (not halalas) — always × 100 before sending to Stripe
