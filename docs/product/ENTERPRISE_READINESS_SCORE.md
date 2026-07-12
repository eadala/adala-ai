# Enterprise Readiness Score

**Assessment date:** 2026-07-07  
**Method:** Customer Zero simulation + static security audit + governance gates  
**Scale:** 0 (unusable) → 10 (enterprise production-ready)

---

## Overall Score: **6.8 / 10**

| Dimension | Score | Weight | Weighted |
|-----------|------:|-------:|---------:|
| Onboarding & setup | 7.0 | 15% | 1.05 |
| Daily legal operations | 8.0 | 20% | 1.60 |
| Financial operations | 7.5 | 15% | 1.13 |
| HR operations | 6.5 | 10% | 0.65 |
| Authorization & RBAC | 8.5 | 15% | 1.28 |
| Tenant isolation | 6.0 | 10% | 0.60 |
| Security posture | 7.0 | 10% | 0.70 |
| UX & permission clarity | 6.0 | 5% | 0.30 |
| **Total** | | **100%** | **6.81** |

---

## Dimension Detail

### Onboarding (7.0)

**Strengths:** Multi-step wizard, AI name suggestions, optional team invite, first case creation.  
**Gaps:** Enterprise plan provisioning requires Stripe or manual entitlements; trial `trial_*` IDs confuse enterprise buyers; no guided data migration.

### Daily legal operations (8.0)

**Strengths:** Full case lifecycle, documents, contracts, AI tools, calendar integration.  
**Gaps:** 7 contract GET routes lack read RBAC; matter-level access not implemented.

### Financial operations (7.5)

**Strengths:** Invoices, payments, accounting, payroll — P0 modules guarded.  
**Gaps:** Platform billing (`/billing`) separate auth model; extended ERP pages need audit.

### HR operations (6.5)

**Strengths:** Core `hr.ts` fully guarded; office_manager now has `hr:manage`.  
**Gaps:** `hr-enterprise`, `hrInternal`, `hrPerformance` — 42 unguarded routes.

### Authorization (8.5)

**Strengths:** Kernel stable; 8 P0 modules governance-blocked; no trainee fallback.  
**Gaps:** `enforceRoutePolicy` still in `warn` mode; registry lag vs code.

### Tenant isolation (6.0)

**Strengths:** Phase 1 foundation; P0 hotfixes; ALS context.  
**Gaps:** 7-step resolver fallbacks; in-memory freeze; no RLS.

### Security (7.0)

**Strengths:** Enumeration fixes; payment webhook scoped; abuse test suite.  
**Gaps:** Extended HR/financial modules; webhook signature optional when secret unset.

### UX & permissions (6.0)

**Strengths:** Nav gates added; `usePermissions` fail-closed while loading.  
**Gaps:** No in-app permission explainer; role matrix not shown to admins.

---

## Gate to 8.0 (Enterprise Pilot Ready)

| Requirement | Status |
|-------------|--------|
| P0 modules 100% mutation RBAC | ✅ |
| Payments module RBAC | ✅ |
| RBAC enumeration blocked | ✅ |
| Customer Zero seed | ✅ |
| HR extended modules RBAC | ❌ P1 |
| PR-TNT-002a resolver hardening | ❌ P1 |
| `AUTHORIZATION_ENFORCEMENT=strict` | ❌ P1 |
| Enterprise onboarding runbook | ❌ P2 |

---

## Gate to 9.0 (Enterprise Production)

- PostgreSQL RLS on P0 tables
- Multi-branch native support
- SOC2 audit trail completeness
- AI governance strict mode
- Data migration toolkit
- 99.9% SLA monitoring
