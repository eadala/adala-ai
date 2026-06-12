---
name: Adala HR Center
description: HR performance evaluation, incentives, smart payroll engine, AI insights
---

# HR Center System

## DB Tables (auto-created via ensureTables in hrPerformance.ts)
- `performance_evaluations` — role-aware scoring (lawyer/secretary/admin), attendance metrics
- `employee_incentives` — manual bonuses/deductions per employee per period  
- `hr_settings` — configurable thresholds/rates, seeded with defaults on first run

## Performance Score Formula
Base 100 points:
- Lawyer: +5/closed case, -8/delayed, +2/task, -7/error
- Secretary: +3/task, +2/client handled, -8/data error
- Admin: +4/op handled, +5/incident resolved, -6/system error
- Attendance (all roles): +3/on-time day, -5/late day, -10/absent day
- Clamped to [0, 100]

## Salary Calculation Engine
- Bonus: ≥90%→30%, ≥80%→20%, ≥70%→10% of base salary
- Deductions: >5 late days→5%, >2 absent days→10%, score<60→15%
- Always adds: GOSI (10%), allowance (15%)
- Manual incentives from employee_incentives table added on top

## API Routes (hrPerformance.ts → registered in index.ts)
- GET /hr-perf/settings — get all config values
- PATCH /hr-perf/settings — update settings
- GET /hr-perf/evaluations — all evaluations (joined with employee name)
- POST /hr-perf/evaluate — create evaluation (auto-calculates score)
- DELETE /hr-perf/evaluations/:id
- GET /hr-perf/incentives — all incentives (joined)
- POST /hr-perf/incentives — add bonus or deduction
- DELETE /hr-perf/incentives/:id
- GET /hr-perf/smart-payroll/preview?period= — simulate payroll for all active employees
- GET /hr-perf/dashboard — KPIs, top performers, need-attention list, AI insights

## Frontend Page (/hr-center) — 6 tabs
1. لوحة التحكم — KPI cards, top 5 performers, need-attention list, recent evals
2. التقييمات — role-aware eval cards with live score preview during input
3. الحوافز — bonuses/deductions table per employee
4. الرواتب الذكية — simulation table (base+allowance+bonus-deduction-GOSI=net)
5. تحليلات AI — auto-generated insights + score distribution bar chart
6. الإعدادات — editable thresholds and rates

## Nav
layout.tsx HR group first item: Award icon, labelKey "nav.items.hr_center"
Award icon MUST be in lucide-react import block in layout.tsx

## Known Gotcha
`Award` is not in the default layout.tsx icon imports — always verify lucide icon imports
when adding new nav items with new icons.
