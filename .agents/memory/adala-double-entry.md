---
name: Adala Double-Entry Accounting
description: Full double-entry accounting system with chart of accounts, journal entries, and financial statements
---

## Tables
- `chart_of_accounts` — (office_id, account_code UNIQUE per office, account_name, account_type, parent_code)
- `journal_entries`   — (office_id, entry_date, description, reference_number, reference_type, reference_id, posted_by)
- `journal_items`     — (entry_id FK, office_id, account_code, account_name, account_type, debit, credit)

## Backend: `src/routes/journalAccounting.ts`
- `ensureJournalTables(officeId)` — creates tables + seeds Arabic chart of accounts for law firms (35 accounts, 1xxx/2xxx/3xxx/4xxx/5xxx)
- `autoPostJournalEntry(opts)` — exported function called by accounting.ts on revenue/expense CREATE
- Routes: `GET/POST /accounting/journal/accounts`, `GET/POST /accounting/journal/entries`
- Financial statements: `GET /accounting/statements/income`, `/balance-sheet`, `/trial-balance`
  - Income statement falls back to revenues/expenses tables if no journal entries yet
  - Balance sheet includes current-period net income from P&L accounts
  - Trial balance shows debit/credit totals + net balance per account

## Auto-posting in `src/routes/accounting.ts`
- Revenue POST → Dr Cash/Bank (1110/1120), Cr Revenue account (4100-4500 by category)
- Expense POST → Dr Expense account (5100-5900 by category), Cr Cash/Bank (1110/1120)
- Auto-posting is non-blocking (no await, `.catch(() => {})`)

## Frontend: `src/pages/financial-statements.tsx`
- 4 tabs: قائمة الدخل / الميزانية العمومية / ميزان المراجعة / دفتر اليومية
- Chart of accounts section below tabs (add new accounts inline)
- Print-ready (PRINT_CSS, all controls hidden on print)
- Route: `/financial-statements` in App.tsx + nav item in layout.tsx (Scale icon)

## Key constraints
- `ensureJournalTables()` must be called before first use per office (idempotent via CREATE IF NOT EXISTS + seed guard)
- Manual journal entries validated: totalDebit must equal totalCredit (within 0.01)
- Income statement works even with zero journal entries by aggregating revenues/expenses tables directly
- `account_code` is office-scoped UNIQUE so different offices have isolated charts

**Why:** Enables proper financial statement extraction (قائمة الدخل, الميزانية العمومية) with full audit trail — the core request for منصة قوائم compatibility.
