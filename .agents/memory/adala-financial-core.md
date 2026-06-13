---
name: Adala Financial Core
description: Payment Abstraction Layer + Double-entry Ledger + Wallets + Payouts + /financial-core dashboard
---

## Tables (auto-created via ensureFinancialCoreTables)
- `financial_accounts` — per entity balances (debit/credit side effects)
- `ledger_entries` — double-entry: debit_account, credit_account, amount, entry_type
- `wallets` — available_balance + pending_balance + total_earned + total_withdrawn per owner_id
- `lawyer_payouts` — amount/platform_fee/net_amount/status/bank_reference per office

## Routes (financialCore.ts registered in index.ts)
- GET  /api/fincore/dashboard  — platform KPIs + monthly trend + gateway split + wallet list + recent ledger
- GET/POST /api/fincore/ledger  — double-entry ledger CRUD
- GET/POST /api/fincore/wallets  — wallet list + credit endpoint
- GET/POST /api/fincore/payouts  — payout management
- PATCH /api/fincore/payouts/:id/process  — status workflow: pending→processing→sent
- POST /api/fincore/settlement  — daily settlement: settles all pending payouts + marks payment_transactions as settled
- GET  /api/fincore/providers  — list payment gateways with configured status
- POST /api/fincore/pay  — create payment via orchestrator
- POST /api/fincore/refund  — refund via orchestrator
- GET  /api/fincore/reports  — monthly aggregates + top clients (period: 3m/6m/1y)

## Payment Abstraction Layer (orchestrator.ts)
- File: `artifacts/api-server/src/payments/orchestrator.ts`
- `PaymentService.createPayment(provider, data)` — routes to StripeAdapter | MoyasarAdapter | CheckoutAdapter
- `PaymentService.verifyPayment(provider, ref)` / `refund(provider, paymentId, amount?)`
- `PaymentService.listProviders()` — returns configured status for each provider
- Env vars: STRIPE_SECRET_KEY (configured), MOYASAR_SECRET_KEY, CHECKOUT_SECRET_KEY
- axios is required — installed in api-server package.json

## Frontend (/financial-core page)
- 6 tabs: لوحة القيادة | دفتر الأستاذ | المحافظ | التحويلات | التقارير | بوابات الدفع
- Nav key: nav.items.financial_core → "النواة المالية" (ar) / "Financial Core" (en)
- Uses recharts (AreaChart, BarChart, PieChart) — already installed
- CSV export on any tab

**Why:** Unified financial control system for platform admins; separate from accounting module (which is per-office revenues/expenses) — this is the platform-level ledger and payout engine.
