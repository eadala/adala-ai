---
name: Adala Finance Center
description: Finance Center Dashboard (/finance) and Collections (/collections) pages — routes, components, and known pitfalls
---

## Routes — finance/dashboard
- `GET /api/finance/dashboard` — aggregated KPIs + monthly bar chart + expense/revenue categories

## Routes — collections (register static routes BEFORE `:id` routes or they clash)
- `GET /api/finance/collections?status=all|overdue|pending` — list invoices + summary counts
- `GET /api/finance/collections/analytics` — aging buckets (0-30/31-60/61-90/90+), collection rate %, top 5 debtors, monthly collections chart
- `GET /api/finance/collections/profitability` — per-client: totalBilled, totalCollected, outstanding, collectionRate%, avgDaysToPay
- `POST /api/finance/collections/bulk-reminder` — send email reminder to array of invoice IDs; body: { invoiceIds: string[] }; returns { sent, skipped }
- `POST /api/finance/collections/:id/payment` — mark invoice paid, insert revenue entry
- `POST /api/finance/collections/:id/reminder` — single email reminder
- `POST /api/finance/collections/:id/stage` — body: { stage: 1-4, notes }; inserts into collection_stages + collection_activities
- `POST /api/finance/collections/:id/partial-payment` — body: { amount (SAR float), paymentMethod, referenceNumber, notes }; auto-marks paid if total >= invoice total
- `GET /api/finance/collections/:id/activities` — returns { activities, currentStage, partials }

## DB Tables (smart collections)
- `collection_stages` — id, invoice_id, stage (1-4), notes, created_at
- `collection_activities` — id, invoice_id, type (reminder_sent|payment_recorded|partial_payment|stage_changed|note_added), amount, note, created_at
- `partial_payments` — id, invoice_id, amount (halalas), payment_method, reference_number, notes, created_at

## Collection Stages
- 1=تواصل أولي (blue), 2=تذكير ثاني (amber), 3=إشعار أخير (orange), 4=إجراء قانوني (red)

## Frontend
- `/finance` → `src/pages/finance-center.tsx` — recharts BarChart (monthly) + PieChart (expense categories)
- `/collections` → `src/pages/collections.tsx` — **3-tab system**:
  - لوحة التحليلات: aging analysis bars + monthly collections BarChart + top debtors + 4 stat cards
  - الفواتير: checkbox multi-select + bulk reminder + stage dialog + partial payment dialog + full payment + activity log
  - ربحية الموكلين: sortable table with collection rate progress bars

## Nav
- Both in sidebar `nav.groups.financial` group; i18n keys: `nav.items.finance_center` + `nav.items.collections`

## Known pitfalls
- Button `size="xs"` does NOT exist — use `size="sm"`
- Toast: `useToast` from `@/hooks/use-toast` (hook)
- Invoice amounts stored in halalas (÷100 for SAR display); partial_payments.amount also in halalas
- In raw SQL use table name `client_invoices` (not the Drizzle alias)
- Static collection routes (analytics, profitability, bulk-reminder) MUST be registered before parameterized `:id` routes

**Why:** Finance Center is the hub entry point; /collections is now a full smart collections system.
