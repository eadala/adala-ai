---
name: Adala feature-gating system
description: How subscription plans gate UI nav items and API routes; key files and patterns
---

## Architecture

`GET /api/office/subscription` → reads `officePageTable.plan` slug → looks up `plansTable.featureFlags` → returns flags + limits.

## Key files
- `artifacts/api-server/src/routes/subscription.ts` — 3 endpoints: GET subscription, GET plan-notifications, PATCH read-all
- `artifacts/api-server/src/middleware/feature-gate.ts` — `requireFeature(code)` middleware factory + `invalidateFeatureCache()` (1-min in-memory cache)
- `artifacts/adala/src/hooks/use-office-plan.ts` — `useOfficePlan()` returns `{ plan, hasFeature(code), planSlug, limits }` + `usePlanNotifications()`
- `artifacts/adala/src/components/layout.tsx` — nav items have optional `feature?: string`; locked items show Lock icon + Tooltip + redirect to /billing

## Plan change flow (admin)
When `PATCH /admin/offices/:id` receives a new `plan` value:
1. Fetch old plan, compare
2. If changed → INSERT into `plan_notifications` table with upgrade/downgrade title+message
3. Call `invalidateFeatureCache()` to bust the 1-min cache immediately
4. Plan change notifications surface in the main notifications panel (notifications.ts block 10)

## Feature flag keys
`ai, clientPortal, officePage, legalStore, apiAccess, seo, whatsapp, branches, workflow, sla, customDomain, advancedReports, calendar, whiteLabel`

## DB
`plan_notifications` table: id, type, old_plan, new_plan, title, message, is_read, created_at — also defined as `planNotificationsTable` in `lib/db/src/schema/billing.ts`

**Why:** Existing TS errors in api-server (plansTable/officePageTable not found) are pre-existing and don't block runtime — server uses tsx.
