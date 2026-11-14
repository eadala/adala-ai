# F-TENANT-OFFICE-IDOR-001

**Initial severity:** CRITICAL  
**Remediation:** `requireAuthWithTenant` + `requirePathOfficeMatchesTenant`; nested mutations `AND office_id = tenantId`  
**Code:** `lib/assertOfficeAccess.ts`, `modules/marketplace/office.ts`  
**Original exploit reproduced:** YES (static — path office trusted under `requireAuth`)  
**Post-fix exploit denied:** YES (static suite)  
**Positive control:** PASS (static — same-tenant path match allowed)  
**Database isolation:** N/A (app-layer)  
**Regression tests:** PASS `tenantP0Remediation.static.test.ts`  
**Residual risk:** Role-level OLA (manager vs staff) not fully matrix-tested  
**Closure:** **CLOSED** (static + code); HTTP E2E residual → overall decision UNVERIFIED  
