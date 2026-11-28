# Tenant Boundary Findings Register

Scan baseline: local integration tree `168a55b4…` (+ remediation branches noted).

| ID | Finding | Path | Reachability | Severity | Status |
|---|---|---|---|---|---|
| F-01 | Collection revenue INSERT omitted `office_id` (pre-#182) | `finance-center.ts` | Prod route | P0 | Fixed in #182 — VERIFIED |
| F-02 | Autopilot task INSERT omitted office/case | `caseAutopilot.ts` | Prod path | P0 | Fixed in #182 — VERIFIED |
| F-03 | AI case-brief contracts unscoped | `ai-engine.ts` | Prod route | P0 | Fixed in #182 — VERIFIED |
| F-04 | Autopilot tasks context `OR case_title IS NOT NULL` | `caseAutopilot.ts` | Prod AI context | P1 | Remediated `4821321e` |
| F-05 | JLWM demo auto-seed on every startup | `index.ts` ← `jlwmDemoSeed.ts` | **Production-reachable** | P1 | Remediated `773fe722` (env gate) |
| F-06 | Runtime DDL `DEFAULT 'default'` remains on CREATE TABLE | payments/onboarding/orgStructure/telegram/email/aiCredits/aiChat/document-templates | Schema debt; writes generally stamp `req.tenantId` | P2 | Open — monitor |
| F-07 | orgStructure heal invents `default` for NULL/'' office_id | `orgStructure.ts` ensure | Startup/admin path | P1 | Open — in #171 tree |
| F-08 | Document Center `__default__` retention templates | `documentCenter.ts` | Global immutable templates; tenant upserts own `office_id` | P2 / design | Accept with monitoring — tenant cannot UPDATE `__default__` rows (upsert uses `${officeId}`) |
| F-09 | Session-level `set_config(..., false)` | `requireAuth.ts` | Pool reuse GUC leak class | P0-class | Tracked by open #139 (recovery) — not in cohesion set |
| F-10 | Actor `?? "unknown"` | various | Mostly IP/model/requestId; HR enterprise requester/approver | P2 | Not office inventing; harden HR actor fail-closed later |
| F-11 | Super Admin cross-office tools | admin/stripe/promo/infrastructure | `requireSuperAdmin` | — | Explicit privilege — keep audited |

## Hypothesis check

“Inventing-default / cross-tenant FREE class cleared” — **PARTIALLY SUPPORTED**:
- Live cohesion route inventing of office identity: largely cleared in #164–#182 (VERIFIED static + guards).
- Residuals F-04–F-07, F-09 remain outside that claim or newly remediated.
