# Cron / FORCE / Pool GUC

## Pool (F-TENANT-POOL-001)

**Remediation:** `lib/db/src/poolGucGuard.ts` installed from `index.ts` — reset `__unscoped__` + `bypass_rls=off` on checkout/release.  
**Test:** `tenantPoolGucContainment.adversarial.mjs` — PASS (post-release `bypass=off`, n=0).  
**Residual:** Drizzle `pool.query` still cannot pin tenant GUC across statements; **app WHERE remains primary**. Full request-scoped client pin = future work.

## Cron

**Remediation:** `logRotationCron` sets `setBypassRlsSession` + `clearTenantSessionFailClosed` in finally.  
**Residual:** Other crons not exhaustively wired — PARTIAL.

## FORCE

**Local migration:** `061_force_rls_residual_tables.sql` (not applied to production).  
**Status:** OPEN for production apply pending human authorization.

**Closure residuals:** PARTIAL overall for Cron/FORCE; pool leak CLOSED locally.  
