# Tenant Security Findings

## F-TENANT-POOL-001

- **Severity:** CRITICAL  
- **Component:** `lib/db` `pg.Pool` + `tenantSession.ts` / `app.ts` / `requireAuth.ts`  
- **Root cause:** Session-scoped `set_config(..., false)` without checkout-pinned connections; clear/set may hit different pool members. Privileged `bypass_rls=on` survives `release()`.  
- **Exploit prerequisites:** Concurrent traffic after SA/webhook/bypass path; or any request that leaves GUC uncleared on a recycled connection.  
- **Reproduction:** `node artifacts/api-server/src/tests/tenantPoolGucContainment.adversarial.mjs` → `BYPASS_RLS leaks`.  
- **Impact:** Cross-tenant disclosure and modification if RLS is relied upon; undermines ADR-001 defense-in-depth.  
- **Remediation (separate patch plan):** Per-request client checkout; `SET LOCAL` inside transaction; or `pg` connection middleware that always resets GUC on acquire/release; never session-set bypass without `finally` on **same** client.  
- **Regression test:** Keep adversarial mjs in CI against ephemeral PG.  
- **Release-blocking:** YES  

## F-TENANT-MOYASAR-001

- **Severity:** CRITICAL (integrity) / HIGH if webhook not internet-exposed  
- **Component:** `artifacts/api-server/src/modules/integrations/webhook.ts` Moyasar handler  
- **Root cause:** Tenant from `body.metadata.office_id`; signature optional; UPDATE by id/ref without `office_id`.  
- **Exploit prerequisites:** Ability to POST webhook; forged/missing secret path or guessed UUID/ref.  
- **Reproduction:** Static suite `tenantMoyasarWebhookIsolation.static.test.ts`.  
- **Impact:** Cross-tenant payment status mutation; forged ledger inserts.  
- **Remediation:** Require signature always; resolve office from signed payment mapping only; all UPDATEs include `office_id`; reject unsigned.  
- **Release-blocking:** YES  

## F-TENANT-CACHE-001

- **Severity:** MEDIUM  
- **Component:** `tenantMiddleware.ts` in-memory membership cache TTL 5m  
- **Root cause:** Revoked membership may remain effective until TTL.  
- **Impact:** Stale authorization.  
- **Release-blocking:** No (fix with CRITICAL items)  

## F-TENANT-FORCE-001

- **Severity:** MEDIUM / INFORMATIONAL depending on DB role  
- **Component:** Migrations 059/060 omit FORCE RLS  
- **Impact:** Table owner bypasses RLS.  
- **Status:** NOT_TESTED against production role mapping  

## F-TENANT-COV-001

- **Severity:** HIGH (assurance gap)  
- **Component:** Customer API/AI/RAG/search E2E adversarial matrix  
- **Root cause:** Incomplete runtime proof  
- **Release-blocking:** YES for TENANT_ISOLATION_PASS gate (unverified critical surfaces)

## Prior closed (context)

- F-001 / F-002 / F-PRELIVE-001 — CLOSED on ARC baseline (129/129).
