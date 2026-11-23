---
name: Adala Checkout.com Payment Gateway
description: User requested Checkout.com as primary MENA payment gateway alongside existing Stripe Connect
---

# Checkout.com Integration Plan

## The Rule
Add Checkout.com as a MENA-first payment gateway alongside (not replacing) Stripe Connect.

**Why:** Stripe doesn't support Mada (Saudi debit) natively. Checkout.com supports Mada + Apple Pay + KNET + Visa/MC in one SDK, making it ideal for Gulf clients paying legal fees.

## Planned Stack
- **Checkout.com** — primary gateway for MENA (Mada, Apple Pay, Visa, Mastercard)
- **Tabby / Tamara** — BNPL installments for legal retainers (via Checkout.com partnerships)
- **Stripe Connect** — keep for international offices / existing accounts

## How to Apply
When building: create `checkout_transactions` table, add `/api/payments/checkout/*` routes, payment-center tab "Checkout.com" alongside existing Stripe tab. Use `@checkout.com/checkout-sdk-js` on frontend.

## Marketing Pitch
"يمكن للعميل توقيع العقد، استلام الفاتورة، دفع الأتعاب إلكترونياً، ومتابعة القضية بالكامل من داخل عدالة AI"
