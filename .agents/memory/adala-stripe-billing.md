---
name: Adala Stripe Billing Engine
description: Production webhook handlers, revenue breakdown columns, fee transparency endpoints
---

## Webhook events handled (webhookHandlers.ts)
All 6 Stripe events are now handled:
1. `checkout.session.completed` → provisionTenant + recordRevenue
2. `invoice.paid` → recordRevenue for subscription renewals (CRITICAL — was missing)
3. `customer.subscription.updated` → sync status + re-provision if plan changed
4. `customer.subscription.deleted` → cancel + downgrade to free + notification
5. `invoice.payment_failed` → mark past_due + notify; auto-downgrade after 3 attempts
6. `customer.subscription.trial_will_end` → reminder notification

## Signature verification
Uses `getUncachableStripeClient()` directly (NOT the fragile getStripeSync() approach).
Pattern: `stripe.webhooks.constructEvent(payload, signature, webhookSecret)`

**Why:** getStripeSync() relied on internal `._stripe` property access which broke silently.

## Revenue breakdown (calcRevenue)
- platformFee = gross × 10%
- stripeFee   = gross × 2.9% + 1.00 SAR fixed
- net         = gross − platformFee − stripeFee
All three stored in office_ledger alongside gross (amount column).

## office_ledger new columns (added via executeSql)
- `stripe_fee` numeric DEFAULT 0
- `platform_fee` numeric DEFAULT 0
- `net_amount` numeric DEFAULT 0
- `stripe_event_id` text (idempotency — ON CONFLICT DO NOTHING)

## New API endpoints
- `GET /api/billing/calc-fee?amount=X` — fee transparency, no auth required
- `GET /api/billing/revenue-report` — totals + monthly chart + recent 20 transactions

## Auto-downgrade logic
After 3 failed payment attempts → calls provisionTenant({plan:'free'}) + plan_notification.
Also fires on subscription.deleted event.

## Invoice amount convention
invoice.paid sends amount_paid in **halalas** → divide by 100 for SAR before recording.
