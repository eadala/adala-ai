# Customer Zero Report — Enterprise Law Firm Simulation

**Program:** ADALA Enterprise Customer Zero  
**Tenant:** مكتب الخليج للمحاماة والاستشارات (`cccc0000-0000-0000-0000-000000000001`)  
**Date:** 2026-07-07  
**Branch:** `cursor/enterprise-customer-zero-da81`

---

## Mission Summary

Operated ADALA as a **40-person multi-branch law firm** (simulated) across onboarding, daily legal ops, finance, HR, and adversarial testing. Fixed **P0 blockers** in-place; documented P1–P3 backlog.

---

## Success Criteria Answers

| # | Question | Answer | Evidence |
|---|----------|--------|----------|
| 1 | Can a law firm onboard without developer help? | **Partially** | Onboarding wizard exists (`/onboarding`); trial auto-provision works; enterprise needs Clerk linking + seed |
| 2 | Can every employee understand their permissions? | **Improving** | Nav now hides unauthorized modules; `/team` shows roles; permission clarity doc added |
| 3 | Can daily legal work be completed end-to-end? | **Yes (core)** | Cases, clients, documents, contracts guarded; 35 seeded matters |
| 4 | Can finance operate billing? | **Yes (core)** | Invoices + accounting + payments RBAC complete |
| 5 | Can management trust reports? | **Partial** | Financial reports exist; HR extended modules unguarded |
| 6 | Can the platform survive security review? | **Improving** | Critical enumeration + payment bypasses fixed; RLS still pending (PR-TNT-002) |

**Enterprise Readiness Score:** 6.8 / 10 (see `ENTERPRISE_READINESS_SCORE.md`)

---

## Environment Created

### Seed script

```bash
DATABASE_URL=... pnpm --filter @workspace/api-server exec tsx src/runCustomerZeroSeed.ts [--force]
```

**Files:** `customerZeroSeed.ts`, `runCustomerZeroSeed.ts`

### Tenant structure

| Role | Clerk placeholder ID | Default role |
|------|---------------------|--------------|
| Partner | `cz_user_partner_001` | `firm_owner` |
| Office Manager | `cz_user_manager_001` | `office_manager` |
| Lawyers (2) | `cz_user_lawyer_*` | `lawyer` |
| Associate | `cz_user_associate_001` | `trainee_lawyer` |
| Assistant | `cz_user_assistant_001` | `secretary` |
| Accountant | `cz_user_accountant_001` | `accountant` |
| HR | `cz_user_hr_001` | `office_manager` |

### Data volume (post-seed)

| Entity | Count |
|--------|------:|
| Clients | 20 |
| Cases | 35 |
| Invoices | 25 |
| Employees | 10 |
| Revenue/expense rows | 30 |
| Office members | 8 |

Branches modeled via metadata tags (Riyadh / Jeddah) — native multi-branch routing deferred to P1.

---

## What Worked

| Workflow | Screens | APIs |
|----------|---------|------|
| Onboarding wizard | `/onboarding` | `POST /onboarding/setup` |
| Case management | `/cases`, `/cases/:id` | `/api/cases/*` |
| Client CRM | `/clients` | `/api/clients/*` |
| Invoicing | `/invoices` | `/api/invoices/*` |
| Accounting | `/revenues`, `/expenses` | `/api/accounting/*` |
| Payroll | `/payroll` | `/api/hr/payroll/*` |
| RBAC admin | `/team`, `/users` | `/api/rbac/*` |
| AI hub | `/ai-hub`, `/ai-copilot` | `/api/ai/*` (feature-gated) |

---

## What Failed (Before Fixes)

| Finding | Severity | Screen | API | Root cause |
|---------|----------|--------|-----|------------|
| Any member could list team | **P0** | `/team` | `GET /rbac/members` | No `users:view` guard |
| Any member could list invitations | **P0** | `/team` | `GET /rbac/invitations` | No `users:view` guard |
| Payments unguarded | **P0** | `/payment-center` | `/api/payments/*` | PR-AUTH-003 deferred |
| Payment webhook cross-tenant UPDATE | **P0** | — | `POST /webhook/checkout` | No `office_id` in WHERE |
| Moyasar settings default tenant | **P0** | — | `moyasar_settings` DDL | `DEFAULT 'default'` |
| Office manager blocked from HR | **P0** | `/employees` | `/api/hr/employees` | Missing `hr:manage` on role |
| Finance nav visible to all | **P1** | Sidebar | — | Missing `permission` on nav items |
| HR nav visible to all | **P1** | Sidebar | — | Missing `permission` on nav items |

---

## Fixes Implemented (This Program)

| ID | Fix | Files |
|----|-----|-------|
| CZ-P0-001 | `users:view` on members/invitations list | `rbac.ts` |
| CZ-P0-002 | `roles:view` on roles list | `rbac.ts` |
| CZ-P0-003 | Full payments RBAC | `payments.ts` |
| CZ-P0-004 | Webhook tenant-scoped UPDATE + signature | `payments.ts` |
| CZ-P0-005 | Remove `default` tenant from payment settings DDL | `payments.ts` |
| CZ-P0-006 | `hr:manage` + `payments:create` for `office_manager` | `rbac.ts` |
| CZ-P0-007 | Finance/HR nav permission gates | `layout.tsx` |
| CZ-P0-008 | Customer Zero seed environment | `customerZeroSeed.ts` |
| CZ-P0-009 | Enterprise abuse test suite | `enterprise-abuse.test.ts` |
| CZ-P0-010 | Governance Layer 10 includes `payments.ts` | `platform-check.mjs` |

---

## Remaining Risk

| Risk | Severity | Mitigation path |
|------|----------|-----------------|
| HR extended modules unguarded | P1 | PR-AUTH-005 |
| `billing.ts` uses `requireAuth` not tenant RBAC | P1 | Platform billing separation |
| No PostgreSQL RLS | P1 | PR-TNT-002e |
| Multi-office switching UX | P2 | Primary office + header selector |
| Contract GET reads unguarded | P2 | PR-AUTH-006 |
| AI credit abuse vectors | P2 | Entitlements strict mode audit |

---

## Screens Affected by Fixes

- Sidebar navigation (finance, HR, quick actions)
- `/team`, `/users` (enumeration now restricted)
- `/payment-center`, `/invoices` (API + nav alignment)
- `/employees`, `/attendance`, `/leaves`, `/payroll`

---

## How to Reproduce Customer Journey

1. Set `DATABASE_URL`, `CLERK_*` keys
2. `pnpm --filter @workspace/db run push`
3. `pnpm --filter @workspace/api-server exec tsx src/runCustomerZeroSeed.ts`
4. Link Clerk users to placeholder IDs in `office_members`
5. Start API (`PORT=8080`) + frontend (`PORT=3000`)
6. Sign in as each role and walk Day 0 / Day 1 workflows
