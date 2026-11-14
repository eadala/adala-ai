# Enterprise Security Decision

**Directive:** ADALA-ARC-TENANT-SECURITY-004  
**Date:** 2026-11-14 (Asia/Riyadh)

## TENANT_ISOLATION_DECISION: TENANT_ISOLATION_FAIL

Follow-up incorporated from parallel audits:
[Audit tenant auth middleware](bc-f5a0fab4-9a8c-5747-9e04-56e08430f939),
[Audit Postgres RLS GUC](bc-620965e9-c610-5ca6-959b-5dcfba1d095d),
[Audit AI storage billing ARC](bc-53b41126-4443-5a9d-aec7-a9702841617d).

### Gates

| # | Gate | Result |
|---|---|---|
| 1 | No confirmed cross-tenant disclosure | **FAIL** — pool leak; office IDOR; payments list; AI logs |
| 2 | No confirmed cross-tenant modification | **FAIL** — Moyasar; office IDOR writes; AI credits/workflows |
| 3 | Surfaces inventoried | PARTIAL (expanded) |
| 4 | Server-side tenant auth | PARTIAL — canonical path OK; trace resolver + bare `requireAuth` FAIL |
| 5 | DB isolation verified | PARTIAL (pinned PASS / pool FAIL; FORCE partial) |
| 6 | Pool cannot leak privileged context | **FAIL** |
| 7 | API OLA verified | **FAIL** |
| 8 | AI isolation | **FAIL** |
| 9–11 | Storage/search/billing | Storage code VERIFIED; billing FAIL |
| 12 | ARC separate | PASS |
| 13 | Adversarial tests | Critical fails demonstrated |
| 14 | No release-blocking findings | **FAIL** |
| 15 | No critical surface unverified | **FAIL** |

## ARC_PRELIVE_DECISION

ARC pre-live setup readiness (**PRELIVE_GO** for human IdP/GitHub setup) remains intact on baseline `29f6cfb9`.  
Live validation **NOT GRANTED**. Customer SaaS release **NO-GO**.

## HUMAN_ACTIONS_REQUIRED

1. Approve remediation for F-TENANT-POOL-001 (connection-pinned GUCs).  
2. Approve remediation for F-TENANT-MOYASAR-001.  
3. Approve remediation for F-TENANT-OFFICE-IDOR-001 + payments list scoping.  
4. Approve remediation for AI credits/agent unscoped routes + `resolveTenantWithTrace` membership.  
5. Authorize expanded synthetic E2E tenant matrix after remediations.  
6. Do **not** enable `ARC_LIVE_VALIDATION_AUTHORIZED` or production deploy.

## Impact

- Customer application: **no code remediations applied** (audit-first).  
- Production: **NONE** contacted.  

## Next recommended action

Prioritized fix batch: (1) pool GUC pin, (2) office marketplace IDOR, (3) Moyasar + payments list, (4) AI credits/agent scopes, (5) resolver-trace membership. Re-run assurance before any PASS claim.
