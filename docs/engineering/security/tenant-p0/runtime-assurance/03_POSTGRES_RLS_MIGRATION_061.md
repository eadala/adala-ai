# PostgreSQL RLS & Migration 061

**Harness:** `rlsMigration061Harness.ts`  
**DB:** `adala_rls_061` as role `adala_app` (rolbypassrls=false, rolsuper=false)  
**Migration:** `artifacts/api-server/migrations/061_force_rls_residual_tables.sql`  
**Exit:** 0 — PASS  

## Ordering / compatibility

061 depends on prior ENABLE RLS from 056/057/059/060. It only FORCE's tables that already have RLS enabled. Idempotent. No BYPASSRLS grants. No policy-qual changes.

## Upgrade path

Representative pre-061: tables with ENABLE RLS and FORCE=false → apply 061 → FORCE=true on `residual_tenant_rows` and `pre061_force_gap`.  
Full production dump upgrade: **BLOCKED** (no representative production schema dump in environment).

## Attack results

| Test ID | Scenario | Actual |
|---|---|---|
| PRE061_FORCE_FALSE | ENABLE without FORCE | PASS |
| M061_FORCE_APPLIED | FORCE after 061 | PASS |
| APP_ROLE_NO_BYPASSRLS | adala_app attrs | PASS |
| RLS_READ_CROSS_DENY | A reads B | 0 rows |
| RLS_UPDATE_CROSS_DENY | A updates B | B unchanged |
| RLS_DELETE_CROSS_DENY | A deletes B | B survives |
| RLS_MISSING_GUC_DENY | null GUC | 0 rows |
| RLS_EMPTY_GUC_DENY | empty GUC | 0 rows |
| RLS_INVALID_GUC_DENY | invalid GUC | 0 rows |
| RLS_BYPASS_ON_SCOPED | bypass=on | sees all |
| RLS_BYPASS_OFF_FAILCLOSED | bypass off | deny |
| RLS_SAME_TENANT_PASS | A GUC | 1 row |
| TX_ROLLBACK_CLEAN | rollback | clean |
| POOL_GUC_REUSE | reuse leak observed; reset restores deny | PASS |
| CONCURRENT_TENANT_OPS | parallel A/B | isolated |
| SECURITY_DEFINER_FORCE_RLS | SECURITY DEFINER + FORCE | contained to GUC |

Evidence: `evidence/rls-061.log`
