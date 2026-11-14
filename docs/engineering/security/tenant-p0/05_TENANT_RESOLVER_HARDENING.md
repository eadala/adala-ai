# F-TENANT-RESOLVER-TRACE-001

**Initial severity:** HIGH  
**Remediation:** `resolveTenantWithTrace` requires `office_members` for header; removed `api_key` header trust  
**Code:** `core/tenant/tenantResolver.ts`  
**Original exploit reproduced:** YES (static)  
**Post-fix exploit denied:** YES  
**Positive control:** PASS (member header still resolves)  
**Closure:** **CLOSED**  
