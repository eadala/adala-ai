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

## F-TENANT-OFFICE-IDOR-001

- **Severity:** CRITICAL  
- **Component:** `modules/marketplace/office.ts` — `/office/my/:officeId/*`  
- **Root cause:** Routes use `requireAuth` only; path `officeId` trusted for services/team/orders/reviews/articles/domains without membership check.  
- **Evidence:** Source inspection ([Audit tenant auth middleware](bc-f5a0fab4-9a8c-5747-9e04-56e08430f939)); confirmed `requireAuth` at L268+.  
- **Impact:** Cross-tenant read/write of marketplace office resources.  
- **Remediation:** `requireAuthWithTenant` + assert `req.params.officeId === req.tenantId` (or membership).  
- **Release-blocking:** YES  

## F-TENANT-RESOLVER-TRACE-001

- **Severity:** HIGH  
- **Component:** `core/tenant/tenantResolver.ts` `resolveTenantWithTrace`  
- **Root cause:** Honors `x-tenant-id` UUID with role `"api_key"` and **no** `office_members` check (comment claims caller checks; dangerous if reused). Used by `requireAuthWithTenantAudit`.  
- **Impact:** TENANT-002 violation on audit/trace path.  
- **Release-blocking:** YES  

## F-TENANT-PAYMENTS-LIST-001

- **Severity:** CRITICAL (disclosure if RLS/pool fails) / HIGH (app-layer omission)  
- **Component:** `modules/financial/payments.ts` `GET /payments/transactions`  
- **Root cause:** `SELECT * FROM payment_transactions ... LIMIT 200` with **no** `office_id` predicate despite `requireAuthWithTenant`. Relies solely on RLS/GUC.  
- **Impact:** Cross-tenant payment disclosure under F-TENANT-POOL-001 or owner-bypass.  
- **Release-blocking:** YES  

## F-TENANT-AI-CREDITS-001

- **Severity:** CRITICAL  
- **Component:** `modules/ai/aiCredits.ts`  
- **Root cause:** `POST /ai-credits/deduct` takes `officeId` from body (default `"default"`); office credit GET hardcodes `office_id = 'default'`.  
- **Evidence:** ([Audit AI storage billing ARC](bc-53b41126-4443-5a9d-aec7-a9702841617d))  
- **Impact:** Cross-tenant credit mutation / mis-attribution.  
- **Release-blocking:** YES  

## F-TENANT-AI-AGENT-UNSCOPED-001

- **Severity:** HIGH  
- **Component:** `modules/ai/ai-agent.ts` `GET /ai-agent/logs`, `GET|POST /ai-agent/workflows`  
- **Root cause:** `requireAuth` only; queries omit `office_id`.  
- **Impact:** Cross-tenant AI operational data disclosure / workflow create.  
- **Release-blocking:** YES  

## F-TENANT-BRANDING-001

- **Severity:** HIGH  
- **Component:** `modules/platform/branding.ts`  
- **Root cause:** GET uses `req.query.tenantId`; PUT by id without office ownership.  
- **Release-blocking:** YES (with IDOR class)

## F-TENANT-CRON-GUC-001

- **Severity:** HIGH  
- **Component:** Cron/jobs (`emailCron`, `logRotationCron`, `stripeReconcile`, etc.)  
- **Root cause:** No tenant/bypass GUC set ([Audit Postgres RLS GUC](bc-620965e9-c610-5ca6-959b-5dcfba1d095d)).  
- **Impact:** Jobs fail-closed (miss work) or, under fail-open residual, over-broad access.  
- **Release-blocking:** YES for ops reliability + isolation posture  

## Prior closed (context)

- F-001 / F-002 / F-PRELIVE-001 — CLOSED on ARC baseline (129/129).
