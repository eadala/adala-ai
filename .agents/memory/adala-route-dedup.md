---
name: Adala duplicate route resolution
description: Routes that were duplicated across files and how they were resolved
---

## Duplicate routes found and fixed

### GET /admin/plans
- **admin.ts** (registered first, line ~130) read from `plansTable` via Drizzle
- **planCms.ts** (registered later, dead) read from `plan_cms` via `getDbPlans()`
- **Fix:** Remove from admin.ts. planCms.ts is authoritative.
- **Why:** plan_cms is the newer CMS-managed table; PlansCmsTab calls /api/billing/plans
  (not /admin/plans) for reads, and PUT/POST-reset for writes — both go to planCms.ts.

### GET /finance/intelligence
- **financialIntelligence.ts** (registered first at index line 133) uses `getUnifiedFinancialAI()` service
- **finance-center.ts** (registered later at index line 152, dead) used direct SQL
- **Fix:** Remove from finance-center.ts. financialIntelligence.ts is authoritative.

## Rule: check registration order in routes/index.ts
Express uses FIRST match. When a route appears in two files, check which file is
imported first in index.ts — that version wins; the other is dead code and should be removed.
