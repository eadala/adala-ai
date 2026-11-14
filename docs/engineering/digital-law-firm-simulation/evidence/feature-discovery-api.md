# Feature Discovery — API Server (`artifacts/api-server`)

**Scope:** IMPLEMENTED business domains for Adalah AI digital law firm simulation  
**Source root:** `/workspace/artifacts/api-server`  
**Date:** 2026-11-14  
**Thoroughness:** medium  

Classifications:
- **IMPLEMENTED_AND_TESTABLE** — routes registered, schema/migrations present, and/or runtime/static tests exercise the domain
- **PARTIAL** — routes exist but schema gaps, permission gaps, or weak/no domain tests
- **NOT_IMPLEMENTED** — no meaningful API surface found
- **UNKNOWN** — insufficient evidence in this pass

All HTTP paths below are mounted under `/api` via `app.use("/api", router)` unless noted.

---

## 1. Route registration topology

| Layer | Path | Role |
|-------|------|------|
| Express app | `src/app.ts` | Health probes, rate limits, Clerk middleware, `/api` mount, `/internal`, `/metrics` |
| Aggregate router | `src/routes/index.ts` | Imports + `router.use(...)` for every business module |
| Module routers | `src/modules/<domain>/*.ts` | Path prefixes defined on each Express `Router` |
| Nested indexes | `src/modules/jlwm/index.ts`, `src/modules/ai/command-center/index.ts` | Only two module-level aggregators |

**Flow:** `src/index.ts` → `src/app.ts` → `clerkMiddleware` → `app.use("/api", router)` → `src/routes/index.ts`.

**Non-module routes:**
- `src/routes/metrics.ts` → `/api/metrics/*`
- `src/routes/internalHeal.ts` → `/internal/*` (not under `/api`)

There is **no** `src/modules/*/index.ts` fan-out except JLWM and AI command-center; other domains are flat files imported directly in `routes/index.ts`.

---

## 2. Module inventory (`src/modules` + `src/routes`)

| Module dir | Primary files | Registered in `routes/index.ts` |
|------------|---------------|----------------------------------|
| `legal-core/` | `cases`, `clients`, `documents`, `contracts`, `arbitration`, `legalAI`, … | Yes |
| `documents/` | `documentCenter.ts` | Yes |
| `financial/` | `billing`, `invoices`, `payments`, `subscription`, `accounting`, … | Yes |
| `operations/` | `tasks`, `messages`, `hr*`, `calendar`, `conversations`, `storage`, … | Yes |
| `ai/` | `aiCredits`, `aiGateway`, `aiChat`, `copilot`, agents, … | Yes |
| `marketplace/` | `office`, `client-portal`, `client-auth`, `firm-admin`, … | Yes |
| `platform/` | `rbac`, `users`, `onboarding`, `branding`, admin/ops surfaces | Yes |
| `integrations/` | email, whatsapp, telegram, push, webhook | Yes |
| `bankruptcy/` | `bankruptcy`, V2, V3, demo | Yes |
| `jlwm/` | `index.ts` + satellites | Yes |
| `monitoring/` | health, prevention, isolation, hardening, … | Yes |
| `security/` | soc, audit/mfa/compliance/dr centers, executive dashboard | Yes |
| `auth/` | `twoFactor.ts` → `/api/2fa` | Yes |
| `src/routes/` | `index.ts`, `metrics.ts`, `internalHeal.ts` | Yes |

---

## 3. Roles / RBAC actually used

### Default role names (`src/modules/platform/rbac.ts` → `DEFAULT_ROLES`)

| Role name | Display (AR) | Notes |
|-----------|--------------|-------|
| `firm_owner` | مالك المكتب | `permissions: ["*"]` |
| `office_manager` | مدير المكتب | Broad ops + payroll + invoices |
| `lawyer` | محامي | Cases/contracts/docs/AI |
| `trainee_lawyer` | محامي متدرب | Read-heavy; default fallback in `requirePermission` |
| `accountant` | محاسب | Invoices/payments/payroll:view |
| `secretary` | سكرتير | Clients/docs/messages |
| `broker` | وسيط | Referral only |
| `collaborator` | متعاون | Shared docs |
| `client` | عميل | Own cases/docs/invoices |

### Other role strings in runtime (not all in `DEFAULT_ROLES`)

| Name | Where used |
|------|------------|
| `super_admin` | Clerk `publicMetadata.role`; `checkIsSuperAdmin` / `requireSuperAdmin` |
| `developer` | `platform/developer.ts` metadata |
| `owner` | `office_members.role` for office ownership / tenant resolver; also `PRIVILEGED_ROLES` in cases |
| `admin` | Conversations member role; cases privileged set |
| `member` | Conversation membership |
| `platform` | Synthetic tenant id for SA (`tenantId = "platform"`), not a role row |

### Permission strings (`ALL_PERMISSIONS` + `requirePermission(...)`)

**Catalogued:** `cases:*`, `clients:*`, `contracts:*`, `documents:*`, `invoices:*`, `payments:*`, `reports:view`, `financial:view`, `payroll:view|manage`, `accounting:delete`, `users:*`, `roles:*`, `settings:*`, `ai:access`, `messages:view|send`, `support:*`, `referral:*`, `collaborator:access`, `audit:view`, `dashboard:view`.

**Gap:** `hr.ts` calls `requirePermission("hr:manage")` but **`hr:manage` is not in `ALL_PERMISSIONS` nor any default role** → attendance/location admin paths effectively SA/`*` only unless roles are customized.

API prefixes: `/api/rbac/roles`, `/invitations`, `/permissions`, `/my-permissions`, `/members`, …

---

## 4. Domain inventory (simulation-critical)

### 4.1 Clients

| Field | Value |
|-------|-------|
| **Name** | Clients |
| **Key files** | `src/modules/legal-core/clients.ts`; schema `lib/db/src/schema/clients.ts` |
| **API prefixes** | `/api/clients`, `/api/clients/stats`, `/api/clients/:id`, `/overview`, `/accounting`, `/portal-activity` |
| **Tables / migrations** | `clients` — `migrations/003_drizzle_baseline_safe.sql`; soft-delete `deleted_at` via runtime ALTER in `cases.ts` startup |
| **Tests** | `legalCorePagination.test.ts` (static path coverage); no dedicated clients HTTP harness |
| **Classification** | **IMPLEMENTED_AND_TESTABLE** |
| **Notes** | Full CRUD + delete gated by `clients:delete`. Strong API surface for simulation seed/use. |

### 4.2 Cases

| Field | Value |
|-------|-------|
| **Name** | Cases |
| **Key files** | `src/modules/legal-core/cases.ts`; `src/case/case.service.ts` + case modules; schema `lib/db/src/schema/cases.ts` |
| **API prefixes** | `/api/cases`, `/stats`, `/:id`, `/hub`, `/timeline`, `/messages`, `/tasks`, `/health`, `/autopilot`, `/ai-insights`, `/court`, `/documents`, … |
| **Tables / migrations** | `cases` — `003`; column repair `017_cases_schema.sql`; AI insights `043`; autopilot reports `028` |
| **Tests** | `legalCorePagination.test.ts`, `caseAiInsightsSchemaAuthority043.test.ts`, `autopilot*` tests |
| **Classification** | **IMPLEMENTED_AND_TESTABLE** |
| **Notes** | Primary legal workhorse. Nested case tasks/messages/docs/hearings. |

### 4.3 Documents

| Field | Value |
|-------|-------|
| **Name** | Documents |
| **Key files** | `legal-core/documents.ts`, `smart-documents.ts`, `document-templates.ts`, `documents/documentCenter.ts`, `operations/storage.ts` |
| **API prefixes** | `/api/documents`, `/api/smart-documents`, `/api/document-templates` (+ `/templates` rewrite), `/api/generated-documents`, `/api/storage/*`, `/api/cases/:id/documents` |
| **Tables / migrations** | `documents` — `003` + `033_document_v2_schema_authority.sql` (`document_versions`, `document_permissions`, …); storage files/folders `007`–`009` |
| **Tests** | `documentV2SchemaAuthority033.test.ts`, many `storage*.test.ts` / runtime ACL tests |
| **Classification** | **IMPLEMENTED_AND_TESTABLE** |
| **Notes** | Dual model: legal `documents` table + object storage files/folders. |

### 4.4 Hearings

| Field | Value |
|-------|-------|
| **Name** | Hearings |
| **Key files** | `src/modules/legal-core/cases.ts` (calendar + CRUD handlers) |
| **API prefixes** | `/api/cases/hearings/calendar`, `/api/cases/:id/hearings`, `PATCH/DELETE .../hearings/:hid` |
| **Tables / migrations** | Uses table `case_hearings` — historically **no `CREATE TABLE` in committed migrations** (only runtime `CREATE INDEX` in cases startup). Workspace also has untracked draft `migrations/062_simulation_schema_gaps_case_hearings_employee_office.sql` that would `CREATE TABLE IF NOT EXISTS case_hearings` + add `employees.office_id` |
| **Tests** | None dedicated under `src/tests` at discovery time; draft helpers appear under untracked `src/tests/runtime/digitalLawFirm/` |
| **Classification** | **PARTIAL** |
| **Notes** | API implemented; schema ownership was a gap. Treat as PARTIAL until 062 (or equivalent) is committed/applied. Calendar events (`/api/calendar/events`, migration `047`) are a separate scheduling surface. |

### 4.5 Tasks

| Field | Value |
|-------|-------|
| **Name** | Tasks (office tasks) |
| **Key files** | `src/modules/operations/tasks.ts`; case-nested via `cases.ts` + `src/case/modules/tasks.ts` |
| **API prefixes** | `/api/office-tasks`, `/stats`; also `/api/cases/:id/tasks` |
| **Tables / migrations** | `tasks` — `015_tasks_branches_schema.sql`; tenant ownership `024_tasks_tenant_ownership.sql` |
| **Tests** | `officeTasksMutate.test.ts` |
| **Classification** | **IMPLEMENTED_AND_TESTABLE** |
| **Notes** | API path is `/office-tasks` (not `/tasks`). Mediator marketplace tasks under `/api/mediators/tasks` are a different domain. |

### 4.6 Messages

| Field | Value |
|-------|-------|
| **Name** | Messages / Conversations |
| **Key files** | `operations/messages.ts`, `internal-messages.ts`, `conversations.ts` |
| **API prefixes** | `/api/messages`, `/api/messages/conversations`; `/api/internal-messages/*`; `/api/conversations/*`; case-linked `/api/cases/:id/messages` |
| **Tables / migrations** | `messages` (`003`); `office_messages` + FTS `016`/`029`/`030`; `message_conversations` + `conversation_members` `031`; indexes `052` |
| **Tests** | `internalMessageCreate.runtime.test.ts`, `internalMessages*TenantIsolation*`, `conversationsListQuery.runtime.test.ts`, `conversationMemberCreate.runtime.test.ts`, schema-authority 030/031/052 |
| **Classification** | **IMPLEMENTED_AND_TESTABLE** |
| **Notes** | Richest messaging stack; internal-messages mounted with path prefix rewrite in `routes/index.ts`. |

### 4.7 HR (employees / org)

| Field | Value |
|-------|-------|
| **Name** | HR core |
| **Key files** | `operations/hr.ts`, `hrInternal.ts`, `hrPerformance.ts`, `hr-enterprise.ts`; schema `lib/db/src/schema/hr.ts` |
| **API prefixes** | `/api/hr/employees`, `/warnings`, `/investigations`; `/api/hr-internal/*`; `/api/hr-perf/*`; `/api/hr-enterprise/*` |
| **Tables / migrations** | `employees`, `employee_warnings`, `employee_investigations`, `office_location` — `003`; announcements/requests `048`; performance `049`; enterprise roles/workflows `050` |
| **Tests** | `hrInternalSchemaAuthority048`, `hrPerformanceSchemaAuthority049`, `hrEnterpriseSchemaAuthority050`, leave/payroll runtime tests (adjacent) |
| **Classification** | **IMPLEMENTED_AND_TESTABLE** |
| **Notes** | Large surface; enterprise HR has its own role tables (`hr_roles`) separate from platform RBAC. |

### 4.8 Payroll

| Field | Value |
|-------|-------|
| **Name** | Payroll |
| **Key files** | `operations/hr.ts` (generate/pay); `hrPerformance.ts` (`/hr-perf/smart-payroll/preview`); `hrInternal.ts` (payslip) |
| **API prefixes** | `/api/hr/payroll`, `/stats`, `/generate`, `/:id/pay`, `/pay-all`; `/api/hr-perf/smart-payroll/preview`; `/api/hr-internal/payslip/:payrollId` |
| **Tables / migrations** | `payroll` — `003`; incentives/settings `049` |
| **Tests** | `hrPayrollGenerate.runtime.test.ts`, `hrSmartPayroll.runtime.test.ts` |
| **Classification** | **IMPLEMENTED_AND_TESTABLE** |
| **Notes** | Gated by `payroll:view` / `payroll:manage` (present on office_manager/accountant/firm_owner). |

### 4.9 Attendance

| Field | Value |
|-------|-------|
| **Name** | Attendance |
| **Key files** | `operations/hr.ts` |
| **API prefixes** | `/api/hr/attendance`, `/stats`, `/check-in`, `/check-out`, `POST /hr/attendance`; `/api/hr/office-location` |
| **Tables / migrations** | `attendance`, `office_location` — `003` |
| **Tests** | No dedicated attendance harness (only shared HR module) |
| **Classification** | **PARTIAL** |
| **Notes** | CRUD/check-in implemented, but `hr:manage` permission is missing from RBAC catalog (see §3). |

### 4.10 Leave

| Field | Value |
|-------|-------|
| **Name** | Leave |
| **Key files** | `operations/hr.ts`, `hrInternal.ts` |
| **API prefixes** | `/api/hr/leaves`, `/stats`; `/api/hr-internal/leave-balances` |
| **Tables / migrations** | `leaves` — `003`; `leave_balances` — `048` |
| **Tests** | `hrLeaveBalances.runtime.test.ts`, `hrInternalSchemaAuthority048.test.ts` |
| **Classification** | **IMPLEMENTED_AND_TESTABLE** |
| **Notes** | Request + balance management covered. |

### 4.11 Invoices

| Field | Value |
|-------|-------|
| **Name** | Client invoices |
| **Key files** | `financial/invoices.ts`, `financial-completions.ts`; schema `lib/db/src/schema/invoices.ts` |
| **API prefixes** | `/api/invoices`, `/public/:token`, `/:id/payments`, `/payment-link`, `/mark-paid`, `/send-email`, `/credit-note`, `/zatca`, `/revisions` |
| **Tables / migrations** | `client_invoices` — `003`; extensions + `invoice_payments`, `invoice_revisions`, `credit_notes`, tax — `037`; platform invoices `025` |
| **Tests** | `financialRemainingSchemaAuthority037.test.ts`; related money-numeric tests |
| **Classification** | **IMPLEMENTED_AND_TESTABLE** |
| **Notes** | Distinct from SaaS `invoices` / `platform_billing_invoices` (billing). |

### 4.12 Payments

| Field | Value |
|-------|-------|
| **Name** | Payments |
| **Key files** | `financial/payments.ts`, `payments/orchestrator.ts`, `webhookHandlers.ts` |
| **API prefixes** | `/api/payments/*` (connect, intent, transactions, wallet, moyasar, checkout); invoice payment subroutes |
| **Tables / migrations** | `payment_transactions` — `012`; stripe infra `011`; wallets/ledger pieces `037` |
| **Tests** | `paymentsErrorSwallowing.test.ts`; HTTP adversarial harness hits payments router; `tenantMoyasarWebhookIsolation.static.test.ts` |
| **Classification** | **IMPLEMENTED_AND_TESTABLE** |
| **Notes** | Stripe Connect + Moyasar + checkout; live PSP still needed for end-to-end money movement. |

### 4.13 Subscriptions

| Field | Value |
|-------|-------|
| **Name** | Office / SaaS subscriptions |
| **Key files** | `financial/subscription.ts`, `financial/billing.ts`, `platform/entitlements.ts` |
| **API prefixes** | `/api/office/subscription`, `/api/office/plan-notifications`; `/api/billing/plans`, `/checkout`, `/subscribe`, `/stripe-subscription`, `/change-plan`, … |
| **Tables / migrations** | `subscriptions`, `plans`, `invoices` (platform) — `003`; `office_entitlements`, `platform_billing_invoices` — `025`; promo/gift `026` |
| **Tests** | `billingSchemaAuthority025.test.ts`, `promoSchemaAuthority026.test.ts`, `planSeedReads.test.ts` |
| **Classification** | **IMPLEMENTED_AND_TESTABLE** |
| **Notes** | Platform billing vs client invoicing are separate. Stripe-dependent paths need keys for live tests. |

### 4.14 AI credits

| Field | Value |
|-------|-------|
| **Name** | AI credits / usage |
| **Key files** | `modules/ai/aiCredits.ts` |
| **API prefixes** | `/api/office/ai-credits`, `/api/ai-credits/deduct`; `/api/admin/ai-credits*` |
| **Tables / migrations** | `office_ai_credits`, `ai_credit_transactions`, `ai_usage_logs` — `039` |
| **Tests** | `aiCreditsUsageSchemaAuthority039.test.ts`; `runtime/aiRuntimeIsolationHarness.ts`; `runtime/httpAdversarialHarness.ts` |
| **Classification** | **IMPLEMENTED_AND_TESTABLE** |
| **Notes** | Best example of Clerk-free HTTP test pattern (see §6). |

### 4.15 Adjacent domains (brief)

| Domain | Prefixes | Classification | Notes |
|--------|----------|----------------|-------|
| Contracts | `/api/contracts`, templates | IMPLEMENTED_AND_TESTABLE | `004` + legal-core |
| Calendar / appointments | `/api/calendar/events`, `/appointments` rewrite | IMPLEMENTED_AND_TESTABLE | `047` |
| Client portal / auth | `/api/portal/*`, `/api/client-auth/*` | IMPLEMENTED_AND_TESTABLE | marketplace; OTP/login |
| Office marketplace | `/api/office/*`, `/api/offices/my` | IMPLEMENTED_AND_TESTABLE | adversarial + `officesMy` tests |
| Bankruptcy | `/api/bankruptcy*` | PARTIAL | Schema `014`; demo/V2/V3 — not core law-firm loop |
| JLWM | `/api/jlwm/*` | PARTIAL | Heavy SA/simulation stack; migrations `034`–`036`; not required for basic firm sim |
| Legal AI / research / copilot | `/api/legal-ai`, `/legal-research`, `/copilot`, `/ai-*` | PARTIAL | Needs live model keys; gateway rate-limited |
| Accounting / ERP | `/api/accounting/*`, `/erp/*`, `/fincore/*` | IMPLEMENTED_AND_TESTABLE | Schema `013`/`037` |
| Notifications / events SSE | `/api/notifications`, `/api/events/*` | IMPLEMENTED_AND_TESTABLE | tenant isolation tests |
| RBAC / users / onboarding | `/api/rbac/*`, `/users`, onboarding/trial | IMPLEMENTED_AND_TESTABLE | Foundation for multi-actor sim |

---

## 5. Tables / migrations map (requested domains)

| Domain | Primary tables | Owning migrations (api-server) |
|--------|----------------|--------------------------------|
| Clients | `clients` | `003` (+ runtime `deleted_at`) |
| Cases | `cases` | `003`, `017` (+ `028`, `043` related) |
| Documents | `documents`, `document_versions`, `document_permissions` | `003`, `033` |
| Hearings | `case_hearings` | **Missing CREATE in committed migrations** (indexes only at runtime); draft fix in untracked `062_*.sql` |
| Tasks | `tasks`, `office_branches` | `015`, `024` |
| Messages | `messages`, `office_messages`, `message_conversations`, `conversation_members` | `003`, `016`, `029`, `030`, `031`, `052` |
| HR | `employees`, warnings/investigations, `hr_announcements`, `employee_requests`, `hr_roles`, … | `003`, `048`, `050` |
| Payroll | `payroll`, `employee_incentives`, `hr_settings` | `003`, `049` |
| Attendance | `attendance`, `office_location` | `003` |
| Leave | `leaves`, `leave_balances` | `003`, `048` |
| Invoices | `client_invoices`, `invoice_payments`, revisions, credit notes | `003`, `037` |
| Payments | `payment_transactions`, wallets/ledger | `011`, `012`, `037` |
| Subscriptions | `subscriptions`, `plans`, `office_entitlements`, `platform_billing_invoices` | `003`, `025` |
| AI credits | `office_ai_credits`, `ai_credit_transactions`, `ai_usage_logs` | `039` |

Drizzle mirrors live under `lib/db/src/schema/` (authority comment: migrations own DDL).

---

## 6. Test harnesses (`src/tests`)

### Patterns

| Pattern | Examples | Needs DB? | Needs Clerk? |
|---------|----------|-----------|--------------|
| Static / schema-authority | `*SchemaAuthority*.test.ts`, `schemaAuthority.test.ts` | No (file asserts) | No |
| Runtime SQL/logic | `*.runtime.test.ts` (HR, messages, conversations, storage ACL) | Often yes | No |
| HTTP adversarial (Express subset) | `runtime/httpAdversarialHarness.ts`, `aiRuntimeIsolationHarness.ts` | Yes (`seedRuntimeSchema.sql`) | **No** — test auth |
| Reliability / RLS gates | `rlsMigration061Harness`, `poolGucContainmentHarness`, `platformReliabilityHarness`, `integrationGate009Harness`, `phase010bGateHarness` | Yes | No / N/A |
| Integration | `metricsVitals.integration.test.ts`, `stage152eIntegration.test.ts` | Varies | Usually no |

### Scripts (selected)

See `package.json` scripts: `test:http-adversarial`, `test:ai-runtime-isolation`, `test:hr-*`, `test:office-tasks-mutate`, `test:schema-authority`, `test:tenant-isolation-gate`, many `test:*-0NN` migration authorities.

### Auth test mode (Clerk bypass)

Implemented in `src/middlewares/requireAuth.ts` → `resolveTestAuthUserId`:

1. `NODE_ENV !== "production"`
2. `ADALA_HTTP_SECURITY_TEST=1`
3. `ADALA_TEST_AUTH_SECRET` length ≥ 16
4. Request header `X-Adala-Test-Auth: <secret>`
5. Request header `X-Adala-Test-User: <userId>`
6. Optional tenant: `X-Tenant-Id: <office-uuid>`

`requireAuth` / `requireAuthWithTenant` short-circuit Clerk `getAuth` when test identity resolves.

**Refused in production** even if env flags are set.

---

## 7. How to create an Express app for tests without live Clerk

Preferred pattern (already used by runtime harnesses): **do not import `src/app.ts`** (it always installs `clerkMiddleware`). Instead:

```ts
process.env.NODE_ENV = "test";
process.env.ADALA_HTTP_SECURITY_TEST = "1";
process.env.ADALA_TEST_AUTH_SECRET = "runtime-assurance-secret-key"; // ≥16 chars

import express from "express";
import { createServer } from "node:http";

// Import only the routers under test
import clientsRouter from "../modules/legal-core/clients.js";
import casesRouter from "../modules/legal-core/cases.js";
// ...

const app = express();
app.use(express.json());
app.use("/api", clientsRouter);
app.use("/api", casesRouter);

const server = createServer(app);
// listen(0), fetch with headers:
//   x-adala-test-auth: <ADALA_TEST_AUTH_SECRET>
//   x-adala-test-user: user-a-owner
//   x-tenant-id: <canonical office UUID>
```

**Also required for tenant routes:**
- Seed `office_members` (and offices) so `resolveTenantId` succeeds — see `src/tests/runtime/seedRuntimeSchema.sql`.
- `DATABASE_URL` pointing at an isolated DB.

**Not recommended:** mounting full `app` from `app.ts` without Clerk keys — Clerk middleware still runs for non-beacon paths; test auth only replaces identity *after* middleware when headers match, but missing Clerk config can still break startup/proxy behavior.

**Super-admin paths** still call Clerk (`checkIsSuperAdmin`) unless tests avoid SA-only routes or mock that path — test auth alone does not mark `isSuperAdmin`.

---

## 8. Simulation readiness summary

| Domain | Classification |
|--------|----------------|
| Clients | IMPLEMENTED_AND_TESTABLE |
| Cases | IMPLEMENTED_AND_TESTABLE |
| Documents | IMPLEMENTED_AND_TESTABLE |
| Hearings | PARTIAL (API yes; migration CREATE missing) |
| Tasks | IMPLEMENTED_AND_TESTABLE |
| Messages | IMPLEMENTED_AND_TESTABLE |
| HR | IMPLEMENTED_AND_TESTABLE |
| Payroll | IMPLEMENTED_AND_TESTABLE |
| Attendance | PARTIAL (`hr:manage` RBAC gap; no dedicated tests) |
| Leave | IMPLEMENTED_AND_TESTABLE |
| Invoices | IMPLEMENTED_AND_TESTABLE |
| Payments | IMPLEMENTED_AND_TESTABLE |
| Subscriptions | IMPLEMENTED_AND_TESTABLE |
| AI credits | IMPLEMENTED_AND_TESTABLE |

**Best Clerk-free HTTP proof path today:** `aiCredits` + `office` + `payments` via `httpAdversarialHarness` / `aiRuntimeIsolationHarness`.  
**Highest schema risk for sim:** `case_hearings` lacking committed migration ownership (draft `062` present but untracked at discovery).  
**RBAC gap:** `hr:manage` used by attendance/office-location admin routes but absent from `ALL_PERMISSIONS` / `DEFAULT_ROLES`.
