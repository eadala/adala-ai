---
name: Adala Plan CMS
description: How subscription plan prices/features are stored in DB and edited from super-admin without code changes
---

## Architecture

- **DB table**: `plan_cms` — seeded from hardcoded `PLANS` array on first access; columns: id, nameAr, nameEn, monthlyPrice, yearlyPrice, description, badge, color, features (jsonb), recommended, isContactOnly, sortOrder, updatedAt
- **Helper**: `getDbPlans()` exported from `planCms.ts` — seeds on first call, returns array sorted by sortOrder
- **Routes**:
  - `GET /api/billing/plans` — public; billing.ts calls `getDbPlans()` with hardcoded PLANS fallback
  - `GET /api/admin/plans/:id` — super-admin only
  - `PUT /api/admin/plans/:id` — super-admin only; returns updated plan
  - `POST /api/admin/plans/reset` — super-admin only; re-seeds all plans from defaults

## Frontend

- `pricing.tsx`: uses `useQuery` to fetch from `/api/billing/plans`; result normalized via `normalizePlan()` (maps monthlyPrice→monthly, etc.); icon mapped by plan ID via `PLAN_ICONS` record; hardcoded `PLANS` used as staleTime=5min fallback; all PLANS.map replaced with PLANS_LIVE.map
- `billing.tsx`: already fetches `/api/billing/plans` via useQuery — auto-updates

## Super-admin tab

- Tab id: `plans-cms`, label: "باقات الأسعار", icon: Tag
- `PlansCmsTab`: sidebar plan list + editor panel; color picker + badge + price inputs + feature list (add/edit/remove) + live preview card + reset-all button

## Key patterns

- `normalizePlan(p)` normalizes API→component shape; always run on both API data and hardcoded PLANS for consistency
- `adminOnly` middleware in planCms.ts uses inline Clerk client check (isSuperAdmin pattern)
- `Tag` icon already imported in super-admin.tsx lucide imports — no new icon import needed
