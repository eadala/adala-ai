# Feature Discovery — Frontend (`artifacts/adala`)

**Scope:** medium exploration for digital law firm simulation  
**Source of truth:** `src/App.tsx` (wouter routes) + `src/lib/routeRegistry.ts`  
**Date:** 2026-11-14  
**Package:** `@workspace/adala` (Vite + React + wouter)

---

## 1. Domain → route → page map

| Domain | Primary route(s) | Guard | Page module |
|--------|------------------|-------|-------------|
| **Clients** | `/clients`, `/clients/:id` | `WorkspaceRoute` | `src/pages/legal-core/clients.tsx`, `client-detail.tsx` |
| **Cases** | `/cases`, `/cases/:id` | `WorkspaceRoute` | `src/pages/legal-core/cases.tsx`, `case-detail.tsx` |
| **Documents** | `/documents`, `/documents/new` | `ProtectedRoute` | `src/pages/legal-core/documents.tsx` |
| | Related: `/contracts`, `/letters`, `/warnings`, `/document-templates`, `/document-center` | `ProtectedRoute` | legal-core + `platform/document-center.tsx` |
| **Calendar / hearings** | `/hearings-calendar` | `WorkspaceRoute` | `src/pages/legal-core/hearings-calendar.tsx` |
| | `/calendar` | `ProtectedRoute` | `src/pages/operations/calendar.tsx` |
| **HR** | `/hr`, `/hr-center`, `/hr-enterprise`, `/hr-systems` | `ProtectedRoute` | `src/pages/hr/hr-center.tsx`, `hr-systems.tsx`, … |
| | `/employees`, `/attendance`, `/leaves`, `/org-structure`, `/branches` | `ProtectedRoute` | `src/pages/hr/*`, `platform/branches.tsx` |
| **Payroll** | `/payroll` | `RoleRoute` (`payroll:view`) | `src/pages/hr/payroll.tsx` |
| **Finance / invoices** | `/invoices`, `/invoices/new` | `ProtectedRoute` | `src/pages/financial/invoices.tsx` |
| | `/finance`, `/revenues`, `/expenses`, `/cashflow`, `/collections`, `/payment-center`, `/financial-reports`, `/financial-statements`, `/bank-accounts`, `/advances`, `/tax-settings`, `/financial-intelligence` | `ProtectedRoute` | `src/pages/financial/*` |
| | Admin finance: `/financial-core`, `/financial-engine`, `/finance-dashboard`, `/enterprise-finance` | `AdminRoute` / protected | financial + platform |
| **Settings** | `/settings`, `/office-settings` | `ProtectedRoute` | `src/pages/platform/office-settings.tsx` |
| | Related: `/users` (`users:view`), `/team`, `/storage-settings`, `/firm-admin`, `/my-profile`, `/my-sessions`, `/integrations`, `/notification-settings`, … | mixed | `src/pages/platform/*`, `operations/*` |
| **AI** | `/ai-hub` (canonical) | `ProtectedRoute` | AI hub page under `src/pages/ai/` |
| | `/ai-tasks`, `/ai-coo`, `/ai-router`, `/legal-ai`, `/opponent-simulator`, `/command-center`, `/ai-workflow-builder` | `ProtectedRoute` | ai + legal-core + platform |
| | Aliases → `/ai-hub`: `/ai-copilot`, `/adoul`, `/ai-chat`, `/ai-agents`, `/ai-assistant` | redirect | — |
| | Admin: `/ai-command-center` | `AdminRoute` | `platform/ai-command-center.tsx` |
| | JLWM suite: `/jlwm`, `/jlwm/simulation`, … | `ProtectedRoute` | `src/pages/jlwm/*` |
| **Subscriptions** | `/billing` (“الاشتراك والباقات”) | `ProtectedRoute` | `src/pages/financial/billing.tsx` |
| | `/upgrade` | `ProtectedRoute` | `src/pages/platform/upgrade.tsx` |
| | Public: `/pricing` | `PublicPage` | `src/pages/marketplace/pricing.tsx` |
| | No dedicated `/subscriptions` path — billing/upgrade/pricing cover plan lifecycle |

### Router mechanics

- **Library:** wouter (`WouterRouter` + `Switch` / `Route`), not React Router.
- **Registry:** `src/lib/routeRegistry.ts` (~155 routes) + `scripts/validate-routes.mjs`.
- **Layouts:** `WorkspaceRoute` / `ProtectedRoute` / `RoleRoute` wrap `Layout` + `OnboardingGate`; `AdminRoute` wraps `AdminLayout`.
- **Note:** registry lists `/hr` and `/settings` as redirect aliases; `App.tsx` mounts the same page components on both paths (functional equivalent).

---

## 2. Playwright / E2E readiness

| Signal | Finding |
|--------|---------|
| Playwright / Cypress deps | **None** in `artifacts/adala/package.json` |
| `playwright.config.*` / `e2e/` | **Not present** under frontend or workspace (excl. dist/git noise) |
| Frontend tests | Node/tsx **static assertion** scripts only under `src/tests/` |
| Test scripts | `test:auth-fetch`, `test:create-routes`, `test:documents-create-folder`, `test:storage-signed-open`, `test:auth-fetch-migration`, `test:object-storage-labels`, `test:legal-core-pagination`, `test:office-tasks-mutate` |
| CI E2E | No browser E2E harness discovered for this SPA |

**E2E readiness: not ready.** Simulation should assume manual / API-driven flows, or introduce Playwright from scratch. Existing coverage is source-level contract checks (routes, authFetch migration), not UI journeys.

---

## 3. Auth patterns

| Layer | Mechanism |
|-------|-----------|
| IdP | **Clerk** (`@clerk/react`) — `ClerkProvider` in `AppRoutes`; publishable key + optional `proxyUrl` |
| Public entry | `/` Landing renders **outside** ClerkProvider; other routes enter `AppRoutes` |
| Sign-in/up | `/sign-in/*?`, `/sign-up/*?` — Clerk `<SignIn>` / `<SignUp>` |
| API auth | `authFetch` (`src/lib/authFetch.ts`) attaches `Authorization: Bearer <token>` via `ClerkAuthFetchBridge` |
| Ready gate | `useAuthReady()` / `isAuthReady()` — React Query `enabled` for protected calls |
| Route guards | `PublicPage`, `ProtectedRoute` (any signed-in), `WorkspaceRoute` (non–platform_admin), `AdminRoute` (`platform_admin`), `RoleRoute` (RBAC permission) |
| Onboarding | `OnboardingGate` → `/onboarding` when state incomplete |
| Permissions | `usePermissions()` + `permissionsRegistry`; examples: `payroll:view`, `users:view` |
| Timeout | `useClerkTimeout` — redirect home if Clerk never loads |
| 2FA pages | `/2fa-setup` (protected), `/2fa-verify` (public) |
| Client portal | Separate public paths: `/portal/login`, `/portal/my-cases`, `/portal/:token`, `/firms/:slug/*` |

---

## 4. Arabic RTL support signals

| Signal | Evidence |
|--------|----------|
| App shell RTL | Root App wrapper: `<div dir="rtl" …>` in `App.tsx` |
| i18n default | `src/i18n/i18n.ts` — default/fallback **`ar`**; `languageChanged` sets `document.documentElement.dir` / `lang` |
| Locales | `src/i18n/ar/common.json`, `en/common.json`; `react-i18next` + language switcher |
| HTML | `index.html` title/meta Arabic (“عدالة AI”); loads **Tajawal**; many pages also use **Cairo** |
| Page-level | Widespread `dir="rtl"` on page roots/dialogs; `ar-SA` / `date-fns` `arSA` for dates/currency |
| UX copy | Primary UI strings Arabic across legal-core, HR, finance, platform |

**Verdict:** Arabic-first RTL is production-default; EN is secondary via i18n switch (html `lang`/`dir` sync).

---

## 5. Simulation implications (concise)

1. Prefer **workspace** paths for core firm demo: `/clients`, `/cases`, `/hearings-calendar`.
2. Finance/docs/HR use **ProtectedRoute** (any auth role); payroll needs **RBAC**.
3. Subscriptions demo = `/billing` + `/upgrade` (+ public `/pricing`).
4. AI demo entry = `/ai-hub` (aliases redirect there).
5. No Playwright — plan smoke paths as authenticated URL visits + API fixtures, not recorded E2E.
