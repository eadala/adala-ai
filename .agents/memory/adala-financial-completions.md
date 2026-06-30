---
name: Adala Financial Completions
description: New backend module (financial-completions.ts) that adds non-breaking financial hardening — tax settings, invoice revisions, credit notes, ZATCA, AR aging, period comparison, unified summary, AI assistant.
---

# Financial Completions Module

## File: `artifacts/api-server/src/modules/financial/financial-completions.ts`
Registered in `routes/index.ts` as `financialCompletionsRouter` after `financialGuardRouter`.

## New DB Tables (created via ensureFinancialCompletionTables on startup)
- `office_tax_settings` — per-office VAT config (UNIQUE on office_id, ON CONFLICT DO UPDATE)
- `invoice_revisions` — version history snapshots per invoice
- `credit_notes` — credit note records linked to original invoices
- Added cols to `client_invoices`: `invoice_number`, `zatca_uuid`, `qr_code_data`, `locked_at`, `linked_credit_note_id`
- Created sequence `invoice_seq`; backfills `invoice_number` for existing invoices on startup

## New API Routes
- `GET /accounting/tax-settings` — get office tax config (defaults: rate=15, enabled=true, VAT)
- `PATCH /accounting/tax-settings` — upsert with ON CONFLICT DO UPDATE
- `GET /invoices/:id/revisions` — version history (office-scoped)
- `POST /invoices/:id/credit-note` — create credit note (fullCredit=true or amount=X, reason required)
- `GET /accounting/credit-notes` — list all credit notes for office
- `GET /invoices/:id/zatca` — ZATCA QR code (TLV Base64 encoded), assigns zatca_uuid if missing
- `GET /accounting/reports/by-case` — revenues + invoices grouped by case
- `GET /accounting/reports/by-client` — invoices grouped by client with AR stats
- `GET /accounting/reports/by-lawyer` — invoices grouped by assigned lawyer (cases JOIN)
- `GET /accounting/reports/ar-aging` — AR buckets: current/1-30/31-60/61-90/90+ days
- `GET /accounting/reports/period-comparison` — curr vs prev period (month/quarter/year)
- `GET /accounting/unified-summary` — single P&L source of truth (year param)
- `POST /accounting/ai-analysis` — read-only AI financial assistant (Gemini, no data writes)

## Export
`recordInvoiceRevision()` is exported for use by invoices.ts on invoice edits.

## Frontend Changes
- `financial-reports.tsx` — rewritten with 5 tabs: الملخص / القانوني / الذمم / المقارنة / مساعد AI
- `tax-settings.tsx` — new page at `/tax-settings` for office-level VAT config
- `invoices.tsx` — added zatca_uuid/invoice_number/qr_code_data to Invoice type; added credit note + revision history + ZATCA in action menu
- `layout.tsx` — added "إعدادات الضريبة" nav item with Settings2 icon (financial:view permission)
- `App.tsx` — added TaxSettings lazy import + /tax-settings route

**Why:** auditLog.details is type `string` not object — always use template literals not objects.
**Why:** ZATCA QR uses TLV encoding (tag+length+value) per Saudi GAZT spec — 5 fields: seller name, tax number, timestamp, total, VAT amount.
