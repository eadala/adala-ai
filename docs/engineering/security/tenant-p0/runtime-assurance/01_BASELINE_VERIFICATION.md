# Baseline Verification

| Check | Result |
|---|---|
| Expected HEAD `22a28a5d…` | MATCH at branch creation |
| Expected tree `149c3a1a…` | MATCH |
| Ancestry from P0-005 remediation | `git merge-base --is-ancestor 22a28a5d HEAD` → OK |
| Branch | `cursor/tenant-p0-runtime-assurance-da81` created from baseline |
| Push / reset / deploy | None |
| ARC deployment execution | Remains DISABLED |
| Prior P0 docs | Read under `docs/engineering/security/tenant-p0/` |
| Prior status | TENANT_ISOLATION_UNVERIFIED → runtime work commenced |

## Unresolved findings entering P0-006

1. HTTP E2E matrix UNVERIFIED  
2. WhatsApp residual (unsigned / cross-phone status)  
3. Cron bypass wiring PARTIAL  
4. Migration 061 not applied/tested on isolated DB  
5. Revoked-member `users.office_id` fail-open (discovered in harness)  
6. Forged `x-tenant-id` silent fallback (discovered in harness)  

All addressed in this package with executable evidence under `evidence/`.
