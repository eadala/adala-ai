# Enterprise Security Decision

**Directive:** ADALA-ARC-TENANT-SECURITY-004  
**Date:** 2026-11-14 (Asia/Riyadh)

## TENANT_ISOLATION_DECISION: TENANT_ISOLATION_FAIL

### Gates

| # | Gate | Result |
|---|---|---|
| 1 | No confirmed cross-tenant disclosure | **FAIL** — pool bypass leak discloses all rows |
| 2 | No confirmed cross-tenant modification | **FAIL** — Moyasar ID-only UPDATE; pool bypass enables writes |
| 3 | Surfaces inventoried | PARTIAL |
| 4 | Server-side tenant auth | PARTIAL PASS (resolveTenantId) |
| 5 | DB isolation verified | PARTIAL (pinned PASS / pool FAIL) |
| 6 | Pool cannot leak privileged context | **FAIL** |
| 7 | API OLA verified | FAIL / incomplete |
| 8 | AI isolation | UNVERIFIED |
| 9–11 | Storage/search/billing | Storage partial; billing FAIL |
| 12 | ARC separate | PASS |
| 13 | Adversarial tests | Critical fails demonstrated |
| 14 | No release-blocking findings | **FAIL** |
| 15 | No critical surface unverified | **FAIL** |

## ARC_PRELIVE_DECISION

ARC pre-live setup readiness (**PRELIVE_GO** for human IdP/GitHub setup) remains intact on baseline `29f6cfb9`.  
Live validation **NOT GRANTED**. Customer SaaS release **NO-GO**.

## HUMAN_ACTIONS_REQUIRED

1. Approve separate remediation directive for F-TENANT-POOL-001 (connection-pinned GUCs).  
2. Approve separate remediation for F-TENANT-MOYASAR-001.  
3. Authorize expanded synthetic E2E tenant matrix after remediations.  
4. Do **not** enable `ARC_LIVE_VALIDATION_AUTHORIZED` or production deploy.

## Impact

- Customer application: **no code remediations applied** (audit-first).  
- Production: **NONE** contacted.  

## Next recommended action

Open a minimal security fix branch for pool GUC containment + Moyasar webhook hardening; re-run this assurance directive before any tenant-isolation PASS claim.
