---
name: Adala Finance Center
description: Finance Center Dashboard (/finance) and Collections (/collections) pages — routes, components, and known pitfalls
---

## Routes
- `GET /api/finance/dashboard` — aggregated KPIs (totalRevenue, expenses, netProfit, paidInvoices, overdueInvoices, pendingInvoices, pendingAdvances, outstandingAdvances) + monthly bar chart data + expense/revenue categories
- `GET /api/finance/collections?status=all|overdue|pending` — list of overdue/sent invoices with client info + summary counts
- `POST /api/finance/collections/:id/payment` — mark invoice paid, insert revenue entry; body: { amount, paymentMethod, notes }
- `POST /api/finance/collections/:id/reminder` — send nodemailer email reminder to client

## Frontend
- `/finance` → `src/pages/finance-center.tsx` — recharts BarChart (monthly) + PieChart (expense categories) + 8 KPI cards + quick-access grid
- `/collections` → `src/pages/collections.tsx` — overdue invoice list, record payment dialog, send reminder, payment link

## Nav
- Both in sidebar `nav.groups.financial` group; i18n keys: `nav.items.finance_center` (مركز المالية) + `nav.items.collections` (التحصيل)

## Known pitfalls
- Button `size="xs"` does NOT exist in this codebase — use `size="sm"` instead
- Toast: import `useToast` from `@/hooks/use-toast` (hook), NOT `@/components/ui/use-toast` (doesn't exist)
- Invoice amounts stored in halalas (÷100 for display in SAR)
- `clientInvoicesTable` aliased as `invoicesTable` in invoices.ts — in raw SQL use table name `client_invoices`

**Why:** Finance Center is the hub entry point for all financial sub-pages; /collections handles overdue collection workflow.
