---
name: Adala Operating Centers Navigation
description: layout.tsx restructured into 7 collapsible Operating Centers replacing flat 40+ item nav
---

## Architecture

`OPERATING_CENTERS: OperatingCenterDef[]` replaces old `NAV_GROUPS`.

### 7 Centers (id → color):
1. `legal` → #6366F1 — dashboard, cases, clients, contracts, docs, letters, reminders, calendar, tasks
2. `ai` → #C9A84C — ai-hub, ai-agents, legal-ai, legal-research, judge-prep, opponent-simulator, arbitration
3. `finance` → #10B981 — finance, invoices, collections, payment-center, revenues, expenses, cashflow, bank-accounts, advances, reports, billing
4. `hr` → #F59E0B — hr-center, hr-systems, employees, attendance, leaves, payroll, warnings
5. `digital` → #3B82F6 — office-management, marketplace, client-portal, messages, email, whatsapp, telegram, support, mediators
6. `analytics` → #8B5CF6 — analytics, financial-intelligence, risk-management, activity-stream, audit-logs, compliance, login-tracking, firm-admin, org-structure, users, office-settings, theme-builder, backup, storage
7. `superadmin` → #EF4444 (superAdminOnly) — super-admin, studio, engineering-center

## Key Rules

**Why:** Named export only — `export function Layout`. Any page importing `Layout` must use `{ Layout }` not default.
**How to apply:** If build error says "No matching export for import 'default'" from layout.tsx → change `import Layout` to `import { Layout }`.

## OperatingCenter Component

- Auto-expands when any child route is active (useEffect on isAnyActive)
- ChevronDown rotates 180° when open
- Dashed right-border accent in center color when open
- NavItemLink gets `accentColor` prop → colored right-border + tinted bg when active

## Executive Pulse Bar (dashboard.tsx)

- `GET /api/dashboard/executive` → 12 metrics
- `ExecutivePulseBar` renders 10-cell grid above KPI cards
- Status colors: green/amber/red/neutral per metric thresholds
- refetchInterval: 120_000ms

## AI Client Insights (client-detail.tsx)

- 9th tab in client-detail (grid-cols-9 now)
- `ClientAIInsights` component — 5 analysis types
- Calls existing `/api/ai/analyze-case` POST with structured client context
