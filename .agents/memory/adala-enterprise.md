---
name: Adala enterprise modules
description: V2 enterprise feature tables, domain management system, plan features utility
---

## Tables created (via executeSql, not drizzle-kit push)
- LOC dashboard, client portal (/portal/:token public), marketplace, AI workflow engine, calendar, wallet tables
- `office_domains` — subdomain + custom domain + verification + SSL per office
- `office_page.plan` column (starter/professional/business/enterprise, default starter)

## Plan features
- `artifacts/adala/src/lib/plan-features.ts` — `getPlanFeatures(plan)`, `canUseFeature(plan, feature)`, `generateSubdomain(slug)`
- Custom domain: business + enterprise only
- Subdomain: always `[slug].adala-ai.sa`

## Domain management API routes (in office.ts)
- GET /office/my/:officeId/domains
- POST /office/my/:officeId/domains (creates domain record with verification token)
- PATCH /office/my/domains/:id
- POST /office/my/domains/:id/verify
- DELETE /office/my/domains/:id/custom
- PATCH /office/my/:officeId/plan

## Domain management UI
- "النطاق" tab in office-management.tsx
- Shows plan badge + upgrade CTA
- Subdomain card (read-only, copy, external link)
- Custom domain card (locked with upgrade prompt for starter/professional)
- DNS CNAME instructions when custom domain unverified
- SSL + connection status summary cards

**Why:** drizzle-kit push requires TTY — always use executeSql for schema changes.
