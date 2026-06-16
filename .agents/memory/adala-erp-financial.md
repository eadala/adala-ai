---
name: Adala ERP Financial Upgrade
description: Enterprise double-entry accounting with per-office ERP ledger, reconciliation engine, AI guard
---

## Rule
All financial data must be scoped by office_id in EVERY query (SELECT, INSERT, UPDATE, DELETE).
Never read revenues/expenses/bank_accounts/cash_advances without WHERE office_id = tenantId.

## Why
Critical isolation bug was found: `db.select().from(revenuesTable)` without WHERE leaked all offices' data.
All Drizzle ORM reads in accounting.ts were converted to raw SQL with explicit office_id scoping.

## Key tables
- `office_erp_ledger` — per-office double-entry (DEBIT/CREDIT, office_id NOT NULL, RLS enabled)
- `financial_anomalies` — logs cross-tenant attempts, imbalances, duplicates
- `chart_of_accounts` / `journal_entries` / `journal_items` — old journal accounting (still active)

## Key files
- `src/modules/financial/accounting.ts` — FIXED: all queries now use raw SQL with WHERE office_id
- `src/modules/financial/erp-ledger.ts` — postDoubleEntry(), getERPBalance(), 3 routes: /erp/ledger|balance|income-statement
- `src/modules/financial/financial-event-engine.ts` — recordFinancialEvent() called fire-and-forget from invoices.ts + accounting.ts
- `src/modules/financial/reconciliation.ts` — reconcile() compares invoices/expenses vs ERP ledger
- `src/modules/financial/financial-guard.ts` — scrubFinancialData() blocks cross-tenant + masks IBAN/account#

## Event hooks
- INVOICE_CREATED → AR (debit) ← Revenue (credit)
- INVOICE_PAID → Cash/Bank (debit) ← AR (credit)
- PAYMENT_RECEIVED / revenue insert → same as INVOICE_PAID
- EXPENSE_RECORDED / expense insert → Expense (debit) ← Cash (credit)
- PAYROLL_PAID → Salaries (debit) ← Bank (credit)

## How to apply
When adding any new financial route: always use db.execute(sql`... WHERE office_id = ${tenantId} ...`)
When creating any new table with financial data: add office_id NOT NULL + RLS policy

## Pattern for safe financial INSERT
```ts
const tenantId = (req as any).tenantId as string;
const row = one(await db.execute(sql`
  INSERT INTO my_table (office_id, ...) VALUES (${tenantId}, ...) RETURNING *
`));
```
